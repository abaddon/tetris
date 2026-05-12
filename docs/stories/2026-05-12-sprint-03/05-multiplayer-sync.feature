Feature: Real-time move synchronisation between two players
  As a player in an active multiplayer Tris match
  I want every move I make to appear immediately on my opponent's board
  So that both players always see the same game state without refreshing

  Background:
    Given "alice" is logged in as Player X in match "A3F7"
    And "bob" is logged in as Player O in match "A3F7"
    And the game board is visible to both players
    And it is "alice"'s turn

  Scenario: Player X's move appears on Player O's board
    When "alice" clicks cell (row 1, col 1)
    Then "alice"'s board shows an X in cell (row 1, col 1)
    And "bob"'s board shows an X in cell (row 1, col 1) without requiring a reload
    And the status on both boards shows "bob's turn"

  Scenario: Player O cannot move during Player X's turn
    Given it is "alice"'s (Player X) turn
    When "bob" attempts to click any cell
    Then no mark is placed on the board
    And "bob"'s status area reads "alice's turn"

  Scenario: Win is detected and displayed to both players
    Given the board is one move away from "alice" winning
    When "alice" plays the winning move
    Then both "alice"'s and "bob"'s boards show "alice wins!"
    And neither player can place further marks on the board

  Scenario: Draw is detected and displayed to both players
    Given the board has 8 marks and the final cell will result in a draw
    When "alice" plays the final move
    Then both "alice"'s and "bob"'s boards show "Draw!"
    And neither player can place further marks

  Scenario: Rematch is offered after a match ends
    Given "alice wins!" is shown on both screens
    When both players trigger the "Rematch" action
    Then a new game starts within the same match session
    And roles (X and O) swap for the new game
    And the status shows the new Player X's name followed by "'s turn"

  Scenario: Opponent disconnecting is surfaced to the remaining player
    Given "alice" and "bob" are mid-match
    When "bob" loses connection or closes the tab
    Then "alice"'s board shows a notice such as "Opponent disconnected"
    And the match is considered abandoned (no score change)

```
## Acceptance criteria
- AC-1: A move made by the active player appears on the opponent's board without a page reload, within the latency target.
- AC-2: The turn indicator on both boards updates atomically with the move — there is no window where both players see it as their turn.
- AC-3: Only the player whose turn it is can place a mark; out-of-turn clicks produce no state change.
- AC-4: Win and draw conditions are evaluated authoritatively (not solely client-side) and the result is shown on both boards simultaneously.
- AC-5: After a match ends, both players are offered a "Rematch" action; accepting on both sides starts a new game with swapped X/O roles.
- AC-6: If one player disconnects mid-match, the other player sees a clear notice and the match is abandoned without affecting scores.
- AC-7: Sprint-02 scoring and leaderboard rules still apply: the winner earns one point, draws award none, and the persistent leaderboard is updated.
- AC-8: All sprint-01 and sprint-02 verify.sh scenarios continue to pass.

## NFR
- latency: Move propagation from the acting player's click to the opponent's board update must complete within 500 ms under normal local-network conditions.
- throughput: unknown — needs sales-feedback.
- error budget: Out-of-turn moves must never register; a stale board state (where the two clients diverge) must not persist beyond one turn cycle.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
