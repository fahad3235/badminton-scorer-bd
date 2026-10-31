// Badminton rally-scoring engine (pure, no DOM). Shared by the app and node tests.
(function (root) {
  'use strict';
  var CAPS = { 21: 30, 15: 21, 11: 15 };

  function capFor(target) { return CAPS[target] || (target + 9); }

  // A set is won when a player reaches target with a 2-point lead, or hits the cap.
  function setWinner(a, b, target) {
    var cap = capFor(target);
    if (a >= cap && a > b) return 'A';
    if (b >= cap && b > a) return 'B';
    if (a >= target && a - b >= 2) return 'A';
    if (b >= target && b - a >= 2) return 'B';
    return null;
  }

  // Match is won when a player has more than half the sets (best of 1/3/5).
  function matchWinner(setsWonA, setsWonB, bestOf) {
    var need = Math.floor(bestOf / 2) + 1;
    if (setsWonA >= need) return 'A';
    if (setsWonB >= need) return 'B';
    return null;
  }

  // Rally scoring: the winner of a rally serves the next rally.
  // Service court: server's own score even -> right court, odd -> left court.
  function serviceCourt(serverScore) { return serverScore % 2 === 0 ? 'right' : 'left'; }

  function emptySet() { return { a: 0, b: 0 }; }

  function newMatch(playerA, playerB, bestOf, target) {
    return {
      playerA: playerA || 'Player A',
      playerB: playerB || 'Player B',
      bestOf: bestOf || 3,
      target: target || 21,
      sets: [],
      current: emptySet(),
      setsWon: { a: 0, b: 0 },
      server: 'A',
      status: 'live', // live | done
      winner: null,
      rallies: 0,
      log: [] // {set, a, b, point:'A'|'B', server}
    };
  }

  // Apply one rally point. Returns an event object, or {error} on invalid input.
  function pointWon(m, player) {
    if (!m || m.status !== 'live') return { error: 'match-not-live' };
    if (player !== 'A' && player !== 'B') return { error: 'bad-player' };
    m.current[player === 'A' ? 'a' : 'b'] += 1;
    m.rallies += 1;
    m.server = player; // rally winner serves next
    var setNo = m.sets.length + 1;
    m.log.push({ set: setNo, a: m.current.a, b: m.current.b, point: player, server: m.server });
    var w = setWinner(m.current.a, m.current.b, m.target);
    var ev = { point: player, setWon: null, matchWon: null };
    if (w) {
      m.sets.push({ a: m.current.a, b: m.current.b, winner: w });
      m.setsWon[w === 'A' ? 'a' : 'b'] += 1;
      ev.setWon = w;
      var mw = matchWinner(m.setsWon.a, m.setsWon.b, m.bestOf);
      if (mw) {
        m.status = 'done';
        m.winner = mw;
        ev.matchWon = mw;
      } else {
        m.current = emptySet();
        m.server = 'A'; // new set: A serves first (documented house rule)
      }
    }
    return ev;
  }

  function scoreLine(m) {
    return m.sets.map(function (s) { return s.a + '-' + s.b; }).join(', ');
  }

  function validateName(n) {
    if (typeof n !== 'string') return false;
    var t = n.trim();
    return t.length >= 1 && t.length <= 40;
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.kind !== 'badminton-scorer-bd-history' || !Array.isArray(data.matches)) return false;
    for (var i = 0; i < data.matches.length; i++) {
      var x = data.matches[i];
      if (!x || typeof x !== 'object') return false;
      if (!validateName(x.playerA) || !validateName(x.playerB)) return false;
      if (![1, 3, 5].includes(x.bestOf) || ![11, 15, 21].includes(x.target)) return false;
      if (!Array.isArray(x.sets) || x.sets.length === 0) return false;
      for (var j = 0; j < x.sets.length; j++) {
        var s = x.sets[j];
        if (!s || typeof s.a !== 'number' || typeof s.b !== 'number') return false;
        if (s.a < 0 || s.b < 0 || !Number.isInteger(s.a) || !Number.isInteger(s.b)) return false;
        if (!setWinner(s.a, s.b, x.target)) return false;
      }
      if (x.winner !== 'A' && x.winner !== 'B') return false;
      if (typeof x.finishedAt !== 'string') return false;
    }
    return true;
  }

  var api = { capFor: capFor, setWinner: setWinner, matchWinner: matchWinner,
    serviceCourt: serviceCourt, newMatch: newMatch, pointWon: pointWon,
    scoreLine: scoreLine, validateName: validateName, validateImport: validateImport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BadmintonLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
