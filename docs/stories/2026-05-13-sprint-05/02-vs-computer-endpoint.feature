Feature: POST /api/matches/:code/vs-computer endpoint flips match into single-player mode
  As a logged-in Tris player who owns a waiting match
  I want to call a dedicated endpoint to register the computer as my opponent
  So that the server can manage bot turns without a second human connection

  Background:
    Given the server is running with the full production store stack
    And "alice" is registered and logged in
    And "alice" has created match "A3F7" (status "waiting", playerX "alice", playerO null)
    And the sentinel identifier for the computer player is "__bot__"

  Scenario: Owner flips waiting match to single-player mode
    When "alice" sends POST /api/matches/A3F7/vs-computer with her session cookie
    Then the server responds with HTTP 200 and Content-Type application/json
    And the response body is { "code": "A3F7", "role": "X", "mode": "computer" }
    And match "A3F7" now has playerO equal to the sentinel "__bot__"
    And match "A3F7" status is "active"

  Scenario: Non-owner cannot flip the match
    Given "bob" is registered and logged in
    When "bob" sends POST /api/matches/A3F7/vs-computer
    Then the server responds with HTTP 403 and an error body
    And match "A3F7" is unchanged (still status "waiting", playerO null)

  Scenario: Unauthenticated request is rejected
    Given no valid session cookie is present
    When a client sends POST /api/matches/A3F7/vs-computer
    Then the server responds with HTTP 401

  Scenario: Match not found returns 404
    When "alice" sends POST /api/matches/XXXXX/vs-computer
    Then the server responds with HTTP 404

  Scenario: Endpoint is idempotent — calling it twice on the same match returns 409
    Given "alice" has already flipped match "A3F7" to single-player mode
    When "alice" sends POST /api/matches/A3F7/vs-computer again
    Then the server responds with HTTP 409 and { "error": "Match already started" }

  Scenario: Endpoint is rejected when match is active (human opponent already joined)
    Given "bob" has joined match "A3F7" via POST /api/matches/A3F7/join
    When "alice" sends POST /api/matches/A3F7/vs-computer
    Then the server responds with HTTP 409 and { "error": "Match already started" }

  Scenario: Endpoint is rejected when match has ended
    Given match "A3F7" has status "ended"
    When "alice" sends POST /api/matches/A3F7/vs-computer
    Then the server responds with HTTP 409 and { "error": "Match already started" }

```
## Acceptance criteria
- AC-1: `POST /api/matches/:code/vs-computer` is registered in `server/index.js` following the same pattern as `POST /api/matches/:code/join`. It requires an authenticated session (HTTP 401 if none).
- AC-2: The handler verifies the caller is `match.playerX`. If not, it responds HTTP 403. If the match is not found, it responds HTTP 404.
- AC-3: The handler is only valid while `match.status === 'waiting'`. Any other status yields HTTP 409 `{ error: "Match already started" }`.
- AC-4: On success the handler calls `MatchStore.addOpponent(code, BOT_SENTINEL)` (where `BOT_SENTINEL = "__bot__"`) to set `playerO` and flip status to `"active"`, then responds HTTP 200 `{ code, role: "X", mode: "computer" }`.
- AC-5: `addOpponent` is reused without modification; the sentinel `"__bot__"` is simply treated as a username. No new `MatchStore` method is required for this story.
- AC-6: The sentinel value `"__bot__"` is defined as a named constant in `server/index.js` (e.g. `const BOT_SENTINEL = '__bot__'`) so that all sprint-05 stories reference the same string.
- AC-7: After the endpoint returns 200, `MatchHub` (story 03) detects `playerO === BOT_SENTINEL` and schedules the first bot move if it is the bot's turn (it is not on a fresh game: X always moves first).
- AC-8: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: Endpoint must respond within 100 ms under normal conditions (in-memory store, no disk I/O in this handler).
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent failures; any unexpected throw must be caught and returned as HTTP 500 with a log line.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
