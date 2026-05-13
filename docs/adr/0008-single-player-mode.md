# ADR-0008: Single-player mode — server-side bot participant

**Status**: accepted
**Date**: 2026-05-13
**Stories**: sprint-05/01-lobby-vs-computer-button, sprint-05/02-vs-computer-endpoint, sprint-05/03-match-hub-bot-turn, sprint-05/04-single-player-scoring-rule, sprint-05/05-leaderboard-exclusion-and-ui-polish

## Context

Sprint-05 introduces a "Play vs Computer" flow so a lone logged-in user
can play Tris without waiting for a human opponent. The product owner
has already decided several shape constraints:

- The bot is addressed by a reserved sentinel username `__bot__` stored
  in `match.playerO`.
- A new `POST /api/matches/:code/vs-computer` endpoint flips a waiting
  match to active with `playerO = "__bot__"`.
- The bot must play through `MatchHub` (not the client) so it cannot be
  cheated by a tampered browser.
- The bot's score must never appear on the leaderboard.
- Rematch (a two-human protocol) is not supported in single-player.

Existing decisions this ADR must respect:

- ADR-0006: `shared/game.js` is the only authority for legal moves
  (`play(state, cell)`) and terminal detection. The server must not
  invent a new game-logic surface.
- ADR-0007: `ScoreStore.award` is called from `MatchHub._move` exactly
  once per terminal `match.ended` where `next.winner` is set. The
  `if (match.status !== 'active')` guard is the sole idempotency mechanism.
- ADR-0004: `UserStore.create` validates `username` against
  `^[A-Za-z0-9_]+$`. The regex **does** allow the literal string
  `__bot__` to be typed at registration — the sentinel is therefore
  collision-prone unless we add a defence-in-depth guard at register.

The constraint that drives this ADR's shape: the bot must not be a
WebSocket connection. We already have a single-threaded Node hub that
owns `match.state`; the bot's "decision" is a pure function over the
board. Spinning up a fake WS client to play the bot would multiply the
moving parts without buying us anything.

## Decision

### 1. Bot identity — accept the `__bot__` sentinel with a register-time guard

We ratify the PO's choice of the literal string `"__bot__"` (lowercase,
two leading + two trailing underscores) as the canonical bot identity.
The sentinel is stored in `match.playerO` exactly like a human username
so that `addOpponent`, `applyMove`, role resolution, and broadcast
fan-out all work without modification.

Why this is safe:

- `^[A-Za-z0-9_]+$` permits `__bot__` as a typeable username, so the
  sentinel is **not** intrinsically unforgeable by the schema. We
  therefore add a **defence-in-depth guard** at `UserStore.create`:
  reject any `usernameDisplay` whose `toLowerCase() === '__bot__'` with
  `{code:"VALIDATION", field:"username", message:"Reserved name"}`.
  Wave-3 dev for story 02 owns the change; story 02's existing AC-6
  ("sentinel defined as a named constant in `server/index.js`") is the
  natural place to import and re-use the constant inside `UserStore`.
- The sentinel never appears as a display name to the human: story 05
  AC-5 substitutes "Computer" in the UI. Even if a future change leaks
  the raw value, it never lands on the leaderboard (see scoring gate
  below).
- The chosen string is intentionally ugly (`__bot__` with the
  double-underscore convention Python and JS both treat as "internal")
  so an operator skimming `data/users.jsonl` or `data/scores.jsonl`
  recognises it instantly.

We do **not** reject the PO's choice. No deviation to story-04 / story-05
sentinel references.

### 2. Bot turn — synchronous re-entry inside `MatchHub._move`

After applying the human move and broadcasting `match.state` (and
**before** returning from `_move`), the hub checks:

```
if (match.playerO === BOT_SENTINEL
    && match.status === 'active'
    && !next.winner
    && !next.draw
    && next.turn === 'O') {
  this._move(matchCode, BOT_SENTINEL, firstEmptyCell(next.board));
}
```

That is: the hub **re-enters its own `_move` method** with the bot as
the asserting participant and the bot's chosen cell. The re-entry runs
to completion in the same synchronous event-loop turn as the human
move; the call stack on `match.ended` for a bot-winning game is
`_move(human) -> _broadcastState -> _move(bot) -> _broadcastState -> _broadcastEnded`.

