# QA Report — Sprint 03 Story 04
Date: 2026-05-12
Commits reviewed: 76616c0 (story 04), 2a04d1d (story 05 — game.html, WS layer, and lobby redirect added)
Verifier: qa-engineer

---

## Story 04 — Join an existing match by entering a code

### verify.sh

PASS — `43 passed, 0 failed` (pure-logic) + `76 passed, 0 failed` (integration). Both suites green.

---

### AC-1: Join field and "Join Match" action available to authenticated lobby users

PASS — `lobby.html:58-63` contains `#join-code` input and `#join-btn` ("Join match") unconditionally in `#lobby-section`. The lobby requires authentication. Integration test asserts 401 without session.

### AC-2: Valid code admits joiner as Player O; both players transition to game board

PASS — Server-side join returns 200 + `role:'O'` + `opponent`. `lobby.html:125` redirects Bob to `/game.html?code=…&role=O`. Alice's create-match handler at `lobby.html:98` redirects her to `/game.html?code=…&role=X` on success. `game.html` exists (commit 2a04d1d), opens a WS connection, sends `{ type: 'subscribe', matchCode }`, and renders the live board. Both players reach the game board.

### AC-3: Alice's waiting screen updates automatically when Bob joins — Alice does not need to reload

PASS — Alice is redirected to `game.html` immediately after match creation, where she subscribes over WS. `match-hub.js:_subscribe` adds her to the room and sends `match.state` with `status: waiting`. When Bob subsequently joins via HTTP and then subscribes over WS, `match-hub._subscribe` broadcasts a fresh `match.state` (with `status: active` and `playerO` set) to all existing room members — including Alice's socket — without any reload. `game.html:renderState` then renders the active board and enables Alice's cells.

### AC-4: Unknown code produces "Match not found"

PASS — 404 + exact message; confirmed by integration test.

### AC-5: Full match produces "Match is already full"

PASS — 409 + exact message; confirmed by integration test.

### AC-6: Self-join rejected with "You cannot join your own match"

PASS — 409 + exact message; confirmed by integration test.

### AC-7: Match code lookup is case-insensitive

PASS — `match-store.js` stores and looks up by `code.toUpperCase()`; `lobby.html` calls `.toUpperCase()` client-side; integration test joins with lowercase and asserts 200 + `role:'O'`.

### AC-8: Sprint-01 and sprint-02 verify.sh scenarios continue to pass

PASS — `verify.sh` reports `43 passed, 0 failed`. Zero regressions.

---

## Sprint-03 Story 04 Verdict: PASS

All six feature scenarios and all eight acceptance criteria are satisfied. `verify.sh` is fully green at 43 + 76 assertions. Note: AC-2 and AC-3 depend on the WS infrastructure and `game.html` delivered in commit 2a04d1d (story 05), which is the intended delivery order.
