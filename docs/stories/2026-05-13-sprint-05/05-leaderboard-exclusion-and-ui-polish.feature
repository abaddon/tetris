Feature: Leaderboard excludes sentinel under all conditions; game.html shows "Computer" label
  As a Tris player viewing the leaderboard or playing a single-player match
  I want the computer to be invisible on the leaderboard and labelled "Computer" in-game
  So that the leaderboard reflects only human players and the UI never shows "Waiting for opponent"

  Background:
    Given the server is running with the full production store stack
    And the bot sentinel identifier is "__bot__"
    And "alice" is registered and logged in

  Scenario: GET /api/leaderboard never returns the sentinel even if scores.jsonl contains it
    Given "data/scores.jsonl" contains a malformed historical record { usernameLower: "__bot__", usernameDisplay: "__bot__", delta: 1, at: ... }
    When a logged-in client sends GET /api/leaderboard
    Then the server responds with HTTP 200
    And the response array does NOT contain any entry with username "__bot__" or any case variant
    And all other entries are returned normally

  Scenario: Sentinel exclusion applies when "Computer" is a registered human account
    Given a user named "Computer" (usernameDisplay: "Computer") is registered and has 5 pts
    And the bot sentinel "__bot__" also exists in the store (by any means)
    When a logged-in client sends GET /api/leaderboard
    Then the entry for "Computer" (the human account) IS present with 5 pts
    And no entry for "__bot__" is present

  Scenario: Sentinel exclusion applies to all case variants in the store
    Given "data/scores.jsonl" contains entries for "__bot__", "__BOT__", and "__Bot__"
    When the store is replayed on boot and GET /api/leaderboard is called
    Then none of those entries appear in the leaderboard response
    And the in-memory map does not hold any key whose toLowerCase() equals "__bot__"

  Scenario: game.html shows "Computer" as the opponent label in single-player mode
    Given "alice" navigates to "/game.html?code=A3F7&role=X&mode=computer"
    And the server sends a "match.state" message with playerO "__bot__"
    When the page renders the state
    Then the opponent label shown to "alice" is "Computer" (not "__bot__" and not "Waiting…")
    And the status line never shows "Waiting for opponent to join…"
    And the board is enabled for alice's move immediately (match is active)

  Scenario: game.html shows "Waiting for opponent to join…" in PvP mode when no opponent has joined
    Given "alice" navigates to "/game.html?code=B9K2&role=X" (no mode=computer)
    And the server sends "match.state" with status "waiting" and playerO null
    When the page renders the state
    Then the status shows "Waiting for opponent to join…"
    And the board is disabled

  Scenario: game.html shows "Computer wins!" when the bot wins
    Given "alice" is on the game page of single-player match "A3F7"
    And the server sends "match.state" with winner "O", playerO "__bot__"
    When the page renders the state
    Then the status shows "Computer wins!"
    And the board is fully disabled

  Scenario: game.html shows normal win text when alice wins against the computer
    Given "alice" is on the game page of single-player match "A3F7"
    And the server sends "match.state" with winner "X", playerX "alice", playerO "__bot__"
    When the page renders the state
    Then the status shows "alice wins!"
    And the Rematch button is hidden (rematch is not supported in single-player — see AC-6)

  Scenario: Leaderboard page (leaderboard.html) is unchanged and keeps working
    Given "alice" navigates to "/leaderboard.html"
    When the page fetches GET /api/leaderboard
    Then the page renders the ranked list without "__bot__" regardless of store contents
    And all existing sprint-04 story 05 acceptance criteria continue to hold

```
## Acceptance criteria
- AC-1: `GET /api/leaderboard` handler in `server/index.js` filters the result of `scoreStore.topN(10)` to exclude any entry where `username.toLowerCase() === '__bot__'` before sending the response. This filter is applied after the `name -> username` mapping, so it works against the already-mapped field.
- AC-2: `ScoreStore.boot()` (replay on startup) skips any JSONL line where `record.usernameLower === '__bot__'` (or `toLowerCase() === '__bot__'`), so malformed historical sentinel records never enter the in-memory map.
- AC-3: `ScoreStore.topN()` additionally filters out any in-memory entry whose key `.toLowerCase() === '__bot__'` before passing the store object to `shared/game.js#topN`. This is a belt-and-suspenders guard.
- AC-4: None of AC-1 through AC-3 affect entries for a legitimately registered human account named "Computer" (or any other name); only the exact sentinel `__bot__` (case-insensitive) is excluded.
- AC-5: `public/game.html` resolves the display name for `playerO` as follows: if `msg.playerO === '__bot__'`, display "Computer"; otherwise display `msg.playerO` (existing behaviour). This substitution applies to the `oName` variable (or equivalent) used for status text construction.
- AC-6: When `mode=computer` is present in the URL query string, `game.html` must NOT show the Rematch button after game end. Rematch is a two-human protocol and is not supported in single-player mode this sprint.
- AC-7: When `msg.playerO === '__bot__'` (or `msg.status === 'active'` combined with `mode=computer` in the URL), `game.html` must NOT display "Waiting for opponent to join…". The status line must immediately reflect the active-game state (whose turn it is) or the game-over result.
- AC-8: `public/leaderboard.html` requires no code change this sprint. Confirm via `./verify.sh` that all sprint-04 story 05 acceptance criteria still pass.
- AC-9: All sprint-01 through sprint-04 stories continue to pass `./verify.sh`.

## NFR
- latency: The sentinel filter in AC-1 is an array `.filter()` on at most 10 elements; it adds zero measurable latency to the leaderboard response.
- throughput: unknown — needs sales-feedback.
- error budget: Zero instances of "__bot__" appearing in any leaderboard API response or rendered leaderboard page, verified by an automated test that seeds the store with a sentinel record and then calls the endpoint.

## Priority
- MoSCoW: must

## Source
- feedback: goal
```
