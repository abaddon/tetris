Feature: Five AI difficulty strategies — random, weighted-heuristic, depth-limited minimax, full minimax with alpha-beta, and MCTS
  As a Tris player choosing to play against the computer
  I want the bot to have five named difficulty levels with meaningfully different playing strength
  So that I can choose a challenge appropriate to my skill level

  Background:
    Given the BotStrategy port from story 01 is in place
    And shared/game.js exports play, detectWinner, firstEmptyCell, and WIN_LINES
    And the game is a 3x3 tic-tac-toe board with 9 cells indexed 0–8

  # ------------------------------------------------------------------ #
  # Strategy: Easy (uniform random)                                      #
  # ------------------------------------------------------------------ #

  Scenario: Easy strategy picks a uniformly random legal cell
    Given the board has cells [0,2,4,6,8] occupied and cells [1,3,5,7] empty
    And the Easy strategy is selected
    When chooseCell(state) is called 1000 times with the same board
    Then every call returns an index from {1, 3, 5, 7}
    And the distribution is approximately uniform (each cell appears 20–30% of the time)

  Scenario: Easy strategy never plays an occupied or out-of-range cell
    Given any board with at least one empty cell
    And the Easy strategy is selected
    When chooseCell(state) is called
    Then the returned cell index is in [0..8]
    And state.board[returnedCell] is null

  # ------------------------------------------------------------------ #
  # Strategy: Medium (weighted-cell heuristic + 1-ply win/block scan)   #
  # ------------------------------------------------------------------ #

  Scenario: Medium strategy plays an immediate winning move when available
    Given the board is "XOX.X.O.." (X can win at cell 7)
    And it is X's turn
    And the Medium strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 7 (the winning move)

  Scenario: Medium strategy blocks an opponent's immediate win
    Given the board is "OXO.O.X.." (O can win at cell 4)
    And it is X's turn
    And no immediate win exists for X
    And the Medium strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 4 (blocking O's win)

  Scenario: Medium strategy prefers center when no win or block is needed
    Given the board is empty
    And the Medium strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 4 (center) with high probability (> 50% over 100 calls)

  Scenario: Medium strategy prefers corners over edges when center is taken
    Given the board has only cell 4 occupied (by X) and it is O's turn
    And the Medium strategy is selected
    When chooseCell(state) is called 100 times
    Then the result is a corner cell (0, 2, 6, or 8) more than 60% of the time

  # ------------------------------------------------------------------ #
  # Strategy: Hard (depth-limited minimax, depth 2–3)                  #
  # ------------------------------------------------------------------ #

  Scenario: Hard strategy wins in one move when the opportunity exists
    Given the board is "X.X.O...." and it is X's turn (X can win at cell 1)
    And the Hard strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 1

  Scenario: Hard strategy blocks a two-move forced win (fork) within its depth
    Given a board where O has a fork threat resolvable within 3 plies
    And it is X's turn
    And the Hard strategy is selected
    When chooseCell(state) is called
    Then the returned cell prevents the fork
    And the move is computed within 50 ms

  Scenario: Hard strategy depth is bounded (does not enumerate full game tree)
    Given the board is empty (9 cells, 9! = 362880 possible games)
    And the Hard strategy is configured with depth limit 3
    When chooseCell(state) is called
    Then the strategy evaluates at most 9*8*7 = 504 leaf nodes
    And the call completes within 50 ms

  # ------------------------------------------------------------------ #
  # Strategy: Expert (full minimax with alpha-beta pruning)             #
  # ------------------------------------------------------------------ #

  Scenario: Expert strategy never loses (optimal play against any opponent)
    Given any reachable board state where neither winner nor draw is set
    And it is the Expert bot's turn
    And the Expert strategy is selected
    When chooseCell(state) is called
    Then the returned move is part of an optimal game sequence
    And the game result against a perfect opponent is always draw or win for the bot

  Scenario: Expert strategy on an empty board produces a non-losing opening
    Given the board is empty and it is X's turn
    And the Expert strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 4 (center) or a corner (0, 2, 6, or 8) — both are optimal openings

  Scenario: Expert strategy solves a near-terminal board correctly
    Given the board is "XOXOX.OX." and it is O's turn (O must block at cell 5)
    And the Expert strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 5

  Scenario: Expert strategy completes within the performance budget
    Given any reachable 3x3 board state (~5478 terminal positions)
    And the Expert strategy is selected
    When chooseCell(state) is called
    Then the call completes within 50 ms on the development machine

  # ------------------------------------------------------------------ #
  # Strategy: Showcase (MCTS / UCT)                                     #
  # ------------------------------------------------------------------ #

  Scenario: Showcase MCTS strategy returns a legal cell after a bounded iteration count
    Given the board has at least one empty cell
    And the MCTS strategy is configured with a fixed iteration budget (e.g. 500 simulations)
    And the Showcase strategy is selected
    When chooseCell(state) is called
    Then the returned cell is a legal empty cell
    And the call completes within 50 ms

  Scenario: Showcase MCTS strategy wins immediately when available
    Given the board is "X.X.O...." and it is X's turn (X wins at cell 1)
    And the Showcase strategy is selected
    When chooseCell(state) is called
    Then the returned cell is 1 (MCTS converges to the winning move)

  Scenario: Showcase MCTS strategy produces varied play on an empty board
    Given the board is empty
    And the Showcase strategy is selected
    When chooseCell(state) is called 50 times
    Then at least 3 distinct cells appear in the results (distribution is not deterministic)

  # ------------------------------------------------------------------ #
  # Shared edge case — all strategies                                    #
  # ------------------------------------------------------------------ #

  Scenario Outline: Every strategy throws or handles a full board gracefully
    Given the board is full with no winner (draw state)
    And the <strategy> strategy is selected
    When chooseCell(state) is called
    Then the strategy either throws an error with message containing "no legal move" or returns -1
    And the server catches the error and does not crash

    Examples:
      | strategy  |
      | Easy      |
      | Medium    |
      | Hard      |
      | Expert    |
      | Showcase  |

```
## Acceptance criteria
- AC-1: Five strategy classes are implemented: `EasyStrategy`, `MediumStrategy`, `HardStrategy`, `ExpertStrategy`, `ShowcaseStrategy`. Each implements the `BotStrategy` interface from story 01 (`chooseCell(state) -> int`).
- AC-2: `EasyStrategy.chooseCell` selects uniformly at random from the set of empty cells (cells where `state.board[i] === null`). The built-in `Math.random` is sufficient; no seeding required.
- AC-3: `MediumStrategy.chooseCell` applies moves in this priority order: (1) immediate winning move for the bot, (2) immediate blocking move for the opponent, (3) weighted random selection where center (cell 4) has weight 4, corners (cells 0,2,6,8) have weight 2 each, and edges (cells 1,3,5,7) have weight 1 each.
- AC-4: `HardStrategy.chooseCell` implements minimax search bounded to a configurable depth (default 3 plies). The evaluation function awards +10 for a win, -10 for a loss, 0 for draw or horizon, discounted by depth. Alpha-beta pruning is not required for this tier but is not forbidden.
- AC-5: `ExpertStrategy.chooseCell` implements minimax with alpha-beta pruning over the full 3x3 game tree. Because the tree has at most 9! = 362 880 leaves (in practice ~5478 terminal states reachable without transposition pruning), no memoisation is required; it is permitted. The strategy must return an optimal move for any legal board.
- AC-6: `ShowcaseStrategy.chooseCell` implements the UCT variant of MCTS with a configurable iteration budget (default 500). The UCT exploration constant is configurable and defaults to √2. Simulation rollouts use `EasyStrategy` (random playout). The result is the most-visited child's move.
- AC-7: All five strategies are exported from a single module (e.g. `shared/strategies.js`) and importable by both server code and test files.
- AC-8: No strategy implementation reads from or writes to I/O, the network, or any mutable shared state outside the call stack.

## NFR
- latency: Every strategy's `chooseCell` call completes within 50 ms on the development machine for any legal board state. Timing is recorded in the automated test output.
- throughput: unknown — needs sales-feedback.
- error budget: Zero uncaught exceptions propagating from `chooseCell` to the HTTP response layer. Strategy errors are caught by `MatchHub` and logged; the bot move is skipped gracefully.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
