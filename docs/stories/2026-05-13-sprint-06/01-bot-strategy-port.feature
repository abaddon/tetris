Feature: BotStrategy port — pluggable strategy interface for the server-side bot
  As a Tris platform developer
  I want the server-side bot move selection to go through a named strategy interface
  So that additional AI difficulty levels can be plugged in without touching MatchHub

  Background:
    Given the server is running
    And the bot sentinel identifier is "__bot__"
    And "alice" is registered, logged in, and has created match "A3F7"

  Scenario: MatchHub dispatches the bot turn through a BotStrategy object
    Given a BotStrategy implementation is injected into MatchHub at construction
    When the bot's turn is triggered after alice's move
    Then MatchHub calls strategy.chooseCell(state) where state is the current game state
    And the returned cell integer is used as the bot's move
    And no direct call to firstEmptyCell is made by MatchHub itself

  Scenario: FirstEmptyCellStrategy is the default strategy (backward compat)
    Given MatchHub is constructed without an explicit strategy argument
    When the bot's turn is triggered
    Then the bot plays the first empty cell (same behaviour as sprint-05)
    And no regression in existing single-player tests

  Scenario: Injecting a custom strategy changes bot behaviour
    Given a TestStrategy always returning cell 4 (center) is injected into MatchHub
    And the board has cell 4 empty
    When the bot's turn is triggered
    Then the bot plays cell 4 regardless of other empty cells

  Scenario: Strategy is resolved per-match using the difficulty stored on the match
    Given match "A3F7" was created with difficulty "hard"
    And a MinimaxStrategy is registered for difficulty "hard"
    When the bot's turn is triggered for match "A3F7"
    Then MatchHub selects MinimaxStrategy for that match's bot turn
    And a match created with difficulty "easy" uses a different strategy

  Scenario: Strategy chooseCell is passed a board-terminal-safe state
    Given the board is one move from alice winning
    When alice plays the winning move and the game ends
    Then MatchHub does NOT call strategy.chooseCell (game is already terminal)
    And the match transitions directly to ended status

```
## Acceptance criteria
- AC-1: A `BotStrategy` interface is defined (in `shared/` or `server/`) with exactly one method: `chooseCell(state) -> integer in [0..8]`. The contract requires the returned integer to be a legal (null) cell; throwing on an illegal board is permitted.
- AC-2: `MatchHub` constructor accepts an optional `strategyResolver` argument: a function `(difficulty: string) -> BotStrategy`. If omitted, the resolver defaults to always returning a `FirstEmptyCellStrategy`.
- AC-3: `FirstEmptyCellStrategy.chooseCell(state)` delegates to `firstEmptyCell(state.board)` from `shared/game.js` — preserving exact sprint-05 bot behaviour.
- AC-4: When triggering the bot turn in `MatchHub._move`, the hub calls `this._strategyResolver(match.difficulty).chooseCell(next)` instead of directly calling `firstEmptyCell`. `match.difficulty` defaults to `"trivial"` for matches created without a difficulty field.
- AC-5: All existing sprint-05 single-player integration tests pass without modification.
- AC-6: The `BotStrategy` port and its `FirstEmptyCellStrategy` implementation live in `shared/` so they are importable from both `server/` and future test files without circular dependencies.

## NFR
- latency: Strategy resolution (resolver lookup + chooseCell dispatch) adds less than 1 ms overhead relative to the direct `firstEmptyCell` call baseline.
- throughput: unknown — needs sales-feedback.
- error budget: Zero regressions on `./verify.sh` for all sprint-01 through sprint-05 stories.

## Priority
- MoSCoW: must

## Source
- feedback: goal
- feedback: docs/adr/0008-single-player-mode.md §3 (BotStrategy port deferred to sprint-06)
```
