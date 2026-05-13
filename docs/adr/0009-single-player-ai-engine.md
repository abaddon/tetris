# ADR-0009: Single-player AI engine — pluggable strategy portfolio

**Status**: proposed
**Date**: 2026-05-13
**Stories**: sprint-06/01-bot-strategy-port, sprint-06/02-five-difficulty-strategies, sprint-06/03-difficulty-picker-ui, sprint-06/04-api-difficulty-field, sprint-06/05-strategy-performance-nfr, sprint-06/06-leaderboard-integrity-regression

## Context

Sprint-05 (ADR-0008) shipped single-player Tris with one bot strategy:
`firstEmptyCell(board)`. ADR-0008 §3 deliberately did **not** introduce
the `BotStrategy` port — at one strategy and one consumer, the port
would have been over-engineering. The same ADR records the hook in
`ports-and-adapters.md` §10 so a future sprint knows where to look.

Sprint-06 cashes that promise. The product owner wrote six stories
that, taken together, demand:

- Six difficulty levels — `trivial`, `easy`, `medium`, `hard`,
  `expert`, `showcase` — surfaced as a UI picker (story 03), persisted
  to `localStorage`, transmitted on the existing `vs-computer`
  endpoint (story 04), stored on the `Match` record, and resolved at
  bot-turn time inside `MatchHub` (story 01).
- Meaningfully different playing strength per tier: uniform random
  (Easy), 1-ply win/block + weighted heuristic (Medium), depth-limited
  minimax (Hard), full alpha-beta minimax (Expert), UCT MCTS
  (Showcase). The legacy `firstEmptyCell` becomes the `trivial`
  baseline so sprint-05 behaviour is preserved verbatim.
- Every strategy hits a 50 ms budget per `chooseCell` call (story 05),
  measured in the `verify.sh` suite.
- Zero leaderboard regression: bot wins at any difficulty remain
  excluded by every sprint-05 sentinel layer (story 06).

Existing decisions this ADR must respect:

- **ADR-0006**: `shared/game.js` is the only authority for `play`,
  `detectWinner`, `WIN_LINES`, `firstEmptyCell`. Strategies consume
  these primitives; they do not re-implement them.
- **ADR-0008** §3: `firstEmptyCell(board)` already exists as a pure
  export of `shared/game.js`. It survives intact, wrapped by the
  `trivial` strategy adapter.
- **ADR-0008** §4–§5: The sentinel scoring guard at `MatchHub._move`
  and the three-layer leaderboard filter are unchanged. Strategy
  dispatch must not bypass them; story 06 is the regression contract.
- **ADR-0002**: Server is the source of truth. Strategies run
  server-side. The client never asserts a bot move; it only requests
  a difficulty.

The constraints that drive the shape of this ADR:

1. **Tic-tac-toe is solved.** The full game tree has at most 5,478
   reachable terminal positions. Alpha-beta minimax fits comfortably
   in single-digit milliseconds on a laptop. We do **not** need
   transposition tables, iterative deepening, opening books, or a
   web worker. We do need a hard 50 ms timeout (story 05) as
   belt-and-braces against pathological cases on slow CI runners.
2. **Six strategies, one consumer, one call site.** `MatchHub._move`
   is the only place that asks for a bot move. The port keeps the
   hub strategy-agnostic; the registry keeps the wiring out of the
   hub constructor.
3. **No new dependencies.** Pure JS, Node 18+, no external libraries.
4. **Shared module placement.** Strategies are pure functions over
   game state; they have no dependency on `server/` or `public/`.
   Placing them under `shared/ai/` keeps a future client-side hint
   mode (a "suggest a move" button) one `require` away.

## Decision

### 1. Formalise the `BotStrategy` port

A `BotStrategy` is any object — class instance or plain module —
exposing a single method:

```
BotStrategy.chooseCell(state: GameState, mark: 'X' | 'O') -> number  // integer in [0..8]
```

Contract:

- `state` is the live `match.game` shape from `shared/game.js`:
  `{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }`.
- `mark` is the strategy's own mark on this turn. It is provided
  explicitly (rather than read from `state.turn`) so a strategy
  written for "always the bot" can be unit-tested as either side
  without rebuilding the state.
