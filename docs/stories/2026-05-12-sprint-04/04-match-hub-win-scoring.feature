Feature: MatchHub awards winner a point on match termination
  As a Tris player who just won a match
  I want my server-side score to increase by one automatically
  So that my ranking on the leaderboard reflects my actual win count

  Background:
    Given "alice" is Player X and "bob" is Player O in active match "A3F7"
    And the ScoreStore (story 03) is available to MatchHub via constructor injection
    And both players are connected via WebSocket

  Scenario: Winner receives exactly one point when a move produces a winning state
    Given the board is one move away from "alice" winning
    When "alice" plays the winning move
    Then match "A3F7" transitions to status "ended" with winner "alice"
    And ScoreStore.award("alice") is called exactly once
    And "bob"'s score is not changed
    And both clients receive a "match.ended" message with { winner: "alice" }

  Scenario: Draw awards no points to either player
    Given the board has 8 marks and "alice"'s next move will fill the board producing a draw
    When "alice" plays the final cell
    Then match "A3F7" transitions to status "ended" with draw true
    And ScoreStore.award is NOT called for either "alice" or "bob"
    And both clients receive a "match.ended" message with { draw: true }

  Scenario: Abandoned match (one player disconnects mid-game) awards no points
    Given "alice" and "bob" are mid-match with no winner yet
    When "bob" closes the WebSocket connection
    Then match "A3F7" transitions to status "abandoned"
    And ScoreStore.award is NOT called for either player
    And "alice" receives a "match.opponentLeft" message

  Scenario: Both players disconnect simultaneously awards no points
    Given "alice" and "bob" are mid-match with no winner yet
    When "alice"'s WebSocket closes
    And "bob"'s WebSocket closes before any winner was determined
    Then ScoreStore.award is NOT called
    And match "A3F7" has status "abandoned"

  Scenario: award failure does not crash the hub or disconnect either player
    Given the ScoreStore.award method rejects with a disk-write error
    When "alice" plays the winning move
    Then the error is logged to stderr (not swallowed silently)
    And both clients still receive the "match.ended" and "match.state" broadcast
    And neither client's WebSocket is forcibly closed

  Scenario: Scoring does not fire twice if the same terminal state is re-broadcast (rematch guard)
    Given match "A3F7" has status "ended" and winner "alice"
    When a second "move" WebSocket message arrives for the same match (e.g. a replay)
    Then the hub rejects it with { type: "error", message: "Match not active" }
    And ScoreStore.award is NOT called a second time

```
## Acceptance criteria
- AC-1: `MatchHub` receives a `ScoreStore` instance via its constructor (dependency injection). It MUST NOT import or instantiate the store itself.
- AC-2: In `_move`, after `play()` returns a terminal state (`next.winner` is set), `scoreStore.award(winnerUsername)` is called before broadcasting `match.ended`. "Winner username" is resolved from `match.playerX` / `match.playerO` using `next.winner` ('X' or 'O') as the role key.
- AC-3: `award` is never called when `next.draw` is true.
- AC-4: `award` is never called from `_onClose`; the abandoned-match path (where `status` is set to `abandoned`) must not trigger scoring.
- AC-5: A rejected Promise from `scoreStore.award` must be caught; the error is forwarded to `console.error` (or equivalent); the WebSocket broadcast continues regardless.
- AC-6: The guard `if (match.status !== 'active')` in `_move` is sufficient to prevent double-scoring on replays — no additional idempotency key is needed at the hub level.
- AC-7: `server/index.js` passes the `scoreStore` instance when constructing `MatchHub`: `new MatchHub(matchStore, sessionStore, scoreStore)`.
- AC-8: Unit tests for `MatchHub` use `InMemoryScoreStore` (story 03) to assert award calls without touching disk.
- AC-9: All existing sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: The `award` call is fire-and-resolve; it must not block the WebSocket broadcast. If the JSONL write is slow, the broadcast still goes out immediately (award can be awaited after broadcasting, or the rejection caught asynchronously).
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent score corruptions. Every unhandled rejection from `award` must appear in server logs.

## Priority
- MoSCoW: must

## Source
- feedback: goal

## Clarifications
(none — hook point confirmed in server/match-hub.js line 90, winner-username resolution pattern confirmed from match schema in ADR-0004)
```
