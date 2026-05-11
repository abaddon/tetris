Feature: Persistent leaderboard showing top players
  As a player
  I want to see a leaderboard of the highest-scoring players across all sessions
  So that I can track long-term standings and be motivated to keep playing

  Background:
    Given the leaderboard is stored in localStorage under the key "tris_leaderboard"
    And the game page has loaded

  Scenario: Leaderboard is visible on the page at startup
    Then a leaderboard panel is present in the DOM
    And it shows a heading (e.g., "Leaderboard")
    And it lists entries in descending order of points

  Scenario: Winning a match writes the winner's total to the leaderboard
    Given "Alice" has 0 points on the leaderboard
    And player X is named "Alice"
    When Alice wins a match (bringing her session score to 1)
    Then the leaderboard entry for "Alice" shows 1 point
    And the leaderboard is re-rendered immediately

  Scenario: Points accumulate for a returning player name
    Given the leaderboard already has an entry "Alice: 3"
    And player X is named "Alice"
    When Alice wins another match
    Then the leaderboard entry for "Alice" shows 4 points
    And the previous entry for "Alice" is replaced (not duplicated)

  Scenario: Leaderboard survives a page reload
    Given "Alice" has 4 points on the leaderboard in localStorage
    When the user reloads the page
    Then the leaderboard panel still shows "Alice: 4"

  Scenario: Leaderboard shows at most the top 10 players
    Given the leaderboard has 12 distinct player entries
    Then the leaderboard panel renders exactly 10 rows
    And only the 10 players with the highest point totals are shown

  Scenario: Draw does not create or update a leaderboard entry
    Given "Alice" has 2 points on the leaderboard
    And the match ends in a draw
    Then the leaderboard entry for "Alice" still shows 2 points
    And no new entry is added for a draw

  Scenario: Players tied on points are ordered alphabetically as a tiebreaker
    Given the leaderboard has "Carol: 5" and "Alice: 5"
    Then "Alice" appears above "Carol" in the leaderboard

```
## Acceptance criteria
- AC-1: A leaderboard panel is rendered on the page at all times; it is never hidden.
- AC-2: On match win, the winning player's cumulative total (across all sessions) is updated in localStorage and the panel re-renders without a page reload.
- AC-3: The panel shows at most 10 entries, ranked by points descending; ties broken alphabetically ascending.
- AC-4: After a page reload, leaderboard data is restored from localStorage and the panel displays correctly.
- AC-5: Draws do not modify localStorage or the panel.
- AC-6: If localStorage is unavailable (private-browsing quota error), the leaderboard degrades gracefully — the panel shows "Scores unavailable" and the game continues normally.
- AC-7: All sprint-01 scenarios still pass after the leaderboard is introduced.

## NFR
- latency: Leaderboard re-render must complete within one animation frame of a match ending.
- throughput: N/A (single-machine browser game).
- error budget: Zero regressions against sprint-01 verify.sh green baseline; localStorage write must not throw an unhandled exception.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