- Return value is an integer index `0..8` where `state.board[i] === null`.
  If no legal cell exists, the strategy MAY return `-1` OR throw
  `Error('no legal move')`. The caller (`MatchHub`) handles both.
- The function is pure — no I/O, no network, no mutable shared state
  outside the call stack. `Math.random` is permitted (Easy, Medium,
  Showcase rely on it); no seeding is required.

The signature is intentionally minimal. We considered an async return
(`Promise<number>`) and rejected it: 3×3 strategies all finish in
sub-ms, the existing `_move` is synchronous, and forcing every
strategy into a Promise inflates test ergonomics with no payoff.

### 2. Strategy registry keyed by difficulty enum

A small registry maps the canonical difficulty string to a
`BotStrategy` instance:

```
type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'expert' | 'showcase';

registry: Map<Difficulty, BotStrategy>;

registry.get(difficulty: string) -> BotStrategy   // unknown -> TrivialStrategy + console.warn
registry.list() -> Difficulty[]                   // for UI / validation
```

`MatchHub` is constructed with — or constructs internally as a sane
default — a `strategyResolver: (difficulty: string) => BotStrategy`.
The resolver:

- Lower-cases the input.
- Returns the matching strategy.
- For unknown / null / missing input, falls back to the `trivial`
  strategy AND emits `console.warn('[match-hub] unknown difficulty: %s — using trivial', difficulty)`.
  This matches story 04 AC-5 (`The resolver must never throw; unknown
  difficulty falls back to FirstEmptyCellStrategy with a console.warn`).

The registry lives in `shared/ai/strategy.js` so it is importable from
both `server/` and (future) `public/`.

### 3. File layout (proposed — wave 3 implements)

```
shared/
  ai/
    strategy.js              // port docs + registry + resolver factory
    strategies/
      trivial.js             // wraps shared/game.js#firstEmptyCell
      random.js              // EasyStrategy: uniform random from empty cells
      heuristic.js           // MediumStrategy: win/block scan + weighted (center 4, corner 2, edge 1)
      minimax.js             // HardStrategy: depth-limited (default 3), discounted eval
      minimax-ab.js          // ExpertStrategy: full minimax + alpha-beta pruning
      mcts.js                // ShowcaseStrategy: UCT, default 500 iters, c = √2, random rollout via random.js
    index.js                 // public surface: { createRegistry, DIFFICULTIES, BotStrategy (jsdoc type) }
```

Notes on the split:

- `trivial.js` is **separate** from `random.js`. `trivial` is the
  legacy `firstEmptyCell` adapter; `random` is the Easy tier
  (uniform over empty cells). Sprint-05 behaviour stays bit-exact
  under `trivial`.
- `heuristic.js`, `minimax.js`, `minimax-ab.js`, `mcts.js` are each
  one file with one default export plus named exports for
  testability (e.g. `evaluate`, `minimax`, `mcts.uctSelect`).
- `index.js` is the only file `server/` imports. It exports
  `createRegistry()` (returns a populated `Map`) and `DIFFICULTIES`
  (the canonical array, used by `server/index.js` for the
  validation gate in story 04 AC-2 and by `public/lobby.html` for
  the `<select>` options in story 03 AC-1).
- Each strategy file imports only `shared/game.js` and (for
  `mcts.js`) `./random.js`. No circular dependencies.

This layout maps cleanly to wave-3 parallel work (one developer per
strategy file, plus one developer for the registry and hub wiring).

### 4. Server / match-hub wiring

`server/match-hub.js` becomes strategy-agnostic:

```js
const { createRegistry } = require('../shared/ai');

class MatchHub {
  constructor(matchStore, sessionStore, scoreStore, strategyResolver) {
    // ... existing ...
    this._strategyResolver = strategyResolver || defaultResolver(createRegistry());
  }

  _move(ws, client, cell) {
    // ... existing human-move handling ...
    if (match.status === 'active' && !next.winner && !next.draw
        && match.playerO === BOT_SENTINEL && next.turn === 'O') {
      const strategy = this._strategyResolver(match.difficulty);  // never throws
      let botCell;
      try { botCell = strategy.chooseCell(next, 'O'); }
      catch (err) { console.error('[match-hub] strategy threw', err); return; }
      if (botCell === -1 || next.board[botCell] !== null) {
        console.error('[match-hub] strategy returned illegal cell', botCell); return;
      }
      // ... existing apply-bot-move + score + broadcast ...
    }
  }
}
```

