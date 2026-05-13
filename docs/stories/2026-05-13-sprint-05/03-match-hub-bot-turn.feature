Feature: MatchHub plays bot turn automatically in single-player matches
  As a Tris player in a single-player match
  I want the server to make the computer's move automatically
  So that the game progresses without a second human WebSocket client

  Background:
    Given "alice" is logged in and has a single-player match "A3F7"
    And match "A3F7" has playerX "alice", playerO "__bot__", status "active"
    And "alice" is connected via WebSocket and has subscribed to match "A3F7"
    And the bot strategy is "first empty cell" (lowest-indexed null cell on the board)

  Scenario: Bot plays immediately after the human's move when it is the bot's turn
    Given the board is empty and it is "alice"'s turn (X)
    When "alice" sends { type: "move", cell: 4 }
    Then MatchHub applies alice's move to cell 4
    And MatchHub detects playerO is "__bot__" and it is now O's turn
    And MatchHub selects the first empty cell (cell 0) and applies it as the bot's move
    And "alice"'s WebSocket receives a "match.state" broadcast after alice's move
    And "alice"'s WebSocket receives a second "match.state" broadcast after the bot's move
    And the board reflects both moves

  Scenario: Bot does not move when it is the human's turn
    Given it is "alice"'s turn (X) and the board has two X marks and one O mark
    When no move is sent
    Then MatchHub does not apply any bot move
    And the match state is unchanged

  Scenario: Bot's winning move triggers match end and correct scoring (no award)
    Given the board is one move away from the bot winning
    And it is the bot's turn (O)
    When "alice" sends a move that does NOT prevent the bot's win
    Then MatchHub applies alice's move
    And MatchHub applies the bot's winning move
    And match "A3F7" transitions to status "ended" with winner "O"
    And ScoreStore.award is NOT called (see story 04 AC-2)
    And "alice" receives "match.ended" with { winner: "O" }

  Scenario: Bot's move on a full-board produces a draw — no award
    Given the board has 8 marks and the bot's next move fills the board producing a draw
    When "alice" sends the move that leaves one cell for the bot
    Then MatchHub applies alice's move
    And MatchHub applies the bot's final move
    And match "A3F7" transitions to status "ended" with draw true
    And ScoreStore.award is NOT called
    And "alice" receives "match.ended" with { draw: true }

  Scenario: Human wins — award fires for human only
    Given the board is one move away from "alice" winning
    When "alice" sends the winning move
    Then MatchHub applies alice's move
    And match "A3F7" transitions to status "ended" with winner "X"
    And ScoreStore.award("alice") is called exactly once (see sprint-04 story 04 AC-2)
    And ScoreStore.award("__bot__") is NEVER called
    And "alice" receives "match.ended" with { winner: "X" }
    And no bot move is attempted after the match ends

  Scenario: Bot strategy produces a legal move on every non-terminal board
    Given any board state where at least one cell is null and it is O's turn
    When MatchHub computes the bot move
    Then the selected cell index is in the range 0–8
    And the selected cell is currently null on the board
    And the resulting board state is a valid game state

  Scenario: Disconnecting during a single-player match marks match abandoned
    Given "alice"'s WebSocket is connected to single-player match "A3F7"
    When "alice" closes the WebSocket connection
    Then match "A3F7" status transitions to "abandoned"
    And no further bot moves are attempted

```
## Acceptance criteria
- AC-1: `MatchHub._move` checks, after applying a human move and broadcasting state, whether `match.playerO === BOT_SENTINEL` (the same constant defined in story 02 AC-6) AND `!next.winner && !next.draw`. If both are true and it is now O's turn, MatchHub immediately applies the bot move in the same synchronous tick before returning.
- AC-2: Bot strategy is "first empty cell": iterate `match.game.board` from index 0; select the first index whose value is `null`. This selection uses the existing `play(state, cell)` helper from `shared/game.js` — no new game-logic code is written.
- AC-3: The bot move goes through the identical code path as a human move inside `_move` (same `play()` call, same terminal-state check, same `_broadcastState` and `_broadcast match.ended` calls), so scoring and broadcast rules are automatically inherited.
- AC-4: Because the bot move is applied synchronously in the same event-loop turn as the human move, no `setTimeout` or `setImmediate` deferral is needed. The architect may override this if the ADR review demands a tick separation.
- AC-5: If for any reason `play(state, botCell)` returns the same state object (illegal move — should never happen if first-empty-cell is correct), the hub logs a `console.error` and does NOT enter an infinite loop; it exits without a bot move.
- AC-6: The `_onClose` handler is not changed for single-player matches. The existing logic (mark abandoned, broadcast `match.opponentLeft`) runs as-is; since `"__bot__"` has no WebSocket, no message is sent to the bot. "alice" never receives `match.opponentLeft` from the bot because the bot never disconnects.
- AC-7: Unit tests must cover: (a) bot plays first-empty-cell after human move, (b) bot win does not call `award`, (c) human win calls `award` exactly once, (d) draw calls no `award`.
- AC-8: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: The bot move must be computed and broadcast within the same HTTP/WS response cycle as the human move. Total round-trip for human-move + bot-move visible on the client must remain under 200 ms on localhost.
- throughput: unknown — needs sales-feedback.
- error budget: Bot move failures must be logged (`console.error`) and must not crash the hub or disconnect the human player.
- bot strategy: "first empty cell" (lowest-indexed null cell). This is intentionally deterministic and weak — future stories may replace it. The architect must ratify this strategy in the ADR review before the wave-3 developer implements it.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
