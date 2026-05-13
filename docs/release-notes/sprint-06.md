# Sprint 06 — AI Difficulty Portfolio

## Overview

Sprint 05 shipped single-player Tris with a first-empty-cell bot: deterministic,
weak, and intentionally so — the point was to validate the single-player plumbing,
not to build a good opponent. Sprint 06 cashes the `BotStrategy` port deferred in
ADR-0008 §3. The result is a portfolio of six difficulty tiers backed by five
distinct algorithms, selectable from the lobby, stored on the match record, and
dispatched server-side at bot-turn time. The sprint-05 leaderboard guarantees
are unaffected.

---

## What's New

### Difficulty picker (UI — story 03)

A `<select id="difficulty-select">` in the match-waiting panel lets you choose
the bot's playing strength before clicking "Play vs Computer". Selection is
persisted to `localStorage` so it survives page refreshes. The active difficulty
is shown as a label on the game board when playing against the computer.

Defaults to **Medium** on first visit.

### Six difficulty tiers (story 02)

| Tier | Algorithm | Notes |
|---|---|---|
| **Trivial** | First empty cell | Sprint-05 behaviour, preserved verbatim. Legacy matches without a difficulty field fall back here. |
| **Easy** | Uniform random | Picks uniformly from empty cells. Beatable with any consistent strategy. |
| **Medium** | Weighted heuristic + 1-ply win/block scan | Tries to win immediately; blocks opponent wins; then prefers center (weight 4), corners (weight 2), edges (weight 1). Reasonable for new players. |
| **Hard** | Depth-limited minimax (depth 3) | Evaluates 3 plies ahead. Wins and draws scored at ±10 discounted by depth. Will not walk into a fork within its search horizon. |
| **Expert** | Full minimax with alpha-beta pruning | Searches the complete 3×3 game tree (~5,478 reachable terminal states). Optimal play — will never lose. |
| **Showcase** | Monte Carlo Tree Search (UCT, 500 iterations) | Uses the UCT selection formula (c = √2) with random rollouts. Interesting to watch but not optimal — MCTS on a solved game is a portfolio demonstration, not a practical choice. |

### `BotStrategy` port (story 01)

`MatchHub._move` is now strategy-agnostic. Instead of calling `firstEmptyCell`
directly, it calls `this._strategyResolver(match.difficulty).chooseCell(state, 'O')`.
The resolver is injected via the constructor (injectable for tests) and defaults
to a registry built over `shared/ai/`. The hub guards — sentinel scoring skip,
broadcast fan-out — are unchanged.

### API: difficulty field on vs-computer endpoint (story 04)

`POST /api/matches/:code/vs-computer` now accepts an optional JSON body:

```json
{ "difficulty": "expert" }
```

Valid values: `trivial`, `easy`, `medium`, `hard`, `expert`, `showcase`. Invalid
values return HTTP 400 `{ "error": "Invalid difficulty" }`. Absent body or
non-JSON content type defaults to `medium`. The difficulty is stored once at
`addOpponent` time and is the source of truth for every subsequent bot turn;
the client cannot change it mid-game.

---

## How to Try It

1. Log in and open the lobby.
2. Create a match. The match-waiting panel shows the difficulty picker.
3. Select a tier (e.g. "Expert") and click "Play vs Computer".
4. Try to win. With Expert selected, you will not.

For developers: `shared/ai/strategies/` contains one file per algorithm. Each
exports a `{ chooseCell(state, mark) }` object and named helpers (e.g.
`minimax`, `evaluate`) for testability. No external dependencies — pure JS,
Node 18+.

---

## Under the Hood

See **[ADR-0009](../adr/0009-single-player-ai-engine.md)** for the full design:
the `BotStrategy` port contract, the strategy registry shape, how `match.difficulty`
is persisted, and why the approaches not taken were rejected (async strategies,
per-request difficulty, web workers, transposition tables, RL baselines).

Key design constraints from the ADR:

- Strategies are pure functions — no I/O, no network, no mutable shared state
  outside the call stack.
- All six strategies live under `shared/ai/` so a future client-side "hint mode"
  would be a single `require` away.
- `Math.random` is unseeded; tests assert distribution over sample sizes, not
  exact equality.
- The resolver never throws. Unknown difficulty strings fall back to `trivial`
  with a `console.warn`.

---

## Tests / QA

**verify.sh exit code**: 0 — 1439 assertions, 0 failures.

| Suite | Assertions |
|---|---|
| AI strategies (unit) | 1,151 |
| Unit + scoring + sentinel | 89 |
| AI performance | 18 |
| Leaderboard bot exclusion | 54 |
| Integration | 127 |
| **Total** | **1,439** |

Measured `chooseCell` latency against the 50 ms NFR (all strategies, empty board
— worst case):

| Strategy | Measured (worst case) |
|---|---|
| Trivial | < 1 ms |
| Easy | < 1 ms |
| Medium | < 1 ms |
| Hard | < 1 ms |
| Expert | 5 ms |
| Showcase | 1 ms |

Expert on an empty board is the true worst case (full alpha-beta traversal,
maximum branching). 5 ms observed; NFR is 50 ms.

**Open findings from QA** (non-blocking, no runtime impact):

- F-1 (P1): The leaderboard bot-exclusion test suite iterates over all six
  difficulties but does not thread the difficulty through to `addOpponent`, so
  all iterations exercise the trivial strategy. The sentinel guard itself is
  correctly tested; the per-strategy dispatch coverage claim is misleading.
  Recommended fix: pass difficulty to `matchStore.addOpponent` in the test
  helper (one-line change).
- F-2 (P2): `BotStrategy: undefined` exported from `shared/ai/strategy.js` is
  dead weight — the JSDoc typedef has no runtime representation. Should be
  removed.
- F-3 (P2): Story 02 AC-7 asks for a single re-export module for all five
  strategy objects; the registry provides runtime access but no aggregator
  module exists for direct import.

---

## Compatibility

Sprint-05 leaderboard guarantees are intact:

- The sentinel scoring guard in `MatchHub._move` (`if (winnerUsername !== BOT_SENTINEL)`)
  sits above strategy dispatch. Which algorithm the bot used to win is irrelevant
  to whether that win is scored.
- `ScoreStore.award` continues to reject `__bot__` with `SENTINEL_REJECTED`
  as defence-in-depth.
- All three leaderboard exclusion layers from ADR-0008 §5 are unmodified: JSONL
  boot-replay skip, `topN()` sentinel filter, `GET /api/leaderboard` post-filter.
- Legacy matches created in sprint-05 (no `difficulty` field) resolve to `trivial`
  at bot-turn time via `match.difficulty || 'trivial'` — bit-exact sprint-05
  behaviour.

---

## Commit SHAs

| What | SHA |
|---|---|
| ADR-0009 — pluggable AI engine design | `f2924a1` |
| `BotStrategy` port + trivial strategy (story 01) | `68c8fcc` |
| Five AI strategies: random/heuristic/minimax/minimax-ab/mcts (story 02) | `5483a86` |
| Difficulty picker UI, lobby + game (story 03) | `02027a3` |
| API: thread difficulty through vs-computer endpoint (story 04) | `34acf33` |
| Performance tests: all strategies < 50 ms (story 05) | `7e4cd58` |
| Leaderboard bot-exclusion regression tests (story 06) | `23facd2` |
| Merge wave-3b: strategies + performance + regression tests | `67e8027` |
| Perf-test ref-check + isolated DATA_DIR fix | `016f6ae` |
| QA report — sprint-06 | `8949e66` |
| Fix: pin trivial resolver in bot-exclusion test, prune dead exports | `7978f25` |