The sentinel scoring guard from ADR-0008 §4 is **unchanged**: the
`if (winnerUsername !== BOT_SENTINEL)` check sits one layer above the
strategy dispatch and is therefore strategy-agnostic by construction
(story 06 AC-1).

### 5. Persisting difficulty on the match

`match.difficulty` becomes a first-class field on the `Match` record,
written exactly once at `addOpponent` time. The validated string is
stored verbatim (lowercase). Legacy matches (sprint-05) created
without a difficulty field are treated as `'trivial'` at bot-turn
time — `match.difficulty || 'trivial'` in `MatchHub._move`. This
preserves sprint-05 behaviour for any in-flight match at the moment
of deploy.

**Decision: store on the match record, not per-request.** Two
reasons: (a) the bot turn happens N moves after the HTTP request,
so the difficulty must already be persisted somewhere the hub can
reach; (b) the `MatchStore` is already the contract surface for
match metadata. Adding one more string field is one line in
`addOpponent`; threading per-request difficulty through every WS
`move` message is multiple touch-points and a new failure mode
(client lies about difficulty mid-game).

### 6. Validation

Two independent validation points:

- **HTTP layer** (`server/index.js`, `POST /api/matches/:code/vs-computer`):
  parse JSON body, validate `body.difficulty` against
  `DIFFICULTIES` from `shared/ai`. Missing / non-JSON body → default
  to `'medium'` (story 04 AC-1). Invalid value (e.g. `'godlike'`) →
  HTTP 400 `{error:'Invalid difficulty'}` (story 04 AC-2).
- **Resolver layer** (`shared/ai/strategy.js`): defensive fallback to
  `trivial` + `console.warn` for unknown strings. This catches future
  callers that skip the HTTP gate (e.g. a CLI tool, an admin shell)
  without crashing the hub.

### 7. Performance strategy

The 50 ms NFR (story 05) is a **hard ceiling**, not a soft target.
Implementation tactics:

- **No web worker.** 3×3 is small; the event loop can absorb a 1–5 ms
  blocking computation per bot turn without observable jank.
- **No iterative deepening.** Expert (alpha-beta on full tree) is
  already well under the budget; depth-limited Hard is bounded by
  configuration.
- **No transposition tables / memoisation.** Optional — permitted
  but not required (AC-5 in story 02).
- **Defensive timeout.** Each strategy wraps its decision loop in a
  `Date.now()` check against a 50 ms budget. If the budget is
  exceeded mid-search, the strategy returns the best move found so
  far (or, for Easy/Trivial which can't exceed it, this is a no-op).
  This is a belt-and-braces guard against pathological CI runners
  and a hedge against future strategy authors who forget to bound
  their search.
- **Iteration cap as named constants.** Showcase MCTS uses
  `MCTS_DEFAULT_ITERATIONS = 500` (story 05 AC-4); Hard uses
  `HARD_DEFAULT_DEPTH = 3` (story 02 AC-4). No magic numbers in
  strategy bodies.

### 8. Alternatives considered

**a) Server-side strategies only vs `shared/ai/`.**
Recommended: `shared/ai/`. Strategies are pure functions over the
existing shared game state; placing them under `shared/` costs
nothing and unlocks a future "hint mode" (client-side "suggest a
move" button) without code duplication. ADR-0006 already permits —
and effectively requires — game-shape logic to live in `shared/`.

**b) Pure-function strategies vs class instances.**
Recommended: pure functions exported as default. Each strategy file
exports a function `chooseCell(state, mark)` plus named helpers. The
registry wraps each export in a thin object `{ chooseCell }` so the
port shape is uniform from the consumer's point of view. Reasons:
tree-shaking is trivial; unit tests are one assertion per case
(`expect(easy.chooseCell(state, 'O')).toBe(...)`); no constructor
plumbing in the hub.

**c) RL / neural baseline (e.g. self-play DQN).**
Rejected. 3×3 is solved; minimax with alpha-beta is provably
optimal. Adding a neural baseline ships a 10 KB+ weight file, a
training pipeline, and a runtime dependency, in exchange for
worse-than-optimal play. The product value is zero.