**The state between the two `_move` calls.** After the human move:
`match.status === 'active'` (the human move did not end the game by
the guard above), `state.turn === 'O'`, the board reflects the human's
mark, and the first `match.state` broadcast has already been sent on
the wire to alice's socket. The `active` status is preserved precisely
so that the re-entrant `_move` call passes its own
`if (match.status !== 'active') reject` guard. We do **not** add a new
"bot-turn-in-progress" status; the existing `active` covers it and
makes the re-entry observationally indistinguishable from a real
human's move arriving on a second WS.

**Why synchronous re-entry, not `setImmediate` or a client-driven bot.**

- `setImmediate` / `setTimeout(0)`: would force the hub to track
  "pending bot turn" state across event-loop turns, opening a window
  in which alice could send a second `move` message and have the hub
  reject it on the `turn === 'X'` check while the bot's turn is still
  queued. The story 03 AC-1 explicitly demands the bot moves before
  `_move` returns; deferral violates that AC.
- Client-driven (browser plays the bot): would require shipping the
  strategy and `BOT_SENTINEL` to the client, and the hub would need
  to trust a bot move coming from alice's authenticated socket. That
  breaks the "server is the source of truth" invariant from ADR-0002
  and ADR-0006 and makes the bot trivially cheatable.

The single tradeoff of synchronous re-entry is that alice's socket
sees two `match.state` broadcasts inside one round-trip; the client
must already handle a stream of state messages (sprint-03 story 05),
so this is free.

### 3. Bot strategy — `firstEmptyCell(board)` as a pure helper in `shared/game.js`

We add **one** new export to `shared/game.js`:

```
firstEmptyCell(board) -> integer in [0..8]  // throws if board is full
```

Implementation: `board.findIndex(c => c === null)`. That's it.

Justification:

- **Deterministic.** Same board in, same cell out. Unit tests assert
  exact cell values; no flakiness.
- **Trivially testable.** One line of logic, three obvious cases
  (empty board → 0, partial board → first null, full board → throw).
  The story 03 AC-2 test ("first empty cell") is one assertion.
- **Low cognitive load.** A developer reading `MatchHub._move` sees
  `firstEmptyCell(board)` and instantly understands what the bot
  will do. No `Math.random`, no minimax, no priority table.
- **Lives in `shared/game.js`** because (a) it operates on the
  board shape that already lives there, (b) ADR-0006 forbids
  duplicating game-shape logic outside `shared/`, and (c) it makes
  the helper trivially reachable from `test.js`.

**Future-extension hook (NOT implemented this sprint).** When a real
strategy (random, minimax, learned) is wanted, the right shape is a
`BotStrategy` port:

```
chooseCell(state) -> integer in [0..8]
```

with `FirstEmptyCellStrategy` as the wave-3 implementation under a
different name. We deliberately do **not** introduce that port this
sprint: with exactly one strategy and one consumer (`MatchHub._move`),
the port is over-engineering. Section 10 of `ports-and-adapters.md`
records the hook so a future dev knows where to look.

### 4. Scoring gate — defence-in-depth at two layers

The bot must never receive a leaderboard point. We enforce this at two
independent code paths:

**Layer A — `MatchHub._move`** (primary).

```js
if (next.winner) {
  const winnerUsername = next.winner === 'X' ? match.playerX : match.playerO;
  if (winnerUsername !== BOT_SENTINEL) {
    this._scoreStore.award(winnerUsername).catch(console.error);
  }
}
```

This is the only call site in production. If the strategy returns a
bot win, the hub never calls `award`.

**Layer B — `ScoreStore.award` itself** (defence-in-depth).

```js
async award(usernameDisplay) {
  if (usernameDisplay.toLowerCase() === '__bot__') {
    console.warn('[score-store] refusing to award sentinel:', usernameDisplay);
    return Promise.reject({ code: 'SENTINEL_REJECTED', name: usernameDisplay });
  }
  // ... existing body
}
```

The rejected Promise carries the structured code so callers (and tests)
can distinguish it from disk-write failures. Story 04 AC-5's existing
`.catch(console.error)` pattern in `MatchHub` absorbs the rejection
without crashing the hub.

**Why two layers and not one?** The hub-level guard is the contract
boundary today. The store-level guard is a contract about the data:
*nothing the store accepts will ever credit the sentinel.* A future
caller wiring `scoreStore.award` directly (a CLI tool, an admin
endpoint, a migration script) inherits that guarantee without re-
reading the hub. Costs: one string comparison per call (zero
measurable latency), six lines of code. Cheap insurance.

