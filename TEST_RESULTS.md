# TEST RESULTS — badminton-scorer-bd (run #193, 16:00 slot, 2026-10-31)

## Unit tests (Node): 13/13 passed
`node tests/logic.test.js` — set-win rules incl. deuce (21-20 not won, 22-20 won),
caps (30-29, 21 for 15-point, 15 for 11-point), match-win thresholds (best of 1/3),
service-court parity, server-follows-rally-winner, bad-player / finished-match
rejection, name boundaries, strict import validation (wrong kind, unfinished set,
bad bestOf, null, string), full 11-point game.

Repairs during unit testing (2 test-side fixes, 0 app-logic bugs):
- Cap-path test first played all of one side's points, which ends the set at
  21-0 before 29-29 can occur; rewrote to interleave to 20-20 first.
- Same test then played 9 straight points from 20-20, which wins 22-20; rewrote
  to strict alternation to 29-29, then the cap point.
- One expectation fix: 15-14 at an 11-point target IS a win (cap 15: first to 15
  wins), while 15-14 at a 15-point target is not (needs 2 clear below cap 21).

## Headless-Chrome smoke (raw CDP, /opt/meta-chromium/chrome): 33/33 passed
`node smoke.mjs` — desktop 1280px + 390px mobile, 0 console/page errors,
0 network requests, no horizontal overflow on any tab at either width.
Verified: setup validation (empty names rejected inline), server line
(Rahim, right court at 0), point 1-0, undo 0-0, swap sides both ways,
21-0 set win with score reset and set-scores line, second 21-0 set to the
match-over banner + disabled point buttons + history row, বাংলা toggle
(html lang=bn, Bengali title, score 2 renders as ২), bms_lang persistence,
language + live-match reload persistence, data panel, validateImport rejection,
and 390px overflow on all 3 tabs.

Harness note: this VM's Chromium refuses to start without Hatch WebGL
domain-policy flags; smoke.mjs passes `--hatch-webgl-allowed-domains-file` +
`--hatch-webgl-allowed-domains-sha256` computed from
`/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt`
(same pattern as geometry-calc-bd / bingo-bd).

## Source hygiene
All shipped sources are pure ASCII: Bengali strings in js/i18n.js are \uXXXX
escapes (build-time escape step, verified by decoding in node: title renders
ব্যাডমিন্টন স্কোরার বিডি, digits 21-19 render ২১-১৯); grep -P non-ASCII over
js/, index.html, style.css, tests/ returns zero matches.

## Publish
(Recorded after push/Pages verification — see ledger row.)
