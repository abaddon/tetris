# QA Report — Sprint 03 Story 05
Date: 2026-05-12
Commits reviewed: 2a04d1d (WS layer), 8042a47 (lobby redirect), HEAD (AC-7 leaderboard fix)
Verifier: qa-engineer

---

## Story 05 — Real-time move synchronisation between two players

### verify.sh

PASS — `43 passed, 0 failed` (pure-logic) + `76 passed, 0 failed` (integration). Both suites green.

---

### AC-1: Move appears on opponent's board without page reload

PASS — `match-hub.js:_move` validates and applies the move server-side via `play()`, then calls `_broadcastState(match)` which iterates the room and sends a `match.state` message to every subscriber. Integration tests confirm: after alice sends `{ type: 'move', cell: 0 }`, both alice's queue and bob's queue receive `match.state` with `board[0] === 'X'` without any HTTP reload (`integration.js:390-398`).

### AC-2: Turn indicator updates atomically with the move — no window where both see it as their turn

PASS — The single `_broadcastState` call emits one `match.state` message per connected client, computed from the same `match.game` object (which has already been mutated to the next turn before broadcast). The `turn` field in `_stateMsg` is always `match.game.turn` (post-move). `game.html:renderState` reads `msg.turn` and enables cells only when `msg.turn === msg.you`. There is no intermediate state broadcast.

### AC-3: Only the active player can place a mark; out-of-turn clicks produce no state change

PASS — `match-hub.js:_move` checks `match.game.turn !== playerRole` and returns `{ type: 'error', message: 'Not your turn' }` without mutating `match.game`. Integration test: bob (O) sends a move when it's X's turn and receives `{ type: 'error' }` (`integration.js:405-407`). `game.html` cells are disabled client-side when `msg.turn !== msg.you`, but server-side enforcement is authoritative.

### AC-4: Win and draw evaluated authoritatively; result shown on both boards simultaneously

PASS — `match-hub.js:_move` uses `play()` from `shared/game.js` (the single source of truth). On `next.winner || next.draw`, it sets `match.status = 'ended'` then calls `_broadcastState(match)` followed by `_broadcast(match.code, { type: 'match.ended', ... })`. `game.html:renderState` handles `msg.winner` and `msg.draw` branches, showing `"<winnerName> wins!"` or `"Draw!"` and disabling the board on both clients simultaneously.

### AC-5: Both players offered "Rematch"; accepting on both sides starts new game with swapped X/O roles

PASS — After game ends, `game.html:renderState` shows `#rematch-btn`. Each player's click sends `{ type: 'rematch' }`. `match-hub.js:_rematch` sets `match.rematchReady.X/O` and broadcasts `match.rematch` (so the other player sees who is ready). When both are ready, it swaps `playerX`/`playerO`, resets `match.game = createGame()`, sets `status = 'active'`, and broadcasts the new `match.state`. `game.html:renderRematchTick` shows interim "Rematch: X ready / O ready" notices.

### AC-6: Disconnecting player's opponent sees clear notice; match abandoned without score change

PASS — `match-hub.js:_onClose` fires on `ws.close` or `ws.error`, sets `match.status = 'abandoned'`, and broadcasts `{ type: 'match.opponentLeft', code }` to the remaining room members. `game.html:handleMessage` case `'match.opponentLeft'` sets `noticeEl.textContent = 'Opponent disconnected'` and calls `disableBoard()`. Integration test: bob closes his socket; alice's queue receives `match.opponentLeft` (`integration.js:411-413`).

### AC-7: Sprint-02 scoring and leaderboard updated after multiplayer win or draw

PASS — `game.html:112-131` implements `loadLeaderboard`/`saveLeaderboard`/`recordWin` using the `tris_leaderboard` localStorage key — identical to the sprint-02 pattern. `recordWin` calls `awardWin(data, winnerName)` (from `shared/game.js` via `<script src="/game.js">`) and persists the result. It is called from `renderState:192` inside the `msg.winner` branch only — draws skip it entirely. A `_leaderboardUpdatedForMatch` flag (`game.html:114`) prevents duplicate writes on repeated `match.state` messages for the same ended game. The flag resets to `false` at `game.html:173` when a new active game begins (rematch), so subsequent games are recorded correctly.

### AC-8: All sprint-01 and sprint-02 verify.sh scenarios continue to pass

PASS — `verify.sh` reports `43 passed, 0 failed` for the full pure-logic suite. Zero regressions.

---

## Sprint-03 Story 05 Verdict: PASS

All six feature scenarios and all eight acceptance criteria are satisfied. `verify.sh` is fully green at 43 + 76 assertions.
