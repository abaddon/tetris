# QA Report — Sprint-06 (2026-05-13)

**verify.sh exit code**: 0
**Overall**: PASS-WITH-FINDINGS

---

## Verify output summary

| Suite | Passed | Failed |
|---|---|---|
| AI Strategies (node test/ai-strategies.test.js, via test.js) | 1151 | 0 |
| Tris unit + scoring + sentinel (node test.js) | 89 | 0 |
| AI perf (node test/ai-perf.test.js) | 18 | 0 |
| Leaderboard bot exclusion (node test/leaderboard-bot-exclusion.test.js) | 54 | 0 |
| Integration (PORT=0 node test/integration.js) | 127 | 0 |
| **Total** | **1439** | **0** |

Perf timings from ai-perf.test.js (all well under 50 ms):
- trivial: 0 ms / 0 ms / 0 ms
- easy: 0 ms / 0 ms / 0 ms
- medium: 0 ms / 0 ms / 0 ms
- hard: 0 ms / 0 ms / 0 ms
- expert: 5 ms (empty, worst-case) / 0 ms / 0 ms
- showcase: 1 ms / 0 ms / 0 ms

---

## Story 01 — BotStrategy port

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | `BotStrategy` interface defined with `chooseCell(state, mark) -> int` | PASS | `shared/ai/strategy.js:5-15` — JSDoc typedef; all strategy files implement `{ chooseCell }` as plain object export |
| AC-2 | `MatchHub` constructor accepts optional `strategyResolver`; defaults to returning `FirstEmptyCellStrategy` | PARTIAL | `match-hub.js:11,17` — constructor accepts 4th arg, defaults to `defaultRegistry.get.bind(defaultRegistry)`. The default resolver returns the `trivial` strategy (same as `FirstEmptyCellStrategy`), which wraps `firstEmptyCell`. However, no named `FirstEmptyCellStrategy` class is defined; the AC wording says "defaults to always returning a `FirstEmptyCellStrategy`" — the implementation defaults to the `trivial` registry entry, which is functionally equivalent but not named as specified. Acceptable divergence. |
| AC-3 | `FirstEmptyCellStrategy.chooseCell` delegates to `firstEmptyCell(state.board)` | PASS | `shared/ai/strategies/trivial.js:19` — `return firstEmptyCell(state.board)`. No `FirstEmptyCellStrategy` class name; the trivial module is the equivalent adapter. |
| AC-4 | `MatchHub._move` calls `strategyResolver(match.difficulty).chooseCell(next)` instead of `firstEmptyCell` directly | PASS | `match-hub.js:110-111` — `this._strategyResolver(match.difficulty || 'trivial').chooseCell(next, 'O')` |
| AC-5 | All sprint-05 single-player integration tests pass without modification | PASS | Integration suite: 127 passed, 0 failed |
| AC-6 | `BotStrategy` port lives in `shared/` — importable from both server and tests | PASS | `shared/ai/strategy.js`, `shared/ai/index.js`, `shared/ai/strategies/*.js` — all in `shared/`; imported by `server/match-hub.js` and test files |

**Story 01 verdict: PASS** (AC-2/AC-3 nominal naming divergence is cosmetic, not functional)

---

