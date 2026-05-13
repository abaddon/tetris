Feature: Every bot strategy completes one move within 50 ms on the development machine
  As a Tris platform operator
  I want a verified performance budget for each AI strategy
  So that the server event loop is not blocked during bot turns regardless of difficulty

  Background:
    Given the BotStrategy port and all five strategies from story 02 are implemented
    And shared/game.js is the sole authority for board representation
    And the test harness records wall-clock time for each chooseCell call

  Scenario Outline: <strategy> strategy meets the 50 ms budget on a cold start board
    Given the board is in the state "<board_state>" and it is <turn>'s turn
    And the <strategy> strategy is selected
    When the test harness calls chooseCell(state) and measures elapsed wall-clock time
    Then the call completes in less than 50 ms
    And the actual elapsed time is printed to the test output for traceability

    Examples:
      | strategy  | board_state   | turn |
      | Easy      | ......... (empty) | X    |
      | Medium    | ......... (empty) | X    |
      | Hard      | ......... (empty) | X    |
      | Expert    | ......... (empty) | X    |
      | Showcase  | ......... (empty) | X    |

  Scenario Outline: <strategy> strategy meets the 50 ms budget on a mid-game board
    Given the board is "XO.X.O..." and it is X's turn
    And the <strategy> strategy is selected
    When the test harness calls chooseCell(state) and measures elapsed wall-clock time
    Then the call completes in less than 50 ms
    And the actual elapsed time is printed to the test output

    Examples:
      | strategy  |
      | Easy      |
      | Medium    |
      | Hard      |
      | Expert    |
      | Showcase  |

  Scenario: Expert strategy on empty board is the worst-case scenario and still meets budget
    Given the board is empty (maximum search space for minimax)
    And the Expert strategy is selected
    When the test harness calls chooseCell(state) 10 times and records each duration
    Then all 10 calls complete in less than 50 ms
    And the median duration is recorded in the test output

  Scenario: Showcase MCTS with 500 iterations on empty board meets budget
    Given the board is empty
    And the Showcase strategy is configured with 500 UCT iterations
    When the test harness calls chooseCell(state) 10 times
    Then all 10 calls complete in less than 50 ms
    And the iteration count and elapsed time per call are printed to test output

  Scenario: Timing regression test is part of the verify.sh suite
    Given all strategy performance tests are defined in the project test file
    When ./verify.sh is executed
    Then the timing tests run as part of the suite
    And any strategy exceeding 50 ms causes the suite to fail with a clear message

```
## Acceptance criteria
- AC-1: For each of the five strategies, at least two timing test cases exist in the project test file: one for an empty board and one for a mid-game board. Both must pass within 50 ms.
- AC-2: Each timing test uses `Date.now()` (or `performance.now()` if available in the Node version) to measure wall-clock duration. The measured duration is asserted to be `< 50` and is `console.log`-d in milliseconds.
- AC-3: The Expert strategy worst-case (empty board, full minimax) is explicitly tested. If alpha-beta pruning is implemented correctly, the typical duration is expected to be below 10 ms; the test allows up to 50 ms to tolerate CI variance.
- AC-4: The Showcase MCTS iteration budget is capped at 500 by default so the 50 ms budget is met. The cap is a named constant (not a magic number in the strategy body).
- AC-5: `./verify.sh` exits non-zero if any timing assertion fails.
- AC-6: No existing test is removed or weakened to accommodate the new timing tests.

## NFR
- latency: 50 ms per `chooseCell` call is the hard ceiling, measured on the developer's local machine. CI environment variance is acceptable as long as the measured value is logged for human review.
- throughput: The server is single-threaded; one bot turn per event-loop tick. Concurrent single-player matches are not a concern this sprint — throughput NFR is unknown — needs sales-feedback.
- error budget: Zero failing timing assertions on a correctly configured development machine running Node 18+.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
