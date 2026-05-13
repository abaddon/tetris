Feature: Single-player scoring — only the human can be awarded; bot and sentinel are always excluded
  As a Tris player in a single-player match
  I want my leaderboard score to increase only when I beat the computer
  So that the leaderboard reflects genuine human skill, not bot victories

  Background:
    Given the ScoreStore (sprint-04 story 03) is available to MatchHub via constructor injection
    And the bot sentinel identifier is "__bot__"
    And "alice" is logged in and has single-player match "A3F7" (playerX "alice", playerO "__bot__")

  Scenario: Human wins — ScoreStore.award fires for the human exactly once
    Given the board is one move away from "alice" winning (X)
    When "alice" plays the winning move via WebSocket
    Then match "A3F7" transitions to status "ended" with winner "X"
    And ScoreStore.award("alice") is called exactly once
    And ScoreStore.award is NOT called with "__bot__" or any other argument
    And "alice" receives "match.ended" with { winner: "X" }

  Scenario: Bot wins — no award is made
    Given the board is one move away from the bot winning (O) and it is alice's turn
    When "alice" plays a move that does not prevent the bot's win
    And MatchHub plays the bot's winning move automatically
    Then match "A3F7" transitions to status "ended" with winner "O"
    And ScoreStore.award is NOT called for "alice", "__bot__", or any other name

  Scenario: Draw — no award is made
    Given the board is two moves from a draw (alice's move, then bot's move fills the board)
    When "alice" plays her penultimate move
    And MatchHub plays the bot's final move producing a draw
    Then match "A3F7" transitions to status "ended" with draw true
    And ScoreStore.award is NOT called for any name

  Scenario: ScoreStore.award rejects the sentinel even if called directly
    Given the ScoreStore has the sentinel-guard active
    When ScoreStore.award("__bot__") is called directly
    Then the returned Promise rejects with { code: "SENTINEL_REJECTED", name: "__bot__" }
    And no score record for "__bot__" is written to "data/scores.jsonl"
    And no entry for "__bot__" is added to the in-memory map

  Scenario: Sentinel guard is case-insensitive
    When ScoreStore.award("__BOT__") is called directly
    Then the returned Promise rejects with { code: "SENTINEL_REJECTED" }

  Scenario: award failure does not crash the hub or disconnect the human player (reuse of sprint-04 rule)
    Given ScoreStore.award rejects (for any reason, including sentinel check)
    When "alice" plays the winning move
    Then the error is logged to stderr
    And "alice"'s WebSocket connection remains open
    And "alice" still receives the "match.ended" and "match.state" broadcasts
    (see sprint-04 story 04 AC-5)

  Scenario: Double-scoring guard still applies in single-player (reuse of sprint-04 rule)
    Given match "A3F7" has status "ended"
    When a second "move" WebSocket message arrives for the same match
    Then the hub rejects it with { type: "error", message: "Match not active" }
    And ScoreStore.award is NOT called a second time
    (see sprint-04 story 04 AC-6)

```
## Acceptance criteria
- AC-1: In `MatchHub._move`, when `next.winner` is set, the `winnerUsername` is resolved from `match.playerX` / `match.playerO` using `next.winner` ('X' or 'O') as the role key — identical to sprint-04 story 04 AC-2.
- AC-2: Before calling `scoreStore.award(winnerUsername)`, MatchHub checks `winnerUsername !== BOT_SENTINEL`. If the sentinel matches, `award` is NOT called. No score is written. This guard lives in `MatchHub._move`, not in ScoreStore — it is the primary prevention layer.
- AC-3: ScoreStore itself adds a secondary sentinel guard: at the top of the `award` method body (both `JsonlScoreStore` and `InMemoryScoreStore`), if `usernameDisplay.toLowerCase() === '__bot__'`, the method returns a rejected Promise with `{ code: "SENTINEL_REJECTED", name: usernameDisplay }`. This guard protects against any caller that bypasses the hub-level check.
- AC-4: The sentinel rejection in AC-3 must not write any JSONL line and must not mutate the in-memory map.
- AC-5: Draws and bot-win terminal states must never call `award` for any username (same rule as sprint-04 story 04 AC-3).
- AC-6: The `award` failure path (`.catch(console.error)`) already established in sprint-04 story 04 AC-5 applies here unchanged — the sentinel rejection is caught the same way and does not crash the hub.
- AC-7: Unit tests must assert: (a) `award("__bot__")` rejects on both store adapters, (b) hub calls `award` only for human winner, (c) bot-win match never calls `award`.
- AC-8: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: The sentinel check is a synchronous string comparison; it adds zero measurable latency.
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent score corruptions. Any `award` call for the sentinel must surface as a rejected Promise and a `console.error` log line (via the hub's existing `.catch`).

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