## Story 02 — Five AI difficulty strategies

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | Five strategy classes: `EasyStrategy`, `MediumStrategy`, `HardStrategy`, `ExpertStrategy`, `ShowcaseStrategy` | PARTIAL | Five files exist and are registered. However, none are exported as named *classes* — all are plain object modules `{ chooseCell }`. AC says "five strategy classes"; ADR-0009 says "one default export plus named exports." Story 02 AC-7 says "exported from a single module." No `EasyStrategy` etc. named identifiers exist anywhere in the codebase. The interface contract is met; naming is not. |
| AC-2 | `EasyStrategy.chooseCell` selects uniformly at random from empty cells | PASS | `shared/ai/strategies/random.js:14-21` — uniform random over empty cells; 1000-call distribution test at `test/ai-strategies.test.js:64` |
| AC-3 | `MediumStrategy.chooseCell` priorities: immediate win, block, weighted random (center=4, corners=2, edges=1) | PASS | `shared/ai/strategies/heuristic.js:69-86` — win → block → `weightedFallback`; `CELL_WEIGHTS=[2,1,2,1,4,1,2,1,2]` |
| AC-4 | `HardStrategy.chooseCell` implements depth-limited minimax (default 3 plies), `+10-depth`/`-10+depth` eval | PASS | `shared/ai/strategies/minimax.js:13` — `DEFAULT_DEPTH=3`; scoring at lines 95-97 |
| AC-5 | `ExpertStrategy.chooseCell` implements minimax with alpha-beta pruning over full game tree | PASS | `shared/ai/strategies/minimax-ab.js` — full alpha-beta; never-loses test at `ai-strategies.test.js:270` passes |
| AC-6 | `ShowcaseStrategy.chooseCell` implements UCT MCTS, 500 iterations, c=√2, random rollout | PASS | `shared/ai/strategies/mcts.js` — `ITERATIONS=500`, `EXPLORATION=Math.SQRT2`, rollout via `rollout()` function (not via `random.js chooseCell`; own inline random — acceptable) |
| AC-7 | All five strategies exported from a single module importable by server and tests | FAIL | No `shared/strategies.js` or equivalent single aggregator module exists. Strategies are individual files in `shared/ai/strategies/`. `shared/ai/index.js` exports only `{ DIFFICULTIES, createRegistry, defaultRegistry }`, not the strategy objects. Tests import each strategy file directly (e.g. `require('../shared/ai/strategies/random.js')`). This AC is technically unmet: there is no single re-export module for all five strategies. The registry (`defaultRegistry`) serves a similar purpose but does not export strategy objects by name. |
| AC-8 | No strategy reads/writes I/O, network, or mutable shared state outside the call stack | PASS | Inspection confirms all five strategies use only local computation and `shared/game.js` imports |

**Story 02 verdict: PASS-WITH-FINDINGS** (AC-7 unmet by letter; functionally the registry covers the same role)

---

## Story 03 — Difficulty picker UI

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | `<select id="difficulty-select">` inside match-waiting panel; options `trivial/easy/medium/hard/expert/showcase`; `medium` selected by default | PASS | `public/lobby.html:65-73` — all six options present, `medium` has `selected` attribute |
| AC-2 | On `change`, `localStorage.setItem('tris_difficulty', selectedValue)` called immediately | PASS | `public/lobby.html:106-108` |
| AC-3 | On page load, restore from localStorage if in allowed set; otherwise default to `medium` and overwrite localStorage | PASS | `public/lobby.html:95-103` |
| AC-4 | `POST /api/matches/:code/vs-computer` called with `{ "difficulty": "<selected value>" }` and `Content-Type: application/json` | PASS | `public/lobby.html:154-157` — `JSON.stringify({ difficulty: selectedDifficulty })`, explicit `Content-Type` header |
| AC-5 | On HTTP 200 navigate to `/game.html?code=<code>&role=X&mode=computer&difficulty=<selectedValue>` | PASS | `public/lobby.html:162-163` |
| AC-6 | `public/game.html` shows `<span id="difficulty-label">Difficulty: <Capitalised></span>` adjacent to `#player-info` when `mode=computer`; absent when mode != computer | PARTIAL | `public/game.html:91-96` — span is created and inserted, but the AC says "absent (not just hidden) when `mode !== 'computer'`". The code only creates the span when `mode === 'computer' && difficultyParam` is truthy — so the span is genuinely absent otherwise. However, the span is inserted *after* `#player-info` via `insertBefore(diffLabel, playerInfoEl.nextSibling)`, not *adjacent* in the strict DOM sense of "inside `header` near `#player-info`." This is a layout concern, not a logic defect. PASS on the absence requirement; insertion location is acceptable. |
| AC-7 | No existing lobby/game element regresses | PASS | 127 integration tests pass including all sprint-01 through sprint-05 assertions |

**Story 03 verdict: PASS**

---

## Story 04 — API difficulty field

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | Parse body as JSON if `Content-Type: application/json`; other content-types default to `medium` | PASS | `server/index.js:156-163` |
| AC-2 | Allowed values exactly `{trivial,easy,medium,hard,expert,showcase}`; any other string → 400 `{ "error": "Invalid difficulty" }` | PASS | `server/index.js:165-169` — uses `DIFFICULTIES.includes(rawDiff)` |
| AC-3 | `MatchStore.addOpponent` stores validated difficulty on match; legacy matches treated as `"trivial"` at bot-turn time | PASS | `server/match-store.js:43`; `match-hub.js:110` — `match.difficulty || 'trivial'` |
| AC-4 | HTTP 200 response includes `difficulty` field | PASS | `server/index.js:173` — `{ code, role: 'X', mode: 'computer', difficulty }` |
| AC-5 | `MatchHub._move` passes `match.difficulty` to resolver; resolver never throws; unknown falls back to trivial with `console.warn` | PASS | `match-hub.js:110`; `strategy.js:58-62` |
| AC-6 | All auth/ownership/status/404 guards unchanged | PASS | Guards at `server/index.js:149-153` unchanged; integration tests confirm 401/403/404/409 |

