Feature: List open matches waiting for a partner
  As a logged-in Tris player
  I want to see all matches that are waiting for a second player
  So that I can choose one to join instead of having to know a code

  Background:
    Given "alice" is logged in and has created a match with code "A3F7"
    And "dave" is logged in and has created a match with code "B9K2"
    And "bob" is logged in and is on the Tris lobby page

  Scenario: Lobby shows the list of all waiting matches
    When "bob" loads the lobby
    Then "bob" sees a list of open matches containing entries for codes "A3F7" and "B9K2"
    And each entry shows the host's display name ("alice", "dave")

  Scenario: A full match is not shown in the open list
    Given "carol" is logged in
    And "carol" has joined match "A3F7" as Player O
    When "bob" loads the lobby
    Then the open-matches list does not contain code "A3F7"
    And the open-matches list contains code "B9K2"

  Scenario: A player's own waiting match is not shown to themselves as joinable
    When "alice" loads the lobby
    Then the open-matches list either omits her own match "A3F7"
      or shows it visibly marked as "your match" and not clickable to join

  Scenario: An empty list when nothing is open
    Given there are no matches in "waiting" status
    When "bob" loads the lobby
    Then "bob" sees a message such as "No open matches — create one"
    And the "Create match" button remains available

  Scenario: Unauthenticated user cannot read the list
    Given "eve" is not logged in
    When "eve" requests the list of open matches
    Then the server responds with HTTP 401

  Scenario: The list reflects new state without requiring a full page reload
    Given "bob" is on the lobby looking at the open-matches list
    When a new waiting match is created by another player
    Then "bob"'s open-matches list updates to include it within 5 seconds

```
## Acceptance criteria
- AC-1: A GET endpoint (e.g. GET /api/matches?status=waiting) returns a JSON array of waiting matches with at least { code, host, createdAt } per entry.
- AC-2: The endpoint requires authentication; 401 otherwise.
- AC-3: Only matches in status "waiting" appear; "active" and "abandoned" matches are excluded.
- AC-4: The lobby page renders the list on load, sorted oldest-first (longest-waiting opponent visible first) or newest-first — either is acceptable as long as the order is stable and documented in the implementation note.
- AC-5: When the list is empty, the lobby shows a clear empty-state message.
- AC-6: The user's own waiting match must NOT appear as a joinable entry in their own lobby (server may filter, or client must mark/hide it).
- AC-7: The lobby refreshes the list at least every 5 seconds (poll) OR via a push channel — implementation may choose; story 06 only requires the user-visible "auto-refresh within 5s" behavior.
- AC-8: All existing sprint-03 stories (01-05) continue to pass verify.sh.

## NFR
- latency: List endpoint p95 < 200ms with up to 100 waiting matches in memory.
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent failures — network errors must surface in the lobby status area.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
