#!/usr/bin/env node
/* Headless-Chromium smoke test for badminton-scorer-bd via raw CDP.
 * Usage: node smoke.mjs   (starts its own chrome on port 9324)
 */
'use strict';
const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9324;
const DIR = '/home/hatch/workspace/muse-project-factory/builds/badminton-scorer-bd';
const URL = 'file://' + DIR + '/index.html';
const { spawn } = await import('node:child_process');
const { createHash } = await import('node:crypto');
const { readFileSync } = await import('node:fs');
const POLICY = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
const POLICYSHA = createHash('sha256').update(readFileSync(POLICY)).digest('hex');
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  OK ' : '  FAIL ') + name + (cond || !detail ? '' : '  -> ' + detail));
}
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--no-proxy-server', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/bms-qa-profile',
  '--hatch-webgl-allowed-domains-file=' + POLICY, '--hatch-webgl-allowed-domains-sha256=' + POLICYSHA,
  'about:blank'], { stdio: 'ignore' });
async function waitForDebugger() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch (e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('chrome debugger never came up');
}
async function newTarget() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
  return (await r.json()).webSocketDebuggerUrl;
}
let msgId = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        if (m.error) reject(new Error(method + ': ' + JSON.stringify(m.error))); else resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.removeEventListener('message', onMsg); reject(new Error('CDP timeout ' + method)); }, 15000);
  });
}
async function ev(ws, expr, awaitPromise = false) {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error('JS exception: ' + JSON.stringify(r.exceptionDetails) + ' ' + expr.slice(0, 120));
  return r.result.value;
}
function drainConsole(ws, errors) {
  ws.addEventListener('message', (evm) => {
    let m; try { m = JSON.parse(evm.data); } catch (e) { return; }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown')
      errors.push('page exception: ' + (m.params.exceptionDetails.text || ''));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
      errors.push('log.error: ' + m.params.entry.text);
  });
}
try {
  await waitForDebugger();
  const ws = new WebSocket(await newTarget());
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const consoleErrors = [];
  drainConsole(ws, consoleErrors);
  await send(ws, 'Runtime.enable'); await send(ws, 'Log.enable'); await send(ws, 'Page.enable');
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 800)); // DOMContentLoaded + render

  console.log('DESKTOP (1280x800)');
  check('title', (await ev(ws, 'document.title')) === 'Badminton Scorer BD');
  check('setup visible, scoreboard hidden initially',
    await ev(ws, `!document.getElementById('setupCard').hidden && document.getElementById('scoreCard').hidden`));
  check('3 tabs present', await ev(ws, `document.querySelectorAll('.tab').length`) === 3);

  // validation: empty names rejected
  await ev(ws, `document.getElementById('nameA').value=''; document.getElementById('nameB').value=''; document.getElementById('startBtn').click();`);
  check('empty names show inline error', await ev(ws, `document.getElementById('setupError').textContent.length > 0`));
  check('still on setup after invalid start', await ev(ws, `!document.getElementById('setupCard').hidden`));

  // start match Rahim vs Karim, best of 3, 21 points
  await ev(ws, `document.getElementById('nameA').value='Rahim'; document.getElementById('nameB').value='Karim'; document.getElementById('startBtn').click();`);
  check('scoreboard visible after start', await ev(ws, `!document.getElementById('scoreCard').hidden`));
  check('server line names Rahim (first server)', (await ev(ws, `document.getElementById('serverLine').textContent`)).includes('Rahim'));
  check('server on right court at 0', (await ev(ws, `document.getElementById('serverLine').textContent`)).includes('right court'));

  // one point + undo
  await ev(ws, `document.getElementById('pointBtnA').click();`);
  check('point A -> 1-0', await ev(ws, `document.getElementById('scoreLeft').textContent`) === '1');
  await ev(ws, `document.getElementById('undoBtn').click();`);
  check('undo -> 0-0', await ev(ws, `document.getElementById('scoreLeft').textContent`) === '0');

  // swap sides
  await ev(ws, `document.getElementById('swapBtn').click();`);
  check('swap moves Karim to left', await ev(ws, `document.getElementById('nameLeft').textContent`) === 'Karim');
  await ev(ws, `document.getElementById('swapBtn').click();`);
  check('swap back restores Rahim left', await ev(ws, `document.getElementById('nameLeft').textContent`) === 'Rahim');

  // win set 1: 21-0
  await ev(ws, `for (let i=0;i<21;i++) document.getElementById('pointBtnA').click();`);
  check('after set 1, score resets 0-0', await ev(ws, `document.getElementById('scoreLeft').textContent`) === '0');
  check('set scores show 21-0', (await ev(ws, `document.getElementById('setScores').textContent`)).includes('21'));
  check('sets won line shows 1-0', (await ev(ws, `document.getElementById('setLine').textContent`)).includes('1'));

  // win set 2 -> match over, history row
  await ev(ws, `for (let i=0;i<21;i++) document.getElementById('pointBtnA').click();`);
  check('match-over banner visible', await ev(ws, `!document.getElementById('resultBanner').hidden`));
  check('banner names Rahim', (await ev(ws, `document.getElementById('resultBanner').textContent`)).includes('Rahim'));
  check('point buttons disabled after match', await ev(ws, `document.getElementById('pointBtnA').disabled`));
  await ev(ws, `document.getElementById('tab-history').click();`);
  check('history has 1 row naming Rahim', await ev(ws, `document.querySelectorAll('.hist-row').length`) === 1 &&
    (await ev(ws, `document.getElementById('historyList').textContent`)).includes('Rahim'));
  await ev(ws, `document.getElementById('tab-score').click();`);

  // BN toggle + Bengali digits + persistence
  await ev(ws, `document.getElementById('newMatchBtn').click();`);
  await ev(ws, `document.getElementById('nameA').value='Rahim'; document.getElementById('nameB').value='Karim'; document.getElementById('startBtn').click();`);
  await ev(ws, `document.getElementById('langBtn').click();`);
  check('html lang=bn after toggle', await ev(ws, `document.documentElement.lang`) === 'bn');
  check('BN title renders Bengali', await ev(ws, `/[^\\x00-\\x7F]/.test(document.querySelector('h1').textContent)`));
  await ev(ws, `document.getElementById('pointBtnA').click(); document.getElementById('pointBtnA').click();`);
  check('score 2 renders as Bengali digit', await ev(ws, `document.getElementById('scoreLeft').textContent`) === '২');
  check('lang persisted bms_lang=bn', await ev(ws, `localStorage.getItem('bms_lang')`) === 'bn');
  await send(ws, 'Page.reload');
  await new Promise((r) => setTimeout(r, 800));
  check('language survives reload (bn)', await ev(ws, `document.documentElement.lang`) === 'bn');
  check('live match survives reload (score still Bengali 2)', await ev(ws, `document.getElementById('scoreLeft').textContent`) === '২');

  // malformed import rejected, data intact
  await ev(ws, `document.getElementById('tab-data').click();`);
  check('data panel visible', await ev(ws, `!document.getElementById('panel-data').hidden`));
  const badOk = await ev(ws, `(() => { try {
    const bad = JSON.stringify({kind:'nope', matches:[]});
    const ok = window.BadmintonLogic.validateImport(JSON.parse(bad));
    return ok === false;
  } catch(e) { return false; } })()`);
  check('validateImport rejects wrong kind', badOk);

  check('zero network resource requests', await ev(ws, `performance.getEntriesByType('resource').length`) === 0);
  check('no horizontal overflow (desktop)', await ev(ws, `document.documentElement.scrollWidth <= window.innerWidth`));

  console.log('MOBILE (390px)');
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await new Promise((r) => setTimeout(r, 400));
  for (const t of ['score', 'history', 'data']) {
    await ev(ws, `document.getElementById('tab-${t}').click();`);
    await new Promise((r) => setTimeout(r, 150));
    const sw = await ev(ws, `document.documentElement.scrollWidth`);
    check(`no horizontal overflow on ${t} tab (390px)`, sw <= 390, 'scrollWidth=' + sw);
  }
  await new Promise((r) => setTimeout(r, 500));
  check('zero console/page errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  ws.close();
} catch (e) {
  results.push({ name: 'smoke run completed', ok: false });
  console.log('  FAIL smoke run error: ' + (e && e.message || e));
} finally { try { chrome.kill(); } catch (e) {} }
const pass = results.filter((r) => r.ok).length;
console.log(`\nSMOKE: ${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
