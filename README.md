# Badminton Scorer BD

Offline, bilingual (English / বাংলা) badminton scoreboard for Bangladeshi courts.
Rally scoring with proper set and match rules — no account, no network, runs
entirely in the browser. Data (live match + finished-match history) persists in
`localStorage` on the device.

## Problem

Casual badminton games in Bangladesh are scored on paper or from memory, and
arguments about deuce, service courts, and "who won the set" are routine. This
is a pocket scoreboard that enforces the rules so players can focus on the game.

## Features

1. **Match setup** — player names, best of 1 / 3 / 5, and 21 / 15 / 11 points per set.
2. **Rally scoring** — big point buttons; a set is won by 2 clear points, capped
   at 30 (21-point), 21 (15-point), or 15 (11-point) points.
3. **Service indicator** — shows who serves next (the rally winner) and whether
   they serve from the right court (even own score) or left court (odd own score).
4. **Match controls** — undo last point (including undoing a match-winning
   point, which also removes its history row), swap sides, end a match early,
   live elapsed timer, and set-score history.
5. **Finished-match history** — every completed match is recorded with set scores
   and date, and survives reloads.
6. **Data tools** — JSON export of history, strict-validated JSON import
   (malformed files are rejected with data intact), and typed-`DELETE` erase-all.
7. **Bilingual UI** — English / বাংলা toggle, persisted, with Bengali digits in
   scores and stats when বাংলা is active. Fully responsive down to 390 px.

## Stack

Vanilla HTML + CSS + JavaScript. No framework, no build step, no network calls.
The scoring engine (`js/logic.js`) is dependency-free and shared between the app
and the Node unit tests.

## Prerequisites

Any modern browser. For tests: Node.js 18+.

## Install

No install step — open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Development commands

```sh
node tests/logic.test.js   # 13 Node unit tests for the scoring engine
node smoke.mjs             # 33 headless-Chromium (CDP) checks: desktop + 390 px mobile
```

## Environment

None. There are no secrets, API keys, or backend services.

## Testing

- `tests/logic.test.js` — 13/13 pass: set-win rules (including deuce and all
  three caps), match-win thresholds, service-court parity, server-follows-winner,
  name/import validation, and a full 11-point game.
- `smoke.mjs` — 33/33 pass: setup validation, point/undo/swap, a full 21–0,
  21–0 best-of-3 match to the match-over banner and history row, বাংলা toggle
  with Bengali digits, language + live-match reload persistence, strict import
  validation, zero network requests, zero console errors, and no horizontal
  overflow at desktop and 390 px.

## Deployment

Static site — any static host works. The factory deploys it to GitHub Pages
(`main` branch, root).

## Limitations

- Single-device: matches and history live in the browser's `localStorage` and do
  not sync across devices.
- New sets always start with Player A serving (a documented house rule — in
  formal play the winner of the previous set serves first; the app does not track
  that distinction).
- End-match-early only records a history row when at least one set is complete
  and the set count is not tied; otherwise the match is simply abandoned.
- Educational scoreboard, not affiliated with BWF or any federation.

## Status

Complete MVP. All tests green; published and verified live (see ledger).