Note the lowercase-compare: story 04 AC explicitly demands
case-insensitive rejection so `"__BOT__"`, `"__Bot__"`, and any other
casing all fail.

### 5. Leaderboard exclusion — three independent filters

`__bot__` must not appear in `GET /api/leaderboard` or the rendered
page. We filter at **three** layers, deliberately redundant:

1. **Boot replay.** `JsonlScoreStore.boot()` (replay loop) skips any
   line whose `record.usernameLower === '__bot__'`. Historical
   malformed records never enter the in-memory map.
2. **`topN`.** `JsonlScoreStore.topN()` filters its own in-memory map,
   dropping any entry whose key `.toLowerCase() === '__bot__'`, before
   handing the projection to `shared/game.js#topN`.
3. **HTTP handler.** `GET /api/leaderboard` calls
   `scoreStore.topN(10)` and `.filter(e => e.username.toLowerCase() !== '__bot__')`
   on the result before sending JSON.

**Why three filters when one would suffice?** The depth metric is the
number of independent code paths through which the sentinel could
leak: (a) a malformed historical line bypassing the award guard, (b)
an in-memory entry seeded by some future code path that does not go
through `award`, (c) a future caller calling `topN` without filtering.
Three filters = the leaderboard is bot-free as long as **any one** of
the three layers is correct. The cost is three trivial array/string
comparisons over at most ten elements; the latency is unmeasurable.

This is the same belt-and-suspenders posture the project already takes
on session validation (`SessionStore.lookup` is checked at every HTTP
auth point AND at WS upgrade).

### 6. Rematch in single-player — explicitly refused at the hub

When alice's socket sends `{type:"rematch", matchCode}` for a single-
player match, `MatchHub._rematch` short-circuits:

```js
if (match.playerO === BOT_SENTINEL) {
  this._transport.sendTo(conn, {
    type: 'error',
    message: 'Rematch not available in single-player'
  });
  return;
}
```

No `MatchStore.requestRematch` call, no broadcast, no state mutation.

Justification:

- Rematch is a *two-human-ready handshake* (sprint-03 story 06); the
  bot has no ready-state to signal.
- Story 05 AC-6 already requires the client to hide the Rematch button
  when `mode=computer`. The hub-side check is defence-in-depth against
  a tampered client that re-shows or fakes the button.
- The "fresh match" alternative (auto-create a new vs-computer match
  on rematch click) is a UX call that belongs in a later sprint; the
  PO has explicitly deferred it.

## Consequences

- positive:
  - Zero new external dependencies; zero new ports; one new pure
    helper in `shared/game.js`.
  - The bot is observationally indistinguishable from a human
    `move` arrival at the `MatchHub._move` boundary — the same code
    path validates the turn, applies the move, broadcasts, and
    handles terminal states. That keeps the surface area we test
    small.
  - Three filters + one award-side guard + one hub-side guard make
    the sentinel-on-leaderboard failure mode a "two defences must
    fail simultaneously" event.
  - Synchronous re-entry means the human-move + bot-move pair is one
    atomic operation from the perspective of the rest of the hub;
    there is no half-state visible to a concurrent rematch / close
    / subscribe.