**Story 04 verdict: PASS**

---

## Story 05 — Strategy performance NFR

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | At least two timing test cases per strategy (empty board + mid-game); both must pass within 50 ms | PASS | `test/ai-perf.test.js` runs each of 6 difficulties × 3 boards = 18 assertions; all use `< LIMIT_MS` (50) |
| AC-2 | Timing via `Date.now()` or `performance.now()`; duration asserted `< 50` and `console.log`-d | PARTIAL | `ai-perf.test.js:206,215` uses `process.hrtime.bigint()`, not `Date.now()`/`performance.now()`. The AC says "uses `Date.now()` (or `performance.now()` if available)". However `process.hrtime.bigint()` is strictly superior precision. The unit tests in `ai-strategies.test.js` use `Date.now()`. The perf suite prints elapsed ms. The spirit of the AC is met; the letter says `Date.now()`/`performance.now()` but `hrtime.bigint` is the dev's (correct) choice. Minor deviation. |
| AC-3 | Expert strategy worst-case (empty board) explicitly tested; allows up to 50 ms | PASS | `ai-perf.test.js:186-221` — expert/empty tested; result was 5 ms |
| AC-4 | MCTS iteration budget capped at 500 by named constant | PASS | `shared/ai/strategies/mcts.js:15` — `const ITERATIONS = 500` exported |
| AC-5 | `./verify.sh` exits non-zero if any timing assertion fails | PASS | `verify.sh` calls `node test/ai-perf.test.js`; `ai-perf.test.js:229` calls `process.exit(1)` on failure; `verify.sh` uses `set -euo pipefail` |
| AC-6 | No existing test removed or weakened | PASS | All prior test counts identical or increased |

**Story 05 verdict: PASS** (AC-2 hrtime vs Date.now deviation is acceptable)

---

## Story 06 — Leaderboard integrity regression

| # | Criterion | Status | Evidence / Gap |
|---|---|---|---|
| AC-1 | Sentinel guard in `MatchHub._move` applies regardless of which strategy computed the bot move | PASS | `match-hub.js:100,121` — `if (winnerUsername !== BOT_SENTINEL)` in both win paths; strategy dispatch code path at line 110-112 cannot bypass these checks |
| AC-2 | `ScoreStore.award` rejects `__bot__` with `SENTINEL_REJECTED` | PASS | Unchanged from sprint-05; confirmed by leaderboard-bot-exclusion test assertions 7-8 per difficulty |
| AC-3 | `JsonlScoreStore.boot()` sentinel skip and `topN()` filter remain unmodified | PASS | `test.js` sentinel-boot and sentinel-topN tests pass (89 total unit pass) |
| AC-4 | `GET /api/leaderboard` post-filter unchanged | PASS | `server/index.js:118` unchanged; sprint05-s05 integration assertion passes |
| AC-5 | Automated tests cover bot-win at "easy", bot-win at "expert", human-win at "showcase", draw at "medium" | FAIL | `test/leaderboard-bot-exclusion.test.js:91-113` — `setupAndDriveBotMatch(difficulty)` accepts a difficulty label but **does not pass it to `matchStore.addOpponent`** (line 97: `matchStore.addOpponent(match.code, BOT_SENTINEL)` with no third arg). The match object therefore has `match.difficulty === undefined`, resolved to `'trivial'` at bot-turn time. Every iteration of the `for (const difficulty of DIFFICULTIES)` loop runs the *same* trivial-strategy match — not easy, expert, showcase, or medium matches. The AC requires covering "bot win at easy", "bot win at expert" etc. The test labels suggest coverage but does not actually exercise the named strategies. |
| AC-6 | `./verify.sh` exits zero with all sprint-05 story 05 ACs passing | PASS | Exit code 0; all 1439 assertions pass |

**Story 06 verdict: PASS-WITH-FINDINGS** (AC-5 coverage gap — tests do not exercise named strategies despite labelling)

---

## ADR-0009 conformance

