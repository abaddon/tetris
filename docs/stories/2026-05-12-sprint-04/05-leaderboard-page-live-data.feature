Feature: Leaderboard page renders live data from the API
  As a logged-in Tris player viewing the leaderboard
  I want to see the actual top-10 ranked players with their scores
  So that I can see who is winning across all matches instead of a placeholder message

  Background:
    Given "alice" (5 pts), "bob" (3 pts), and "carol" (3 pts) are in the ScoreStore
    And GET /api/leaderboard returns the ranked array (story 03)
    And "alice" is logged in and opens "/leaderboard.html"

  Scenario: Page fetches and renders the ranked table on load
    When the page finishes loading
    Then the "Coming soon" placeholder is no longer visible
    And a table or list of players is rendered with at least one row
    And "alice" (5 pts) is shown in the first row
    And "bob" appears before "carol" (both 3 pts, alphabetical tie-break)
    And each row displays the player's username and their point total

  Scenario: Empty leaderboard (no games scored yet) shows a friendly message
    Given GET /api/leaderboard returns an empty array []
    When the page finishes loading
    Then a message such as "No scores yet — play a match to get on the board!" is displayed
    And no table rows are rendered

  Scenario: API error is surfaced gracefully without a blank page
    Given GET /api/leaderboard returns HTTP 500
    When the page finishes loading
    Then a message such as "Could not load scores — please try again." is displayed
    And the "Back to lobby" link is still visible and functional

  Scenario: Unauthenticated user is redirected to login
    Given "eve" is not logged in (no valid session cookie)
    When "eve" opens "/leaderboard.html"
    Then GET /api/me returns HTTP 401
    And the page sets window.location.href to "/login.html"
    And the leaderboard table is never rendered

  Scenario: Page re-fetches data when the user manually reloads
    Given "alice"'s score increased to 6 after a match win
    When the user triggers a browser reload of "/leaderboard.html"
    Then GET /api/leaderboard is called again
    And "alice"'s row now shows 6 pts

  Scenario: Page is accessible by keyboard
    When "alice" opens "/leaderboard.html"
    Then the "Back to lobby" link is focusable via Tab
    And all interactive elements have accessible labels
    And the leaderboard table (when populated) has a visible caption or heading

```
## Acceptance criteria
- AC-1: `public/leaderboard.html` is updated in-place (not replaced with a new file). The "Coming soon" placeholder element (`#placeholder`) is hidden or removed once data is available.
- AC-2: On page load, the script calls `GET /api/leaderboard`. On a non-2xx response from `/api/me`, it redirects to `/login.html` (existing auth-gate pattern — no change).
- AC-3: On a successful 200 response from `/api/leaderboard` the page renders a ranked list/table: rank position, username, and point total for each entry.
- AC-4: If the array is empty, display a human-readable "no scores yet" message instead of an empty table.
- AC-5: If `/api/leaderboard` returns a non-2xx status or the fetch throws, display a human-readable error message. The "Back to lobby" link must remain functional.
- AC-6: The "Back to lobby" link (`href="/lobby.html"`) and the auth-gate `fetch('/api/me')` call introduced in story 02 are preserved unchanged.
- AC-7: The leaderboard table or list must be navigable by keyboard; each row must be readable by a screen reader (semantic HTML — `<table>` with `<caption>`, or `<ol>/<ul>` with `<li>`, are both acceptable).
- AC-8: No fake or hard-coded score data is ever rendered; all displayed data comes from the API response.
- AC-9: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: The leaderboard table must appear within 1 second of the page load completing under local-network conditions (the API call is the only async step).
- throughput: N/A — single HTTP GET per page load.
- error budget: Zero uncaught JS exceptions on page load (check browser console). A failed `/api/leaderboard` call must not prevent `/api/me` from completing.

## Priority
- MoSCoW: must

## Source
- feedback: goal

## Clarifications
(none — stub page structure confirmed in public/leaderboard.html; API contract defined by story 03)
```
