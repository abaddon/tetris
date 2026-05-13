Feature: Difficulty picker UI — select control on game.html persisted to localStorage
  As a Tris player starting a single-player match
  I want to choose a difficulty level before the bot joins
  So that I can control the challenge level without being forced to accept a default

  Background:
    Given "alice" is registered and logged in
    And "alice" has created match "A3F7" and the match-waiting panel is visible in lobby.html
    And the five difficulty levels are: Trivial, Easy, Medium, Hard, Expert, Showcase
    And the default difficulty is "Medium"

  Scenario: Difficulty select control appears alongside the "Play vs Computer" button
    When "alice" views the match-waiting panel after creating a match
    Then a <select> element with id "difficulty-select" is present inside the match-waiting panel
    And the select has six options: "Trivial", "Easy", "Medium", "Hard", "Expert", "Showcase"
    And the option labelled "Medium" is selected by default

  Scenario: Selected difficulty is persisted to localStorage immediately on change
    Given the difficulty picker shows "Medium" selected
    When "alice" changes the picker to "Hard"
    Then localStorage key "tris_difficulty" is set to "hard"
    And the picker shows "Hard" as the selected option

  Scenario: Difficulty is restored from localStorage on page load
    Given localStorage key "tris_difficulty" is "expert"
    When "alice" loads lobby.html
    And the match-waiting panel becomes visible
    Then the difficulty picker shows "Expert" selected (restored from storage)

  Scenario: Difficulty from localStorage is used when clicking "Play vs Computer"
    Given localStorage key "tris_difficulty" is "hard"
    And "alice" has match "A3F7" in waiting state
    When "alice" clicks "Play vs Computer"
    Then the browser calls POST /api/matches/A3F7/vs-computer with body { "difficulty": "hard" }
    And on HTTP 200 the browser navigates to "/game.html?code=A3F7&role=X&mode=computer&difficulty=hard"

  Scenario: game.html shows the selected difficulty label during play
    Given "alice" navigates to "/game.html?code=A3F7&role=X&mode=computer&difficulty=hard"
    When the match state is rendered
    Then the page displays a label showing "Difficulty: Hard" near the player-info area
    And the label is not shown when mode is not "computer"

  Scenario: Unknown difficulty value in localStorage falls back to "medium"
    Given localStorage key "tris_difficulty" is "legendary" (unrecognised value)
    When "alice" loads lobby.html
    Then the difficulty picker defaults to "Medium"
    And localStorage key "tris_difficulty" is overwritten with "medium"

  Scenario: Difficulty picker is absent in PvP (non-computer) mode
    Given "alice" navigates to "/game.html?code=B9K2&role=X" (no mode=computer)
    When the page renders
    Then no difficulty picker or difficulty label is visible

  Scenario: All existing lobby elements continue to function
    Given the difficulty picker has been added
    When "alice" interacts with "Create match", "Log out", "Copy code", and the join-by-code input
    Then all those elements continue to work as in sprint-05
    And ./verify.sh passes all sprint-01 through sprint-05 story tests

```
## Acceptance criteria
- AC-1: `public/lobby.html` contains a `<select id="difficulty-select">` element inside the match-waiting panel. The options and their `value` attributes are: `trivial`, `easy`, `medium` (default selected), `hard`, `expert`, `showcase`.
- AC-2: When the user changes the select, `localStorage.setItem('tris_difficulty', selectedValue)` is called immediately (on the `change` event). The stored value is always lowercase.
- AC-3: On lobby page load, if `localStorage.getItem('tris_difficulty')` returns a value in the allowed set `{trivial, easy, medium, hard, expert, showcase}`, that option is pre-selected. If the stored value is absent or unrecognised, the select defaults to `"medium"` and `localStorage` is updated.
- AC-4: `POST /api/matches/:code/vs-computer` is called with a JSON body `{ "difficulty": "<selected value>" }`. The `Content-Type: application/json` header must be included.
- AC-5: On HTTP 200 the lobby navigates to `/game.html?code=<code>&role=X&mode=computer&difficulty=<selectedValue>`.
- AC-6: `public/game.html` reads the `difficulty` query-string parameter and, when `mode=computer`, displays a `<span id="difficulty-label">Difficulty: <Capitalised name></span>` adjacent to `#player-info`. The span is absent (not just hidden) when `mode !== 'computer'`.
- AC-7: No existing lobby or game element (sprint-01 through sprint-05) regresses.

## NFR
- latency: The picker adds no network round-trip; localStorage read/write is synchronous and negligible.
- throughput: unknown — needs sales-feedback.
- error budget: Zero JS exceptions when localStorage is unavailable (e.g. private-browsing quota exceeded); degrade silently to default difficulty.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
