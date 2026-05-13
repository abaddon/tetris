# Sprint 05 — Single-Player Mode

## Summary

Tris players no longer have to wait for a human opponent. Sprint 05 ships
"Play vs Computer": one click from the lobby converts a waiting match into
a live single-player game, with the server driving the bot's moves
internally. Winning against the computer earns the same +1 leaderboard
point as a PvP win; the bot itself never touches the scoreboard.

## What Changed

- **"Play vs Computer" lobby button**: After creating a match, a new button
  appears in the match-waiting panel. Clicking it calls
  `POST /api/matches/:code/vs-computer` and navigates to the game board
  without waiting for a second human. (commit `d2d6da0`)
- **`POST /api/matches/:code/vs-computer` endpoint**: Auth-gated,
  owner-only endpoint that flips a waiting match to active by writing the
  bot sentinel `"__bot__"` to `match.playerO` via the existing
  `MatchStore.addOpponent` call. Returns `{code, role:"X", mode:"computer"}`
  on success; 401/403/404/409 on expected error cases. The sentinel is
  defined as a named constant `BOT_SENTINEL` in `server/index.js`. (commit
  `5ae98c0`, QA fix `40fe921`)
- **Server-side bot turn in `MatchHub`**: After applying a human move,
  `MatchHub._move` checks whether `playerO === BOT_SENTINEL` and the game
  is not terminal. If so, it immediately calls `firstEmptyCell(board)` —
  a new one-line export in `shared/game.js` — and re-enters `_move`
  synchronously in the same event-loop tick. No `setTimeout`, no fake
  WebSocket client, no new game-logic surface. Alice receives two
  `match.state` broadcasts per round-trip: one after her move, one after
  the bot's. (commit `0f1f58f`)
- **Single-player scoring guards (two layers)**: The hub skips
  `scoreStore.award()` entirely when `winnerUsername === BOT_SENTINEL`
  (primary guard). As defence-in-depth, `ScoreStore.award()` itself
  rejects any call where `usernameDisplay.toLowerCase() === '__bot__'`
  with `{code:"SENTINEL_REJECTED"}` — covers any future caller that
  bypasses the hub. Draws and bot wins award nothing, matching PvP
  behaviour. (commit `0f1f58f`)
- **Three-layer leaderboard exclusion**: `JsonlScoreStore.boot()` skips
  sentinel lines on replay; `topN()` drops sentinel keys from the
  in-memory map; and `GET /api/leaderboard` post-filters the result before
  sending JSON. Any single layer being correct is sufficient; all three
  being correct means a sentinel-on-leaderboard event requires simultaneous
  failure of independent code paths. (commit `a22b26b`)
- **UI polish in `game.html`**: The `__bot__` internal identifier is
  substituted with "Computer" in all status text. The Rematch button is
  hidden when `mode=computer` is in the URL query string (rematch is a
  two-human handshake; single-player rematch is deferred). "Waiting for
  opponent to join..." no longer appears once a single-player match is
  active. (commit `a22b26b`)
- **ADR-0008**: Documents the sentinel design, synchronous re-entry
  pattern, first-empty-cell strategy rationale, two-layer scoring gate,
  and three-layer leaderboard exclusion. Records the `BotStrategy` port
  hook for a future difficulty sprint without implementing it. (commit
  `cefdeaa`)

## What's Next

The first-empty-cell bot strategy is deliberately weak — sprint-06 is
the natural place to introduce a `BotStrategy` port and a smarter
implementation (random or minimax) if the product owner wants difficulty
levels. File compaction for `scores.jsonl` remains the other open item
from ADR-0007.

---

## Tweet (3 variants, pick one)

**Variant A** (features-first)
```
Tris sprint 05: you can now play tic-tac-toe without a second human.
Click "Play vs Computer" → the server moves the bot in the same tick
as your move. Win → +1 point. Bot never shows on the leaderboard.
First-empty-cell AI. Yes, you can beat it. Go on.
```
(245 chars)

**Variant B** (technical hook)
```
Sprint 05: MatchHub._move re-enters itself synchronously to play the
bot. No setTimeout, no fake WS, no new deps. BOT_SENTINEL="__bot__"
guarded at 2 scoring layers + 3 leaderboard filters. 89 unit +
114 integration tests green. Single-player Tris is live.
```
(258 chars)

**Variant C** (one-liner challenge)
```
Tris sprint 05: single-player mode shipped. Bot uses first-empty-cell
strategy. It's beatable. Leaderboard points are real. No excuses.
#nodejs #gamedev #claudecode
```
(162 chars)

---

## LinkedIn Post

**Tris sprint 05: play against the server, earn real leaderboard points.**

Sprint 05 adds single-player mode to our Node.js tic-tac-toe prototype. One click in the lobby flips your waiting match to active and puts the server in the opponent's seat. The bot runs entirely server-side — `MatchHub._move` re-enters itself synchronously after each human move, picks the first empty cell, and broadcasts both states in one round-trip. No new dependencies, no new game-logic surface beyond a one-liner `firstEmptyCell` helper in `shared/game.js`.

The bot uses an intentionally simple strategy so new players can get on the leaderboard while they learn the game. Scoring and exclusion rules are defence-in-depth: two guards prevent the bot from earning points, three independent filters keep it off the leaderboard. 5 stories, 89 unit tests, 114 integration tests. 🤖

---

## 30-Second Demo Script

**Title**: Tris Sprint 05 — Single-Player Mode

### Beat 1 — Lobby, pre-match (0s–6s)

**Shot**: Browser on `/lobby.html`. Player is logged in as "alice".
**Narration**: "This is the Tris lobby. Alice creates a match — normally
she'd wait here for a human opponent to join."
**On screen**: Alice clicks "Create match". The match-waiting panel
appears with a code and two buttons: "Copy code" and "Play vs Computer".

### Beat 2 — Entering the game (6s–14s)

**Shot**: Alice clicks "Play vs Computer". Browser navigates to
`/game.html?code=A3F7&role=X&mode=computer`.
**Narration**: "One click. No waiting. The server sets the bot as
opponent and the game is live immediately."
**On screen**: Game board appears. Opponent label reads "Computer". It is
Alice's turn (X). "Waiting for opponent..." is nowhere to be seen.

### Beat 3 — A round of play (14s–24s)

**Shot**: Alice plays cell 4 (center). The board briefly shows her X,
then almost instantly shows O at cell 0 — the bot's reply.
**Narration**: "Alice moves. The server computes the bot's reply in the
same event-loop tick and sends both state updates in one round-trip.
First empty cell — it's not hiding anything."
**On screen**: Two `match.state` WebSocket frames visible in DevTools
network panel, fired back-to-back.

### Beat 4 — Alice wins; leaderboard check (24s–34s)

**Shot**: Alice completes a winning row. Status reads "alice wins!"
Rematch button is absent. Cut to `/leaderboard.html`.
**Narration**: "Alice earns +1 point — same rule as PvP. The bot is
nowhere on the board. Three independent filters make sure of that."
**On screen**: Leaderboard shows "alice — 1 pt". No "__bot__" entry.

---

## Commit SHAs

| What | SHA |
|---|---|
| Lobby "Play vs Computer" button | `d2d6da0` |
| `POST /api/matches/:code/vs-computer` endpoint | `5ae98c0` |
| QA fix: bot-turn test gating | `40fe921` |
| Scoring sentinel guards (hub + ScoreStore) | `0f1f58f` |
| Leaderboard exclusion + game.html UI polish | `a22b26b` |
| ADR-0008 single-player mode design | `cefdeaa` |
