Feature: Join an existing match by entering a code
  As a logged-in Tris player
  I want to enter a match code shared by my opponent
  So that I am connected to their match as Player O and the game can begin

  Background:
    Given "alice" is logged in and has created a match with code "A3F7"
    And "bob" is logged in and is on the Tris lobby page

  Scenario: Joining a valid pending match succeeds
    When "bob" enters "A3F7" into the join-match field
    And "bob" triggers the "Join Match" action
    Then "bob" is placed in the match as Player O
    And the game board becomes visible to both "alice" and "bob"
    And the status area shows "alice's turn" (Player X goes first)

  Scenario: Alice's waiting screen updates when Bob joins
    Given "alice" is on the waiting screen for match "A3F7"
    When "bob" successfully joins the match
    Then "alice"'s waiting screen is replaced by the game board
    And the status area on "alice"'s screen shows "alice's turn"

  Scenario: Joining with an unknown code shows an error
    When "bob" enters "ZZZZ" into the join-match field
    And "bob" triggers the "Join Match" action
    Then an error reads "Match not found"
    And "bob" remains on the lobby page

  Scenario: Joining a match that already has two players is rejected
    Given "carol" is also logged in
    And "bob" has already joined match "A3F7"
    When "carol" enters "A3F7" and triggers "Join Match"
    Then an error reads "Match is already full"
    And "carol" remains on the lobby page

  Scenario: A player cannot join their own match
    When "alice" enters her own match code "A3F7" into the join-match field
    And "alice" triggers the "Join Match" action
    Then an error reads "You cannot join your own match"
    And "alice" remains on the waiting screen

  Scenario: Match code input is case-insensitive
    When "bob" enters "a3f7" (lowercase) into the join-match field
    And "bob" triggers the "Join Match" action
    Then "bob" joins the match as Player O
    And the game board becomes visible to both players

```
## Acceptance criteria
- AC-1: A join-match field and "Join Match" action are available to any authenticated user in the lobby.
- AC-2: A valid code for a pending (waiting) match admits the joiner as Player O and transitions both players to the game board.
- AC-3: Alice's waiting screen updates automatically when Bob joins — Alice does not need to reload.
- AC-4: An unknown code produces "Match not found".
- AC-5: A code for a full (two-player) match produces "Match is already full".
- AC-6: A player attempting to join their own match is rejected with "You cannot join your own match".
- AC-7: Match code lookup is case-insensitive.
- AC-8: All sprint-01 and sprint-02 verify.sh scenarios continue to pass.

## NFR
- latency: Join action response and board display must appear on both screens within 2 seconds.
- throughput: unknown — needs sales-feedback.
- error budget: Zero silent failures on join — every rejection must produce a visible error message.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
