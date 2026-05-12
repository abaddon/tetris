Feature: Create a new multiplayer match and receive a shareable code
  As a logged-in Tris player
  I want to create a new match and receive a short code to share with my opponent
  So that another player can join my match and we can play together

  Background:
    Given "alice" is logged in
    And "alice" is on the Tris lobby page

  Scenario: Creating a match generates a unique shareable code
    When "alice" triggers the "Create Match" action
    Then the page displays a match code (e.g., "A3F7")
    And the page reads "Waiting for opponent to join…"
    And "alice" is assigned as Player X

  Scenario: Match code is short and human-readable
    When "alice" triggers the "Create Match" action
    Then the displayed match code is between 4 and 8 characters
    And the code contains only uppercase letters and digits

  Scenario: Attempting to create a second match while one is pending cancels the first
    Given "alice" already has a pending match with code "A3F7"
    When "alice" triggers "Create Match" again
    Then the previous match with code "A3F7" is closed
    And a new code is displayed
    And the page reads "Waiting for opponent to join…"

  Scenario: Match code is displayed with a copy affordance
    When "alice" triggers the "Create Match" action
    Then the match code is shown in a clearly labelled area
    And a "Copy code" control is visible next to it

  Scenario: Player X cannot make a move before an opponent joins
    Given "alice" has created a match and sees the waiting screen
    When "alice" attempts to click a cell on the board
    Then no move is registered
    And the page still reads "Waiting for opponent to join…"

  Scenario: Navigating away cancels the pending match
    Given "alice" has a pending match with code "A3F7"
    When "alice" triggers the "Log out" action
    Then the match with code "A3F7" is no longer joinable
    And an attempt to join "A3F7" shows "Match not found"

```
## Acceptance criteria
- AC-1: A "Create Match" action is available to any authenticated user in the lobby.
- AC-2: Triggering it produces a unique, human-readable match code of 4–8 uppercase alphanumeric characters.
- AC-3: The creator is assigned as Player X and the UI shows a waiting state until an opponent joins.
- AC-4: The match code is shown with a copy affordance.
- AC-5: Player X cannot make moves while in the waiting state.
- AC-6: Creating a second match while one is pending closes the first match (code becomes un-joinable).
- AC-7: Logging out while a match is pending cancels that match.
- AC-8: All sprint-01 and sprint-02 verify.sh scenarios continue to pass.

## NFR
- latency: Match creation and code display must complete within 2 seconds.
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent failures — if match creation fails, an error must be shown to the user.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
