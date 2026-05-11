Feature: Play a game of Tris (tic-tac-toe)
  As two players sharing a browser
  We want to play 3-in-a-row on a 3x3 grid
  So that we can determine a winner or a draw

  Background:
    Given a fresh 3x3 grid with all cells empty
    And it is player "X"'s turn

  Scenario: First move places X on an empty cell
    When player "X" clicks the top-left cell
    Then the top-left cell shows "X"
    And the status reads "Turn: O"

  Scenario: Players alternate turns
    Given player "X" has played the center
    When player "O" clicks the top-right cell
    Then the top-right cell shows "O"
    And the status reads "Turn: X"

  Scenario: Cannot play on an occupied cell
    Given the center cell already shows "X"
    When player "O" clicks the center cell
    Then the center cell still shows "X"
    And the status still reads "Turn: O"

  Scenario Outline: Winning by completing a row, column, or diagonal
    Given the board state "<board>"
    And it is player "<mover>"'s turn
    When player "<mover>" clicks cell <cell>
    Then the status reads "Winner: <mover>"
    And no further moves are accepted until reset

    Examples:
      | board     | mover | cell |
      | XX.......  | X     | 2    |
      | OO.XX....  | O     | 2    |
      | X...X....  | X     | 8    |
      | ..X.X....  | X     | 6    |

  Scenario: Draw when all cells filled with no winner
    Given the board state "XOXXOXOXO" with all cells filled and no 3-in-a-row
    Then the status reads "Draw"
    And no further moves are accepted until reset

  Scenario: Reset returns the game to the initial state
    Given a finished game with status "Winner: X"
    When the user clicks the "Reset" button
    Then every cell is empty
    And the status reads "Turn: X"
