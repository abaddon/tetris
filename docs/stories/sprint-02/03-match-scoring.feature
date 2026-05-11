Feature: Award points to the winner of each match
  As two players sharing a browser
  I want one point credited to the winning player's name after each match
  So that a running score tracks who is winning the session

  Background:
    Given player X is named "Alice" and player O is named "Bob"
    And both players start with 0 points
    And the game page has loaded

  Scenario: Winning player receives one point
    Given a board state that lets "Alice" (X) win on the next move
    When "Alice" plays the winning move
    Then Alice's score increments by 1
    And the score display reads "Alice 1 – Bob 0"
    And the status reads "Alice wins!"

  Scenario: Draw awards no points to either player
    Given the board state "XOXXOXOXO" results in a draw
    Then Alice's score remains 0
    And Bob's score remains 0
    And the score display reads "Alice 0 – Bob 0"

  Scenario: Score accumulates across multiple matches
    Given Alice has won 2 matches and Bob has won 1 match in this session
    When Alice wins a third match
    Then the score display reads "Alice 3 – Bob 1"

  Scenario: Score resets to zero when a new session is started
    Given Alice's score is 3 and Bob's score is 1
    When the user triggers the "New Session" action (clearing names and scores)
    Then Alice's score is 0
    And Bob's score is 0
    And the name fields are empty

  Scenario: Clicking "Reset" (board-only reset) preserves the current scores
    Given Alice's score is 2 and Bob's score is 1
    And a match has just ended
    When the user clicks the "Reset" button
    Then Alice's score is still 2
    And Bob's score is still 1
    And the board is empty and ready for the next match

```
## Acceptance criteria
- AC-1: After a match ends with a winner, the winning player's score increments by exactly 1; the losing player's score does not change.
- AC-2: A draw leaves both scores unchanged.
- AC-3: The score display (format: "<NameX> N – <NameO> M") is visible on the page at all times during a session.
- AC-4: "Reset" (board reset) preserves scores; "New Session" resets both scores to 0 and clears name fields.
- AC-5: Scores are in-memory only for this story — persistence is handled by the leaderboard story (04).
- AC-6: All sprint-01 scenarios still pass after scoring is introduced.

## NFR
- latency: Score display must update within one animation frame of the game-over determination.
- throughput: N/A (single-machine browser game).
- error budget: Zero regressions against sprint-01 verify.sh green baseline.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
