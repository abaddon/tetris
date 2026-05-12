Feature: Click an open match to auto-join it
  As a logged-in Tris player viewing the list of open matches
  I want to click an entry to join it immediately
  So that I do not have to type a code to play with someone

  Background:
    Given "alice" is logged in and has created a match with code "A3F7"
    And "bob" is logged in and is on the Tris lobby page
    And "bob" can see the open-matches list containing match "A3F7"

  Scenario: Clicking an open match joins it as Player O
    When "bob" clicks the entry for match "A3F7"
    Then "bob" is joined to match "A3F7" as Player O
    And "bob" is navigated to the game screen
    And "alice"'s waiting screen transitions to the game board

  Scenario: Clicking a match that just filled up shows an error and refreshes
    Given "carol" has just joined match "A3F7" as Player O
    When "bob" clicks the entry for match "A3F7" (his list is stale)
    Then "bob" sees an error such as "Match is already full"
    And the open-matches list refreshes
    And "bob" remains on the lobby page

  Scenario: The manual code-entry input remains available as a fallback
    Given "bob" is on the lobby
    Then a join-by-code input is still visible
    And entering a valid code there continues to join that match

  Scenario: No open matches — user can create one
    Given the open-matches list is empty
    When "bob" clicks "Create match"
    Then "bob" creates a new waiting match
    And his entry appears in the open-matches list of any other lobby user within 5 seconds

```
## Acceptance criteria
- AC-1: Each entry in the open-matches list is clickable (button, link, or row with a clear affordance and keyboard support).
- AC-2: Clicking an entry triggers POST /api/matches/:code/join with the row's code; on success the user is navigated to /game.html?code=...&role=O.
- AC-3: Click-to-join surfaces all join-error states from story 04 (404 NOT_FOUND, 409 FULL, 409 SELF_JOIN) in the lobby status area without leaving the page.
- AC-4: After a failed click-to-join, the open-matches list refreshes so stale entries (e.g. just-filled matches) are removed.
- AC-5: The existing manual "join by code" input continues to work as a fallback path (regression of story 04).
- AC-6: "Create match" remains available and prominent when the list is empty.
- AC-7: All existing sprint-03 stories (01-06) continue to pass verify.sh.

## NFR
- latency: Click-to-join visible response (navigation or error) within 1s on local network.
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent failures on click; every reject reason from the server is surfaced.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
