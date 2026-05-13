Feature: Lobby "Play vs Computer" button transitions match to single-player mode
  As a logged-in Tris player who has just created a match
  I want to see a "Play vs Computer" button in the match-waiting panel
  So that I can start a game immediately without waiting for a human opponent

  Background:
    Given "alice" is registered and logged in
    And "alice" is on the Tris lobby page

  Scenario: "Play vs Computer" button appears after match creation
    When "alice" clicks "Create match"
    Then the match-waiting panel becomes visible with the generated match code
    And a "Play vs Computer" button appears inside the match-waiting panel
    And the existing "Waiting for opponent to join…" label is also present
    And the "Copy code" button is also present

  Scenario: Clicking "Play vs Computer" calls the vs-computer endpoint and navigates to game
    Given "alice" has created match "A3F7" and the match-waiting panel is visible
    When "alice" clicks "Play vs Computer"
    Then the browser calls POST /api/matches/A3F7/vs-computer with the session cookie
    And on HTTP 200 the browser navigates to "/game.html?code=A3F7&role=X&mode=computer"
    And "Waiting for opponent to join…" is no longer displayed as the status label

  Scenario: vs-computer endpoint error surfaces in the status area
    Given "alice" has created match "A3F7" and the match-waiting panel is visible
    And POST /api/matches/A3F7/vs-computer returns HTTP 409 with { "error": "Match already started" }
    When "alice" clicks "Play vs Computer"
    Then the status area displays "Match already started"
    And the browser does not navigate away from the lobby

  Scenario: "Play vs Computer" button is not present before a match is created
    When "alice" loads the lobby without having created a match
    Then the match-waiting panel is hidden
    And no "Play vs Computer" button is visible

  Scenario: "Play vs Computer" button disappears once a human opponent joins via the join flow
    Given "alice" has created match "A3F7" and the match-waiting panel is visible
    When "bob" joins match "A3F7" via POST /api/matches/A3F7/join
    Then if alice's lobby page receives any notification, "Play vs Computer" is no longer actionable
    And the normal PvP game flow proceeds unchanged (see sprint-03 story 04)

```
## Acceptance criteria
- AC-1: After `POST /api/matches` succeeds and the match-waiting panel is shown (`#match-panel.visible`), `public/lobby.html` renders a button with visible text "Play vs Computer" inside that panel.
- AC-2: Clicking "Play vs Computer" issues `POST /api/matches/<code>/vs-computer` (auth cookie forwarded automatically). On HTTP 200 the page navigates to `/game.html?code=<code>&role=X&mode=computer`.
- AC-3: On any non-200 response, the error message from the JSON body (`res.error`) is written to `#status`; no navigation occurs.
- AC-4: The "Play vs Computer" button must NOT be present in the DOM when the match-waiting panel is hidden (before match creation or after navigating away).
- AC-5: No existing lobby element regresses: "Create match", "Log out", "Copy code", join-by-code input, and the open-matches list (sprint-03 story 06) must continue to work.
- AC-6: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: Button click to navigation must not introduce a blocking delay beyond the single POST round-trip.
- throughput: unknown — needs sales-feedback.
- error budget: Zero JS exceptions on lobby load or click (verify via browser console smoke test).

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
