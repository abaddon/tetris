Feature: POST /api/matches/:code/vs-computer accepts and stores a difficulty field
  As a Tris server
  I want the vs-computer endpoint to read and persist a difficulty value from the request body
  So that MatchHub can select the correct BotStrategy for each single-player match

  Background:
    Given the server is running
    And the bot sentinel identifier is "__bot__"
    And "alice" is registered and logged in
    And "alice" has created match "A3F7" (status: waiting, playerX: "alice")

  Scenario: Endpoint accepts difficulty "hard" and stores it on the match
    When "alice" sends POST /api/matches/A3F7/vs-computer with body { "difficulty": "hard" }
    Then the server responds with HTTP 200
    And the response body is { "code": "A3F7", "role": "X", "mode": "computer", "difficulty": "hard" }
    And the match record has difficulty "hard" stored server-side

  Scenario: Endpoint defaults difficulty to "medium" when field is absent
    When "alice" sends POST /api/matches/A3F7/vs-computer with an empty body
    Then the server responds with HTTP 200
    And the response body contains { "difficulty": "medium" }
    And the match record has difficulty "medium" stored server-side

  Scenario: Endpoint defaults difficulty to "medium" when body is not JSON
    When "alice" sends POST /api/matches/A3F7/vs-computer with Content-Type text/plain body "hard"
    Then the server responds with HTTP 200
    And the match difficulty defaults to "medium"

  Scenario: Endpoint rejects an unrecognised difficulty value
    When "alice" sends POST /api/matches/A3F7/vs-computer with body { "difficulty": "godlike" }
    Then the server responds with HTTP 400
    And the response body contains { "error": "Invalid difficulty" }
    And the match remains in "waiting" status (playerO not set)

  Scenario: MatchHub selects the correct strategy for the stored difficulty
    Given match "A3F7" has been flipped to vs-computer with difficulty "expert"
    When alice plays a move and the bot's turn is triggered
    Then MatchHub resolves the "expert" difficulty to ExpertStrategy
    And ExpertStrategy.chooseCell is called with the current board state

  Scenario: Endpoint is idempotent for 409 (already started) regardless of difficulty
    Given match "A3F7" is already active (playerO already set)
    When "alice" sends POST /api/matches/A3F7/vs-computer with body { "difficulty": "easy" }
    Then the server responds with HTTP 409
    And the response body is { "error": "Match already started" }
    And the match difficulty is not changed

  Scenario: Auth and ownership guards remain unchanged
    When an unauthenticated client sends POST /api/matches/A3F7/vs-computer
    Then the server responds with HTTP 401
    When "bob" (not the match owner) sends the request with valid session
    Then the server responds with HTTP 403

```
## Acceptance criteria
- AC-1: `POST /api/matches/:code/vs-computer` parses the request body as JSON (if `Content-Type: application/json`) and reads `body.difficulty`. Parsing failures or wrong content-type default to `"medium"`.
- AC-2: The allowed difficulty values are exactly: `trivial`, `easy`, `medium`, `hard`, `expert`, `showcase`. Any other string returns HTTP 400 `{ "error": "Invalid difficulty" }` before `addOpponent` is called.
- AC-3: `MatchStore.addOpponent` (or an equivalent setter) stores the validated difficulty on the match object so it is accessible at `match.difficulty`. Matches created without a difficulty field (legacy) are treated as `"trivial"` at bot-turn time.
- AC-4: The HTTP 200 response body includes a `difficulty` field reflecting the stored value: `{ "code": "...", "role": "X", "mode": "computer", "difficulty": "<value>" }`.
- AC-5: `MatchHub._move` passes `match.difficulty` to the strategy resolver: `this._strategyResolver(match.difficulty).chooseCell(next)`. The resolver must never throw; unknown difficulty falls back to `FirstEmptyCellStrategy` with a `console.warn`.
- AC-6: All existing auth, ownership, status, and 404 guards in the endpoint continue to function as in sprint-05.

## NFR
- latency: Body parsing and difficulty validation add less than 1 ms to the endpoint response time.
- throughput: unknown — needs sales-feedback.
- error budget: Zero matches transitioned to vs-computer with an unvalidated difficulty string. Validated by an automated test that posts an invalid value and asserts HTTP 400.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