**d) Per-request difficulty (no `match.difficulty` field).**
Rejected. The bot turn fires N moves after the HTTP flip; the
difficulty must live somewhere the hub can read. See §5.

**e) `chooseCell(state)` without the `mark` argument.**
Rejected. Threading `mark` makes strategies testable as either side
without rebuilding the state shape; the cost is one extra parameter
that today's `MatchHub` already knows (`'O'`).

**f) WebWorker / off-thread compute.**
Rejected. Sub-ms work per turn does not justify the message-passing
overhead, the serialisation of `state`, or the deployment
complexity of an additional worker file. See §7.

## Consequences

- positive:
  - `MatchHub` becomes strategy-agnostic. The only line that
    couples it to a specific algorithm is the resolver lookup; the
    rest of `_move` is unchanged.
  - Wave-3 developers can split work cleanly: one file per
    strategy, one file for the registry, one file for the public
    surface. No file is touched by more than one developer.
  - Sprint-05 behaviour is preserved by the `trivial` strategy,
    which is bit-for-bit `firstEmptyCell`. Legacy matches without a
    `difficulty` field continue to play exactly as before.
  - The sentinel scoring guard from ADR-0008 §4 is untouched and
    sits **above** the strategy dispatch; strategy choice cannot
    leak a bot win onto the leaderboard (story 06 AC-1).
  - Adding a seventh difficulty is one registry entry + one file.
    Future "online learning" or "adaptive difficulty" experiments
    plug into the existing port.

- negative:
  - Six new files in `shared/ai/strategies/` plus two in
    `shared/ai/`. The directory is a non-trivial surface; a
    developer reading the project for the first time has more to
    skim. Mitigation: `shared/ai/index.js` is the single public
    entry point; everything else is one click deeper.
  - `MatchHub` constructor signature grows by one optional
    parameter (`strategyResolver`). Default-construction continues
    to work, but tests that mock the hub must be aware of the
    extra slot.
  - `match.difficulty` is a new field on every Match. Existing
    in-memory matches at deploy time will read `undefined`; the
    `|| 'trivial'` fallback covers them, but a developer who
    forgets the fallback will see undefined-difficulty behaviour
    on a single match-store snapshot.

- neutral:
  - The 50 ms NFR is enforced in `verify.sh` (story 05 AC-5). CI
    variance is tolerated by the 50 ms ceiling being well above
    typical strategy latency (Expert is ~1–5 ms locally).
  - The `BotStrategy` port is intentionally minimal. Future
    additions (e.g. `name()`, `description()` for a richer UI)
    are additive and do not break this contract.
  - `Math.random` is unseeded; tests asserting distribution
    (story 02 Medium / Easy / Showcase) use a sample-size + range
    assertion, not exact equality.

## Ports / Adapters (or modules)

- **`BotStrategy`** (new port): single method
  `chooseCell(state, mark) -> integer in [0..8]`. Pure function.
  Consumers: `MatchHub._move`. Implementations: six (see file
  layout §3).
- **`StrategyRegistry`** (new module, not a port): keyed `Map`
  from `Difficulty` enum to `BotStrategy`. Public surface:
  `createRegistry() -> Map`, `DIFFICULTIES -> string[]`.
- **`strategyResolver`** (new constructor argument on `MatchHub`):
  function `(difficulty: string) => BotStrategy`. Defaults to a
  resolver built over `createRegistry()` with `'trivial'` fallback.
- **`shared/game.js`** (unchanged): `play`, `detectWinner`,
  `WIN_LINES`, `firstEmptyCell` continue as today. No new exports.
- **`MatchStore.addOpponent`** (extended, story 04): accepts an
  optional `difficulty: string` parameter validated against
  `DIFFICULTIES`. Stores on `match.difficulty`. Default
  `'medium'` when the parameter is absent and `playerO ===
  BOT_SENTINEL` (the human-vs-human path is unaffected).
- **`MatchHub._move`** (extended): replaces the direct
  `firstEmptyCell(next.board)` call with
  `this._strategyResolver(match.difficulty || 'trivial').chooseCell(next, 'O')`.
  All other guards (status, sentinel scoring skip, broadcast
  fan-out) are unchanged.
