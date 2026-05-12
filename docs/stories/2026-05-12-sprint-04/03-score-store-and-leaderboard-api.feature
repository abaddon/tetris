Feature: ScoreStore port and GET /api/leaderboard endpoint
  As a logged-in Tris player
  I want the server to maintain a persistent, ranked score table
  So that top-player standings survive restarts and are retrievable over HTTP

  Background:
    Given the server has started and "data/scores.jsonl" is either absent or contains valid JSONL records
    And "alice" (3 pts), "bob" (1 pt), and "carol" (3 pts) are already recorded in the ScoreStore

  Scenario: GET /api/leaderboard returns top 10 entries ranked by score
    When a logged-in client sends GET /api/leaderboard
    Then the server responds with HTTP 200 and Content-Type application/json
    And the response body is a JSON array of at most 10 objects
    And each object has the shape { "username": <string>, "pts": <integer> }
    And entries are ordered by pts descending, then by username ascending for ties
    And "alice" and "carol" (both 3 pts) appear before "bob" (1 pt)
    And "alice" appears before "carol" (alphabetical tie-break)

  Scenario: GET /api/leaderboard with fewer than 10 recorded players returns all of them
    Given the ScoreStore contains exactly 3 entries
    When a logged-in client sends GET /api/leaderboard
    Then the response array has exactly 3 elements

  Scenario: GET /api/leaderboard with more than 10 recorded players caps at 10
    Given the ScoreStore contains 15 distinct player entries
    When a logged-in client sends GET /api/leaderboard
    Then the response array has exactly 10 elements
    And the 10 entries are the players with the highest point totals

  Scenario: Unauthenticated request is rejected
    Given no valid session cookie is attached to the request
    When a client sends GET /api/leaderboard
    Then the server responds with HTTP 401

  Scenario: ScoreStore.award persists across a server restart
    Given "dave" currently has 0 pts in the ScoreStore
    When ScoreStore.award("dave") is called
    And the server process is restarted
    And the store is re-booted by replaying "data/scores.jsonl"
    Then "dave" has 1 pt in the reloaded ScoreStore
    And GET /api/leaderboard includes { "username": "dave", "pts": 1 }

  Scenario: ScoreStore.award is idempotent under concurrent calls for the same username
    Given "eve" currently has 2 pts
    When ScoreStore.award("eve") is called twice concurrently (two Promises resolving in parallel)
    Then "eve" has exactly 3 pts (one award was serialised; no double-count)

  Scenario: Torn final JSONL line on startup is skipped with a warning
    Given "data/scores.jsonl" ends with a partial (invalid JSON) line
    When the server starts and replays the file
    Then the partial line is ignored and a warning is logged to stderr
    And all preceding valid lines are loaded correctly
    And the server starts successfully (HTTP 200 on /api/leaderboard)

```
## Acceptance criteria
- AC-1: A `ScoreStore` port is defined with at minimum the methods `award(username) -> Promise<void>` and `topN(n) -> Promise<Array<{username, pts}>>`. The port contract mirrors the pattern established for `UserStore` in `docs/adr/ports-and-adapters.md`.
- AC-2: A `JsonlScoreStore` adapter backs the port using `data/scores.jsonl` with the same append-only, replay-on-boot pattern as `data/users.jsonl`. An `InMemoryScoreStore` adapter is provided for test use.
- AC-3: `award` increments the named user's total by exactly 1, appends one JSONL line, and fsyncs before resolving. It MUST use the existing `awardWin` helper from `shared/game.js` for the arithmetic — not reimplementing it.
- AC-4: `topN` uses the existing `topN` helper from `shared/game.js` (cap defaults to 10).
- AC-5: `GET /api/leaderboard` is registered in `server/index.js` following the same pattern as other GET routes. It requires an authenticated session (401 if none). It returns JSON matching the schema `[{ username: string, pts: integer }]`.
- AC-6: Concurrent calls to `award` for the same username must not produce a double-credit. An internal serialisation mechanism (e.g. a pending-promise queue keyed by username) is acceptable; the architecture team will validate the approach.
- AC-7: A torn final JSONL line (detected by a `JSON.parse` exception on the last line during boot) is skipped with a `console.warn` and does not prevent startup.
- AC-8: All existing sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: `GET /api/leaderboard` must respond within 200 ms under normal conditions (file I/O is on the hot path only for `award`, not for reads — the in-memory map is authoritative for reads).
- throughput: unknown — needs sales-feedback.
- error budget: `award` must never silently swallow a disk-write error; unhandled rejection must propagate to the caller so MatchHub can log it.
- persistence: `data/scores.jsonl` follows exactly the append-only, fsync, replay-on-boot contract of `data/users.jsonl` (ADR-0004).

## Priority
- MoSCoW: must

## Source
- feedback: goal

## Clarifications
(none — scope and contract derived unambiguously from ADR-0004 and ports-and-adapters.md)
```
