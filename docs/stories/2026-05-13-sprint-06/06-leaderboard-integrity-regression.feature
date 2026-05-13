Feature: Leaderboard integrity — bot games still excluded regardless of difficulty level
  As a Tris player viewing the leaderboard
  I want the leaderboard to contain only human players
  So that bot wins at any difficulty do not pollute the ranked list

  Background:
    Given the server is running with the full production store stack
    And the bot sentinel identifier is "__bot__"
    And "alice" is registered and logged in
    And all sprint-05 story 05 sentinel exclusion layers are in place

  Scenario: Bot win at Easy difficulty does not award a leaderboard point
    Given match "A3F7" was started vs-computer with difficulty "easy"
    And the bot (EasyStrategy) wins the match
    When GET /api/leaderboard is called
    Then "__bot__" does not appear in the response at any difficulty level
    And alice's score is unchanged (she did not win)

  Scenario: Bot win at Expert difficulty does not award a leaderboard point
    Given match "B2K1" was started vs-computer with difficulty "expert"
    And the bot (ExpertStrategy) wins the match
    When GET /api/leaderboard is called
    Then "__bot__" does not appear in the response

  Scenario: Human win against any bot difficulty still awards the leaderboard point
    Given match "C5J9" was started vs-computer with difficulty "showcase"
    And "alice" wins the match against the Showcase bot
    When GET /api/leaderboard is called
    Then "alice" appears with a score incremented by 1
    And "__bot__" does not appear

  Scenario: Draw against any bot difficulty awards no points to either side
    Given match "D7M3" was started vs-computer with difficulty "medium"
    And the match ends in a draw
    When GET /api/leaderboard is called
    Then neither "alice" nor "__bot__" gains a point from this match
    And the leaderboard is unchanged from before the match

  Scenario: Sprint-05 sentinel guard layers are not bypassed by new strategy dispatch
    Given match "E1P6" was started vs-computer with difficulty "hard"
    And HardStrategy.chooseCell returns cell 8 which causes a bot win
    When the bot win is processed by MatchHub
    Then MatchHub does NOT call scoreStore.award for "__bot__"
    And even if award were called, ScoreStore rejects it with code SENTINEL_REJECTED
    And even if a record reached the JSONL, the boot-replay and topN filters exclude it

  Scenario: Adding a new difficulty level does not open a scoring gap
    Given a new difficulty value is introduced and its strategy is wired in
    When a match at that new difficulty ends with a bot win
    Then the existing sentinel guard at MatchHub._move still fires
    And no leaderboard entry for "__bot__" is created

  Scenario: ./verify.sh confirms all sprint-05 leaderboard story 05 acceptance criteria still pass
    When ./verify.sh is executed after sprint-06 changes are applied
    Then all AC-1 through AC-9 from sprint-05/05-leaderboard-exclusion-and-ui-polish still pass
    And the new strategy dispatch code introduces zero leaderboard regressions

```
## Acceptance criteria
- AC-1: The sentinel guard in `MatchHub._move` (`if (winnerUsername !== BOT_SENTINEL)`) applies regardless of which strategy was used to compute the bot's move. No strategy-selection code path bypasses this guard.
- AC-2: `ScoreStore.award` continues to reject any call where `usernameDisplay.toLowerCase() === '__bot__'` with `{ code: 'SENTINEL_REJECTED' }`, as specified in sprint-05 story 04 AC-5. This requirement is unchanged.
- AC-3: `JsonlScoreStore.boot()` sentinel skip and `topN()` sentinel filter (sprint-05 story 05 AC-2 and AC-3) remain unmodified and continue to pass their existing tests.
- AC-4: `GET /api/leaderboard` post-filter (sprint-05 story 05 AC-1) remains unmodified.
- AC-5: Automated tests cover at minimum: bot win at "easy", bot win at "expert", human win at "showcase", draw at "medium". Each test asserts that `GET /api/leaderboard` response does not contain `__bot__` and that alice's score changes only when she wins.
- AC-6: `./verify.sh` exits zero with all sprint-05 story 05 ACs passing after sprint-06 code is applied.

## NFR
- latency: The sentinel filter adds zero measurable latency (same `Array.filter` over at most 10 elements as in sprint-05).
- throughput: unknown — needs sales-feedback.
- error budget: Zero occurrences of `__bot__` in any leaderboard API response across all difficulty levels. Verified by automated tests seeding the store with a bot-win record at each difficulty and asserting exclusion.

## Priority
- MoSCoW: must

## Source
- feedback: goal
- feedback: docs/stories/2026-05-13-sprint-05/05-leaderboard-exclusion-and-ui-polish.feature (regression scope)
- feedback: docs/adr/0008-single-player-mode.md §4 (scoring gate — defence-in-depth at two layers)
```