| Item | Status | Evidence |
|---|---|---|
| Strategies implement `chooseCell(state, mark) -> number` | PASS | All five files; registry confirms `typeof strategy.chooseCell === 'function'` |
| Interface shape: `{ chooseCell }` object (not class) | PASS | All modules export plain objects |
| Registry falls back to trivial with `console.warn` for unknown difficulty | PASS | `strategy.js:58-62` |
| `match.difficulty` persisted at `addOpponent` time, not per-request | PASS | `match-store.js:43`; server reads `match.difficulty` at bot-turn time |
| 50 ms NFR satisfied per-strategy | PASS | All 18 perf assertions pass; expert worst case 5 ms |
| `BotStrategy` exported as `undefined` from strategy.js | WARN | `strategy.js:83` — `module.exports = { BotStrategy: undefined, ... }`. Exporting `undefined` is dead weight that could confuse callers doing `const { BotStrategy } = require('./strategy')`. It should either be exported as the JSDoc typedef (not possible at runtime) or removed entirely. |

---

## Sprint-05 regression probes

- Bot games excluded from leaderboard: PASS — sentinel guard at `match-hub.js:100,121` is unchanged; `GET /api/leaderboard` filter at `server/index.js:118` is unchanged; sprint05-s05 integration assertion passes.
- Sentinel guards: PASS — JsonlScoreStore and InMemoryScoreStore reject `__bot__` (both 89 unit pass).
- "vs Computer" with default Medium difficulty: PASS — `POST /api/matches/:code/vs-computer` with no body defaults to `medium` (integration assertion at `test/integration.js:706`).
- Single-player game playable end-to-end: PASS — trivial/medium/hard/expert/showcase all registered and callable.

---

## Open findings

| # | Severity | Location | Description |
|---|---|---|---|
| F-1 | P1 | `test/leaderboard-bot-exclusion.test.js:97` | `setupAndDriveBotMatch(difficulty)` never passes `difficulty` to `matchStore.addOpponent`, so every iteration runs the trivial strategy. AC-5 of story 06 claims coverage of easy/expert/showcase/medium strategy paths but all 6 iterations are functionally identical trivial-strategy runs. The sentinel guard is still tested 6 × 8 = 48 times, which is valid — but the story 06 claim "automated tests cover bot win at easy, bot win at expert..." is misleading. Real strategy dispatch is untested by this suite. |
| F-2 | P2 | `shared/ai/strategy.js:83` | `BotStrategy: undefined` in `module.exports` is dead weight. Exporting an explicit `undefined` under a meaningful-sounding name is a footgun for consumers that destructure and then type-check. Should be removed. |
| F-3 | P2 | `shared/ai/index.js:10` / story 02 AC-7 | No single re-export module for all five strategy objects. AC-7 says "exported from a single module e.g. `shared/strategies.js`". Individual files in `shared/ai/strategies/` do exist; the `defaultRegistry` provides runtime access; but no aggregator module satisfies the AC literally. Tests import individual files directly rather than from one surface. This is a mild contract gap, not a runtime defect. |
| F-4 | P3 | `test/ai-perf.test.js` | The perf test uses `process.hrtime.bigint()` rather than `Date.now()`/`performance.now()` as the story 05 AC-2 specifies. The choice is strictly better precision-wise, but it diverges from the written AC. Not blocking. |
| F-5 | P3 | `test/leaderboard-bot-exclusion.test.js:127` | The test uses `nearTerminalState()` but that function builds a state where it turns out to be X's turn (even number of moves), not O's turn as narrated. The `buildNearTerminal()` alternative is used instead. The code comments in the file document extensive board-analysis work that was done to arrive at a correct state — but some of the inline scratch work is noisy and a comment at line 123-127 notes that `nearTerminalOTurn()` actually produces a terminal X-win position. Dead code. Not blocking. |

---

## Verdict

**PASS-WITH-FINDINGS**

- verify.sh: exit 0 — 1439 assertions pass, 0 fail.
- All six sprint-06 stories pass their core acceptance criteria.
- F-1 (P1): The leaderboard bot-exclusion test suite labels itself as covering per-strategy runs but all iterations use the trivial strategy. The sentinel guard itself is correctly tested; the per-strategy dispatch claim is false. This is a test quality gap, not a runtime regression.
- F-2, F-3 are P2 cosmetic/contract-letter issues with no runtime impact.
- F-4, F-5 are P3 noise.

Recommended action before production deploy: fix F-1 by passing `difficulty` to `matchStore.addOpponent` in the test helper so each difficulty iteration actually exercises its registered strategy. The fix is a one-line change.