- **`POST /api/matches/:code/vs-computer`** (extended, story 04):
  reads `body.difficulty`, validates against `DIFFICULTIES`,
  passes the validated string through to `addOpponent`. Response
  body grows by one field: `difficulty`.
- **`public/lobby.html`** + **`public/lobby.js`** (extended,
  story 03): renders the `<select id="difficulty-select">`,
  persists to `localStorage` key `tris_difficulty`, transmits on
  the vs-computer POST.
- **`public/game.html`** + **`public/game.js`** (extended,
  story 03): reads `difficulty` from query string; renders a
  `<span id="difficulty-label">Difficulty: <Name></span>` when
  `mode === 'computer'`.

## Sequence

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice (browser)
    participant L as lobby.html
    participant H as HTTP
    participant M as MatchStore
    participant W as WS / MatchHub
    participant R as StrategyRegistry
    participant S as Strategy (Expert)
    participant G as shared/game.js

    Note over A,L: --- Picker change persists immediately ---
    A->>L: change #difficulty-select -> "Expert"
    L->>L: localStorage.setItem('tris_difficulty', 'expert')

    Note over A,L: --- Alice clicks "Play vs Computer" ---
    A->>L: click "Play vs Computer"
    L->>H: POST /api/matches/A3F7/vs-computer<br/>body: {"difficulty":"expert"}
    H->>H: parse JSON, validate against DIFFICULTIES
    H->>M: addOpponent("A3F7", "__bot__", "expert")
    M-->>H: Match {status:"active", playerO:"__bot__", difficulty:"expert"}
    H-->>L: 200 {code:"A3F7", role:"X", mode:"computer", difficulty:"expert"}
    L->>A: navigate /game.html?code=A3F7&role=X&mode=computer&difficulty=expert

    Note over A,W: --- Alice subscribes; first state pushed ---
    A->>W: ws subscribe matchCode:"A3F7"
    W-->>A: match.state (turn:X, you:X)

    Note over A,W: --- Alice plays; bot replies via Expert strategy ---
    A->>W: ws {type:"move", cell:4}
    W->>W: _move(alice, 4) — guard active OK
    W->>G: play(state, 4) -> next (turn:O, no winner)
    W-->>A: match.state (X@4, turn:O)
    W->>W: playerO==="__bot__" && active && !winner && !draw && turn==='O'
    W->>R: strategyResolver("expert")
    R-->>W: ExpertStrategy
    W->>S: chooseCell(next, 'O')
    S->>G: detectWinner, WIN_LINES (read-only over the next board)
    S-->>W: cell index k (≤ 50 ms, typically 1–5 ms)
    W->>W: validate next.board[k] === null
    W->>G: play(next, k) -> next2 (O@k, turn:X)
    W-->>A: match.state (O@k, X@4, turn:X)

    Note over A,W: --- Several moves later, terminal state ---
    A->>W: ws {type:"move", cell:N}
    W->>G: play -> next (winner:"X")
    W->>W: winnerUsername = "alice" (!= BOT_SENTINEL)
    W-->>A: match.state (final), match.ended {winner:"X"}

    Note right of W: If bot had won: winnerUsername === "__bot__" -><br/>award SKIPPED at hub (ADR-0008 §4 unchanged).<br/>Strategy choice is irrelevant to scoring.
```

## References

- ADR-0008 — Single-player mode (sprint-05); §3 defers
  `BotStrategy` port to this sprint; §4 sentinel scoring guard
  (unchanged); §5 three-layer leaderboard filter (unchanged).
- ADR-0006 — `shared/game.js` is the sole authority for game rules.
- ADR-0002 — Server is the source of truth; strategies run server-side.
- `docs/stories/2026-05-13-sprint-06/01-bot-strategy-port.feature`
- `docs/stories/2026-05-13-sprint-06/02-five-difficulty-strategies.feature`
- `docs/stories/2026-05-13-sprint-06/03-difficulty-picker-ui.feature`
- `docs/stories/2026-05-13-sprint-06/04-api-difficulty-field.feature`
- `docs/stories/2026-05-13-sprint-06/05-strategy-performance-nfr.feature`
- `docs/stories/2026-05-13-sprint-06/06-leaderboard-integrity-regression.feature`
