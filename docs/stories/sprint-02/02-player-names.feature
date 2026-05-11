Feature: Set and display player display names
  As two players sharing a browser
  I want to assign a display name to each side (X and O) before play
  So that the game feels personal and scores are attributed correctly

  Background:
    Given the game page has loaded
    And no match is in progress

  Scenario: Each player enters a name before the first move
    When player X types "Alice" into the name field for X
    And player O types "Bob" into the name field for O
    And the "Start" action is triggered
    Then the status area shows "Alice's turn"
    And the X-side name label reads "Alice"
    And the O-side name label reads "Bob"

  Scenario: Name field falls back to "Player X" when left blank
    When player X leaves the name field for X empty
    And player O leaves the name field for O empty
    And the "Start" action is triggered
    Then the X-side name label reads "Player X"
    And the O-side name label reads "Player O"

  Scenario: Name is trimmed of leading and trailing whitespace
    When player X enters "  Alice  " into the name field for X
    And the "Start" action is triggered
    Then the X-side name label reads "Alice"

  Scenario: Name longer than 20 characters is rejected at input
    When player X attempts to type a 21-character string into the name field for X
    Then the name field for X contains at most 20 characters
    And no error overlay is shown

  Scenario: Current player's name appears in the status line during play
    Given player X is named "Alice" and player O is named "Bob"
    And it is player O's turn
    Then the status area shows "Bob's turn"

  Scenario: Names persist when the Reset button is clicked mid-session
    Given player X is named "Alice" and player O is named "Bob"
    And a match is in progress
    When the user clicks the "Reset" button
    Then the X-side name label still reads "Alice"
    And the O-side name label still reads "Bob"
    And the status area shows "Alice's turn"

```
## Acceptance criteria
- AC-1: A name-entry control exists for each side (X and O) and is visible before a match starts.
- AC-2: When the "Start" action is triggered, the entered names replace every occurrence of bare "X" / "O" labels in the status line.
- AC-3: Blank or whitespace-only names fall back to the default "Player X" / "Player O" strings.
- AC-4: Input is capped at 20 characters; characters beyond the cap are silently dropped by the field.
- AC-5: Names survive a within-session reset (clicking "Reset" clears the board but not the name fields).
- AC-6: All existing sprint-01 scenarios still pass after name-entry is introduced.

## NFR
- latency: Name label update must be synchronous with the "Start" action — no perceptible delay.
- throughput: N/A (single-machine browser game).
- error budget: Zero regressions against sprint-01 verify.sh green baseline.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
