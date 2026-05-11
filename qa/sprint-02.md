# QA Report — Sprint 02
Date: 2026-05-11
Commit: fb2510c
Verifier: qa-engineer

---

## Story 02 — Player Names

### Scenario: Each player enters a name before the first move
PASS — `startEl` listener calls `resolveName(nameXEl.value, 'X')` / `resolveName(nameOEl.value, 'O')`, writes into `names.X`/`names.O`, and updates `labelXEl`/`labelOEl`. `renderStatus()` produces `nameFor(state.turn) + "'s turn"` which yields "Alice's turn". DOM wiring is correct.

### Scenario: Name field falls back to "Player X" / "Player O" when left blank
PASS — `resolveName('', 'X')` returns `'Player X'`; confirmed by unit test `resolveName: blank falls back to default X/O` (test.js:149-150). Label elements default to "Player X" / "Player O" in HTML (index.html:69-70).

### Scenario: Name is trimmed of leading and trailing whitespace
PASS — `resolveName` calls `.trim()` before checking length. Unit test `resolveName: trims whitespace` (test.js:151) confirms `'  Alice  '` → `'Alice'`.

### Scenario: Name longer than 20 characters is rejected at input
PASS — Both `<input>` elements carry `maxlength="20"` (index.html:60,64). The browser enforces the cap silently; no error overlay exists in the DOM.

### Scenario: Current player's name appears in the status line during play
PASS — `renderStatus()` uses `nameFor(state.turn)` for the in-progress branch, producing e.g. "Bob's turn" when it is O's turn and O is named "Bob".

### Scenario: Names persist when the Reset button is clicked mid-session
PASS — `resetEl` listener only does `state = createGame(); render()`. It does not touch `names`, `nameXEl.value`, `nameOEl.value`, or the label elements. After reset, `renderStatus()` reads from the unchanged `names` object, yielding "Alice's turn".

**Story 02 verdict: GREEN**

---

## Story 03 — Match Scoring

### Scenario: Winning player receives one point
PASS — `onClick` calls `applyResult(scores, state.winner)` on win; unit test `applyResult: X wins increments X` (test.js:159) confirms X score goes from 0→1. `renderScore()` formats as `names.X + ' ' + scores.X + ' – ' + names.O + ' ' + scores.O`, producing "Alice 1 – Bob 0". Status is "Alice wins!" via `renderStatus()`.

### Scenario: Draw awards no points to either player
PASS — `applyResult` is only called when `state.winner` is truthy (index.html:179-181); draws leave that branch unreached. Unit test `applyResult: draw leaves scores unchanged` (test.js:161) confirms null winner returns unchanged scores.

### Scenario: Score accumulates across multiple matches
PASS — `applyResult` is a pure accumulator: `applyResult({X:2,O:1}, 'X')` → `{X:3,O:1}`. Unit test `applyResult: accumulates across matches` (test.js:164) covers this.

### Scenario: Score resets to zero when a new session is started
PASS — `newSessionEl` listener sets `scores = { X: 0, O: 0 }` and clears `nameXEl.value = ''` / `nameOEl.value = ''` / resets `names` to defaults (index.html:215-225). `render()` then calls `renderScore()` which shows "Player X 0 – Player O 0".

### Scenario: Clicking "Reset" preserves the current scores
PASS — `resetEl` listener does not touch `scores` (index.html:210-213). After reset, `render()` calls `renderScore()` which reads the unchanged `scores` object.

**Story 03 verdict: GREEN**

---

## Story 04 — Leaderboard

### Scenario: Leaderboard is visible on the page at startup
PASS — `<div id="leaderboard-panel">` with `<h2>Leaderboard</h2>` and `<ol id="leaderboard-list">` are unconditionally in the HTML (index.html:79-82). No CSS hides them. `renderLeaderboard()` is called on page load (index.html:227) before any interaction.

### Scenario: Winning a match writes the winner's total to the leaderboard
PASS — `onClick` calls `addLeaderboardWin(nameFor(state.winner))` immediately after `applyResult` (index.html:181). `addLeaderboardWin` calls `awardWin`, `saveLeaderboard`, then `renderLeaderboard()` — all synchronous, no setTimeout. Unit tests `awardWin: first win creates entry` and `awardWin: second win accumulates` (test.js:174-178) confirm the accumulation logic.

### Scenario: Points accumulate for a returning player name
PASS — `awardWin(store, name)` uses `(next[name] || 0) + 1`, so an existing "Alice: 3" entry becomes "Alice: 4" on next win. Unit test `awardWin: second win accumulates` (test.js:176) covers this. `saveLeaderboard` overwrites the localStorage key, so no duplicate entry is created.

### Scenario: Leaderboard survives a page reload
PASS — On page load, `renderLeaderboard()` calls `loadLeaderboard()` which reads from `localStorage.getItem('tris_leaderboard')` and parses JSON. The key used is `LEADERBOARD_KEY = 'tris_leaderboard'` (index.html:88), matching the spec. Stored entries are rendered immediately.

### Scenario: Leaderboard shows at most the top 10 players
PASS — `renderLeaderboard()` calls `topN(data, 10)` which slices to 10 entries after sort (game.js:95). Unit test `topN: returns at most 10 entries` (test.js:196) confirms this with a 12-entry store.

### Scenario: Draw does not create or update a leaderboard entry
PASS — `addLeaderboardWin` is called only inside `if (state.winner)` (index.html:179). Draws set `state.draw = true` and `state.winner = null`, so the branch is not entered. `applyResult` with null winner also leaves scores unchanged (confirmed above).

### Scenario: Players tied on points are ordered alphabetically as a tiebreaker
PASS — `topN` sort comparator: when `b.pts === a.pts`, returns `a.name < b.name ? -1 : 1` (game.js:93), producing ASC alphabetical order. Unit test `topN: ties broken alphabetically ASC` (test.js:192) confirms "Alice" appears before "Carol" when both have 5 points.

**Story 04 verdict: GREEN**

---

## Sprint-02 Verdict: GREEN

All 21 scenarios across stories 02, 03, and 04 pass. `verify.sh` reports 43/43 tests green (sprint-01 baseline fully intact). No regressions detected.
