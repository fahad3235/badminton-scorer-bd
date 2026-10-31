// Badminton Scorer BD \u2014 DOM app. Pure logic lives in js/logic.js.
(function () {
  'use strict';
  var L = window.BadmintonLogic;
  var I18n = window.BadmintonI18n;
  var LS_LANG = 'bms_lang', LS_HIST = 'bms_history', LS_LIVE = 'bms_live';
  var lang = localStorage.getItem(LS_LANG) || 'en';
  var history = loadHistory();
  var live = loadLive(); // {match, snaps:[], startedAt} or null
  var swapped = false;
  var timerId = null;

  function $(id) { return document.getElementById(id); }
  function t(key) { return I18n.STR[lang][key] || I18n.STR.en[key] || key; }
  function fmt(n) { return lang === 'bn' ? I18n.bnDigits(n) : String(n); }

  function loadHistory() {
    try {
      var h = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      return Array.isArray(h) ? h : [];
    } catch (e) { return []; }
  }
  function saveHistory() { localStorage.setItem(LS_HIST, JSON.stringify(history)); }
  function loadLive() {
    try { return JSON.parse(localStorage.getItem(LS_LIVE) || 'null'); } catch (e) { return null; }
  }
  function saveLive() {
    if (live) localStorage.setItem(LS_LIVE, JSON.stringify(live));
    else localStorage.removeItem(LS_LIVE);
  }

  function renderLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('langBtn').textContent = lang === 'en' ? '\u09ac\u09be\u0982\u09b2\u09be' : 'English';
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }

  function showTab(name) {
    ['score', 'history', 'data'].forEach(function (n) {
      $('panel-' + n).hidden = n !== name;
      $('tab-' + n).classList.toggle('active', n === name);
    });
    if (name === 'history') renderHistory();
  }

  function elapsedText() {
    if (!live) return '0:00';
    var s = Math.floor((Date.now() - live.startedAt) / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function render() {
    renderLang();
    var hasLive = !!live;
    $('setupCard').hidden = hasLive;
    $('scoreCard').hidden = !hasLive;
    if (!hasLive) { stopTimer(); return; }
    var m = live.match;
    var left = swapped ? 'B' : 'A', right = swapped ? 'A' : 'B';
    $('nameLeft').textContent = left === 'A' ? m.playerA : m.playerB;
    $('nameRight').textContent = right === 'A' ? m.playerA : m.playerB;
    $('scoreLeft').textContent = fmt(left === 'A' ? m.current.a : m.current.b);
    $('scoreRight').textContent = fmt(right === 'A' ? m.current.a : m.current.b);
    $('setLine').textContent = t('set') + ' ' + fmt(m.sets.length + 1) +
      ' \u00b7 ' + t('setsWon') + ': ' + fmt(m.setsWon.a) + '\u2013' + fmt(m.setsWon.b) +
      ' \u00b7 ' + t('rallies') + ': ' + fmt(m.rallies);
    var serverName = m.server === 'A' ? m.playerA : m.playerB;
    var serverScore = m.server === 'A' ? m.current.a : m.current.b;
    var court = L.serviceCourt(serverScore) === 'right' ? t('courtRight') : t('courtLeft');
    $('serverLine').textContent = t('serving') + ': ' + serverName + ' (' + court + ')';
    $('elapsedLine').textContent = t('elapsed') + ': ' + fmt(elapsedText());
    $('pointBtnA').textContent = t('pointA') + (left === 'A' ? m.playerA : m.playerB);
    $('pointBtnB').textContent = t('pointB') + (right === 'A' ? m.playerA : m.playerB);
    $('undoBtn').disabled = live.snaps.length === 0 || m.status !== 'live';
    $('pointBtnA').disabled = m.status !== 'live';
    $('pointBtnB').disabled = m.status !== 'live';
    $('endBtn').hidden = m.status !== 'live';
    $('setScores').textContent = m.sets.length ? t('setHistory') + ': ' +
      m.sets.map(function (s) { return fmt(s.a) + '\u2013' + fmt(s.b); }).join(', ') : '';
    var banner = $('resultBanner');
    if (m.status === 'done') {
      banner.hidden = false;
      banner.textContent = t('matchOver') + ' \u2014 ' + (m.winner === 'A' ? m.playerA : m.playerB) +
        ' ' + t('wins') + ' (' + m.sets.map(function (s) { return fmt(s.a) + '\u2013' + fmt(s.b); }).join(', ') + ')';
    } else banner.hidden = true;
    startTimer();
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(function () {
      if (live) $('elapsedLine').textContent = t('elapsed') + ': ' + fmt(elapsedText());
    }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function finishMatch(m) {
    history.unshift({
      playerA: m.playerA, playerB: m.playerB, bestOf: m.bestOf, target: m.target,
      sets: m.sets, winner: m.winner, finishedAt: new Date().toISOString()
    });
    saveHistory();
  }

  function doPoint(player) {
    if (!live) return;
    live.snaps.push(JSON.stringify(live.match));
    var ev = L.pointWon(live.match, player);
    if (ev.error) { live.snaps.pop(); return; }
    if (ev.matchWon) finishMatch(live.match);
    saveLive();
    render();
  }

  function renderHistory() {
    var box = $('historyList');
    if (!history.length) { box.innerHTML = '<p class="muted">' + t('historyEmpty') + '</p>'; return; }
    box.innerHTML = '';
    history.forEach(function (h) {
      var div = document.createElement('div');
      div.className = 'hist-row';
      var d = new Date(h.finishedAt);
      div.textContent = (h.winner === 'A' ? h.playerA : h.playerB) + ' ' + t('wins') + ' \u2014 ' +
        h.sets.map(function (s) { return fmt(s.a) + '\u2013' + fmt(s.b); }).join(', ') +
        ' (' + h.playerA + ' vs ' + h.playerB + ', ' + d.toLocaleDateString() + ')';
      box.appendChild(div);
    });
  }

  function init() {
    renderLang();
    $('langBtn').addEventListener('click', function () {
      lang = lang === 'en' ? 'bn' : 'en';
      localStorage.setItem(LS_LANG, lang);
      render();
    });
    ['score', 'history', 'data'].forEach(function (n) {
      $('tab-' + n).addEventListener('click', function () { showTab(n); });
    });
    $('startBtn').addEventListener('click', function () {
      var a = $('nameA').value.trim(), b = $('nameB').value.trim();
      if (!L.validateName(a) || !L.validateName(b)) { $('setupError').textContent = t('nameError'); return; }
      $('setupError').textContent = '';
      live = { match: L.newMatch(a, b, parseInt($('bestOf').value, 10), parseInt($('target').value, 10)),
        snaps: [], startedAt: Date.now() };
      swapped = false;
      saveLive();
      render();
    });
    $('pointBtnA').addEventListener('click', function () { doPoint(swapped ? 'B' : 'A'); });
    $('pointBtnB').addEventListener('click', function () { doPoint(swapped ? 'A' : 'B'); });
    $('undoBtn').addEventListener('click', function () {
      if (!live || !live.snaps.length) return;
      // Undoing the match-winning point must also drop the history row it recorded.
      if (live.match.status === 'done' && history.length) {
        var h0 = history[0];
        if (h0.playerA === live.match.playerA && h0.playerB === live.match.playerB &&
            h0.winner === live.match.winner && h0.sets.length === live.match.sets.length) {
          history.shift();
          saveHistory();
        }
      }
      live.match = JSON.parse(live.snaps.pop());
      saveLive();
      render();
    });
    $('swapBtn').addEventListener('click', function () { swapped = !swapped; render(); });
    $('endBtn').addEventListener('click', function () {
      if (!live) return;
      var m = live.match;
      if (m.sets.length && m.setsWon.a !== m.setsWon.b) {
        m.winner = m.setsWon.a > m.setsWon.b ? 'A' : 'B';
        m.status = 'done';
        finishMatch(m);
      }
      live = null;
      saveLive();
      render();
    });
    $('newMatchBtn').addEventListener('click', function () {
      live = null; swapped = false; saveLive(); render();
    });
    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ kind: 'badminton-scorer-bd-history', matches: history }, null, 2)],
        { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'badminton-scorer-history.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('importFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          if (!L.validateImport(data)) throw new Error('bad');
          history = data.matches;
          saveHistory();
          $('dataMsg').textContent = t('importOk');
        } catch (err) { $('dataMsg').textContent = t('importBad'); }
        renderHistory();
      };
      r.readAsText(f);
      e.target.value = '';
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value !== 'DELETE') { $('dataMsg').textContent = t('eraseBad'); return; }
      history = [];
      saveHistory();
      $('eraseInput').value = '';
      $('dataMsg').textContent = t('eraseOk');
      renderHistory();
    });
    render();
    showTab('score');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