- negative:
  - The sentinel string is typeable in usernames. We mitigate at
    `UserStore.create` but the mitigation is a string compare in one
    place — a developer deleting that line silently re-opens the
    collision. The store-level award guard and three leaderboard
    filters limit the blast radius.
  - `_move` calling itself recursively (one level deep) is unusual.
    The base case (`match.playerO !== BOT_SENTINEL` OR the move ended
    the game) is statically obvious; we document it inline in the
    `MatchHub._move` JSDoc so a future reader does not flag it as a
    bug.
  - Two `match.state` broadcasts per human move on a single-player
    game means the client briefly sees an "interim" board (alice's
    mark, bot's turn) before the bot's mark lands. The client-side
    renderer already handles a stream; no special pacing or
    de-duplication is required.

- neutral:
  - The `BotStrategy` port is deferred. If sprint-06 ships "easy /
    medium / hard" difficulty, that's the first ADR to write.
  - `__bot__` records on disk are intentionally skipped on replay
    (layer 1), so a sentinel record on disk is harmless but also
    invisible to operations. A future compaction ADR (ADR-0007
    forward-looking note) should strip them at compact time.

## Ports / Adapters (or modules)

- `firstEmptyCell(board)` — pure helper, new export in
  `shared/game.js`. Consumers: `MatchHub._move`. Implementations: one
  (`shared/game.js`). Not a port; a pure function.
- `BotStrategy` (future, **out of scope this sprint**): port shape
  `chooseCell(state) -> int`. Documented in `ports-and-adapters.md`
  section 10 only; no code.
- `UserStore.create` — extended (story 02 wave-3 dev): reject
  `usernameDisplay.toLowerCase() === BOT_SENTINEL`. No new method.
- `MatchHub._move` — extended: synchronous re-entry when
  `playerO === BOT_SENTINEL` and game is not terminal; skip
  `scoreStore.award` when `winnerUsername === BOT_SENTINEL`.
- `MatchHub._rematch` — extended: refuse with error message when
  `match.playerO === BOT_SENTINEL`.
- `ScoreStore.award` (both adapters) — extended: reject
  `usernameDisplay.toLowerCase() === '__bot__'` with
  `{code:'SENTINEL_REJECTED', name}`.
- `JsonlScoreStore.boot` — extended: skip lines with
  `record.usernameLower === '__bot__'`.
- `JsonlScoreStore.topN` and `InMemoryScoreStore.topN` — extended:
  drop sentinel keys from the in-memory map before delegating to
  `shared/game.js#topN`.
- `GET /api/leaderboard` HTTP handler — extended: post-filter the
  store output to drop sentinel entries before JSON-encoding.
- New endpoint: `POST /api/matches/:code/vs-computer`. Auth-gated;
  owner-only (403 otherwise); 404 on missing; 409 if not `waiting`;
  on success calls `MatchStore.addOpponent(code, BOT_SENTINEL)` and
  returns `{code, role:'X', mode:'computer'}`.

## Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Ab as Alice (browser)
    participant H as HTTP
    participant W as WS / MatchHub
    participant M as MatchStore
    participant G as shared/game.js
    participant S as ScoreStore

    Note over Ab,H: --- Flip waiting -> single-player ---
    Ab->>H: POST /api/matches/A3F7/vs-computer (sid cookie)
    H->>H: lookup(sid)="alice", verify owner=alice
    H->>M: addOpponent("A3F7", "__bot__")
    M-->>H: Match (status:"active", playerO:"__bot__")
    H-->>Ab: 200 {code, role:"X", mode:"computer"}
    Ab->>W: subscribe matchCode:"A3F7"
    W-->>Ab: match.state (turn:X, you:X)

    Note over Ab,W: --- Alice plays; bot replies in same tick ---
    Ab->>W: {type:"move", cell:4}
    W->>W: _move(alice, 4) — guard active OK
    W->>M: applyMove("alice", 4)
    M->>G: play(state, 4) -> next (turn:O, no winner)
    M-->>W: Match
    W-->>Ab: match.state (X@4, turn:O)
    W->>W: playerO==="__bot__" && status==='active' && !winner && !draw
    W->>G: firstEmptyCell(next.board) -> 0
    W->>W: _move("__bot__", 0)  [synchronous re-entry]
    W->>M: applyMove("__bot__", 0)
    M->>G: play(state, 0) -> next2 (O@0, turn:X)
    M-->>W: Match
    W-->>Ab: match.state (O@0, X@4, turn:X)

    Note over Ab,W: --- Several moves later, alice wins ---
    Ab->>W: {type:"move", cell:N}
    W->>M: applyMove("alice", N)
    M->>G: play -> next (winner:"X")
    M-->>W: Match (status:"ended")
    W->>W: winnerUsername = "alice" (!= "__bot__")
    W->>S: award("alice")
    S-->>W: Promise resolves
    W-->>Ab: match.state (final)
    W-->>Ab: match.ended {winner:"X"}

    Note over Ab,W: --- If the bot had won instead ---
    Note right of W: winnerUsername = "__bot__" -> award SKIPPED at hub;<br/>even if called, ScoreStore.award rejects SENTINEL_REJECTED.

    Note over Ab,W: --- Rematch is refused ---
    Ab->>W: {type:"rematch", matchCode:"A3F7"}
    W->>W: match.playerO === "__bot__"
    W-->>Ab: {type:"error", message:"Rematch not available in single-player"}
```
