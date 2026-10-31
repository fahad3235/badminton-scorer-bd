// Node unit tests for the badminton scoring engine. Run: node tests/logic.test.js
const assert = require('node:assert');
const L = require('../js/logic.js');

let n = 0;
function check(name, fn) { fn(); n++; console.log('ok - ' + name); }

function play(m, seq) { seq.forEach(p => { const ev = L.pointWon(m, p); assert(!ev.error, 'no error'); }); }

check('setWinner: 21-19 wins, 20-20 not yet, 21-20 not yet', () => {
  assert.strictEqual(L.setWinner(21, 19, 21), 'A');
  assert.strictEqual(L.setWinner(20, 20, 21), null);
  assert.strictEqual(L.setWinner(21, 20, 21), null);
  assert.strictEqual(L.setWinner(22, 20, 21), 'A');
});
check('setWinner: cap 30-29 wins, 29-29 not yet', () => {
  assert.strictEqual(L.setWinner(30, 29, 21), 'A');
  assert.strictEqual(L.setWinner(29, 29, 21), null);
  assert.strictEqual(L.setWinner(29, 30, 21), 'B');
});
check('setWinner: caps for 15 and 11 targets', () => {
  assert.strictEqual(L.capFor(15), 21);
  assert.strictEqual(L.capFor(11), 15);
  assert.strictEqual(L.setWinner(21, 20, 15), 'A');
  assert.strictEqual(L.setWinner(15, 14, 11), 'A'); // 11-point cap is 15: first to 15 wins
  assert.strictEqual(L.setWinner(15, 14, 15), null); // 15-point: 15-14 is only a 1-point lead
  assert.strictEqual(L.setWinner(16, 14, 15), 'A');
});
check('matchWinner: best-of-3 needs 2', () => {
  assert.strictEqual(L.matchWinner(1, 1, 3), null);
  assert.strictEqual(L.matchWinner(2, 1, 3), 'A');
  assert.strictEqual(L.matchWinner(0, 1, 1), 'B');
});
check('serviceCourt: even score right, odd left', () => {
  assert.strictEqual(L.serviceCourt(0), 'right');
  assert.strictEqual(L.serviceCourt(1), 'left');
  assert.strictEqual(L.serviceCourt(20), 'right');
});
check('straight-sets win: 21-0 twice finishes best-of-3', () => {
  const m = L.newMatch('Rahim', 'Karim', 3, 21);
  play(m, Array(21).fill('A'));
  assert.strictEqual(m.sets.length, 1);
  assert.deepStrictEqual(m.sets[0], { a: 21, b: 0, winner: 'A' });
  assert.strictEqual(m.status, 'live');
  play(m, Array(21).fill('A'));
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(m.winner, 'A');
  assert.strictEqual(L.scoreLine(m), '21-0, 21-0');
});
check('deuce set: 20-20 then A wins 22-20', () => {
  const m = L.newMatch('A', 'B', 1, 21);
  play(m, [...Array(20).fill('A'), ...Array(20).fill('B'), 'A', 'A']);
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(m.sets[0].a, 22);
  assert.strictEqual(m.sets[0].b, 20);
});
check('cap set: 29-29 then next point wins 30-29', () => {
  const m = L.newMatch('A', 'B', 1, 21);
  // Interleave so neither side wins early: 20-20, then strict alternation to 29-29, then B takes the cap.
  const alt = [];
  for (let i = 0; i < 9; i++) { alt.push('A', 'B'); }
  play(m, [...Array(20).fill('A'), ...Array(20).fill('B'), ...alt, 'B']);
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(m.sets[0].b, 30);
  assert.strictEqual(m.sets[0].a, 29);
});
check('server follows rally winner', () => {
  const m = L.newMatch('A', 'B', 3, 21);
  assert.strictEqual(m.server, 'A');
  L.pointWon(m, 'B');
  assert.strictEqual(m.server, 'B');
  L.pointWon(m, 'A');
  assert.strictEqual(m.server, 'A');
});
check('pointWon rejects bad player and finished match', () => {
  const m = L.newMatch('A', 'B', 1, 11);
  assert.strictEqual(L.pointWon(m, 'X').error, 'bad-player');
  play(m, Array(11).fill('A'));
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(L.pointWon(m, 'A').error, 'match-not-live');
});
check('validateName boundaries', () => {
  assert.strictEqual(L.validateName('Rahim'), true);
  assert.strictEqual(L.validateName(''), false);
  assert.strictEqual(L.validateName('   '), false);
  assert.strictEqual(L.validateName('x'.repeat(41)), false);
  assert.strictEqual(L.validateName('x'.repeat(40)), true);
});
check('validateImport accepts a real finished match, rejects garbage', () => {
  const good = { kind: 'badminton-scorer-bd-history', matches: [
    { playerA: 'Rahim', playerB: 'Karim', bestOf: 3, target: 21,
      sets: [{ a: 21, b: 18 }, { a: 19, b: 21 }, { a: 21, b: 15 }],
      winner: 'A', finishedAt: '2026-10-31T10:00:00.000Z' } ] };
  assert.strictEqual(L.validateImport(good), true);
  assert.strictEqual(L.validateImport({ kind: 'other', matches: [] }), false);
  assert.strictEqual(L.validateImport({ kind: 'badminton-scorer-bd-history', matches: [
    { playerA: 'R', playerB: 'K', bestOf: 3, target: 21, sets: [{ a: 5, b: 3 }], winner: 'A', finishedAt: 'x' } ] }), false);
  assert.strictEqual(L.validateImport({ kind: 'badminton-scorer-bd-history', matches: [
    { playerA: 'R', playerB: 'K', bestOf: 2, target: 21, sets: [{ a: 21, b: 10 }], winner: 'A', finishedAt: 'x' } ] }), false);
  assert.strictEqual(L.validateImport(null), false);
  assert.strictEqual(L.validateImport('nope'), false);
});
check('11-point game: 11-9 wins, cap 15', () => {
  const m = L.newMatch('A', 'B', 1, 11);
  play(m, [...Array(9).fill('A'), ...Array(9).fill('B'), 'A', 'A']);
  assert.strictEqual(m.status, 'done');
  assert.strictEqual(m.sets[0].a, 11);
});

console.log(n + ' unit tests passed');
