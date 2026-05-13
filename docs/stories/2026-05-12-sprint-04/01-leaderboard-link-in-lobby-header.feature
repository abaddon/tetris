Feature: Leaderboard link in the lobby header
  As a logged-in Tris player on the lobby page
  I want a clearly visible link to the leaderboard at the top
  So that I can navigate to the leaderboard without typing a URL

  Background:
    Given "alice" is registered and logged in
    And "alice" is on the Tris lobby page

  Scenario: The lobby header contains a Leaderboard link
    When "alice" loads the lobby
    Then she sees a link labelled "Leaderboard" in the page header
    And the link is reachable by keyboard (focusable, has accessible label)

  Scenario: Clicking the Leaderboard link opens the leaderboard page
    When "alice" clicks the "Leaderboard" link in the header
    Then her browser navigates to "/leaderboard.html"

  Scenario: The Leaderboard link does not break any existing lobby flow
    When "alice" loads the lobby
    Then the "Create match" button still works
    And the "Log out" button still works
    And the open-matches list (sprint-03 story 06) still renders

```
## Acceptance criteria
- AC-1: `public/lobby.html` includes an `<a>` link in the `<header>` whose visible text is "Leaderboard" and whose `href` is `/leaderboard.html`.
- AC-2: The link is focusable via Tab and has either visible text or an `aria-label` so screen readers announce it.
- AC-3: Adding the link must not regress any other lobby element — `Log out`, `Create match`, copy code, join-by-code input, open-matches list must continue to function.
- AC-4: All sprint-01 / 02 / 03 stories continue to pass `./verify.sh`.

## NFR
- visual: link styled consistently with existing header buttons (does not require a new design system).
- error budget: zero JS errors introduced on lobby load (check browser console — manual smoke is fine for prototype).

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
