# Sprint 04 — Server-Side Leaderboard Scoring

## Summary

Tris now tracks wins where it counts: on the server. When a match ends
with a winner, that player earns +1 point, persisted immediately to
`data/scores.jsonl` with an fsync on every write. Points survive server
restarts. A new `/leaderboard.html` page pulls the live top-10 from
`GET /api/leaderboard` and renders them in ranked order (points
descending, username alphabetical on ties). Draws and abandoned matches
award nothing. The leaderboard link lives in the lobby header, so it's
one click from wherever you are.

## What Changed

- **Server-side scoring**: `MatchHub` calls `scoreStore.award(winner)`
  once per terminal match where a winner exists. Draws and abandons are
  explicitly excluded. (commit `c416047`)
- **Persistent ScoreStore**: wins are appended as JSONL deltas to
  `data/scores.jsonl` with `fsync` on every award — survives crashes and
  restarts without losing a recorded win. (commit `de472b0`, `fec400e`)
- **`GET /api/leaderboard`**: auth-required endpoint returns
  `[{username, pts}]`, capped at 10 entries, sorted points DESC then
  username ASC for ties. (commit `de472b0`)
- **Live leaderboard page**: `/leaderboard.html` renders the top-10
  directly from the API — no fake data, no localStorage fallback. Empty
  state shows "No scores yet — play a match to get on the board!"
  (commit `a8df8ce`, `6f10648`)
- **Lobby header link**: "Leaderboard" navigation added to the lobby
  header. (commit `d115e87`)
- **ADR-0007**: documents the `ScoreStore` port, persistence strategy,
  concurrency assumptions, and the delegation to `awardWin` / `topN`
  from `shared/game.js`. (commit `13bfcf8`)

## What's Next

File compaction for `scores.jsonl` is the obvious follow-up once the
file grows large enough to matter — ADR-0007 calls this out explicitly.
A "my rank" endpoint or a websocket-pushed leaderboard update would
close the loop between match results and live scoreboard without a page
refresh.

---

## Tweet (3 variants, pick one)

**Variant A** (features-first)
```
Tris now keeps score. Win a match → +1 point, server-side, fsync'd,
survives restarts. Top-10 leaderboard live at /leaderboard.html.
Draws and ragequits still award nothing. Go win something.
```
(248 chars)

**Variant B** (technical hook)
```
Sprint 04: swapped the localStorage leaderboard trinket for a real
server-side ScoreStore. JSONL append-only, fsync on award, replayed
on boot. No new deps — Node stdlib only. /api/leaderboard is live.
```
(214 chars)

**Variant C** (one-liner challenge)
```
Tris sprint 04 dropped: server-side win tracking, persistent
leaderboard, zero new dependencies. First to 10 wins buys the coffee.
#gamedev #nodejs #claudecode
```
(162 chars)

---

## LinkedIn Post

**Tris sprint 04: the leaderboard grew up.**

Until now, win tracking in our multiplayer tic-tac-toe prototype lived
in localStorage — gone on every clear, invisible to other players, and
not worth bragging about. Sprint 04 fixes that.

Wins are now scored server-side: when a match ends with a winner,
`MatchHub` calls `scoreStore.award()`, which appends a delta record to
`data/scores.jsonl` and fsyncs it before returning. Points persist
across restarts. A new `GET /api/leaderboard` endpoint (auth-required)
returns the top 10 by points, ties broken alphabetically. The
`/leaderboard.html` page renders it live — no fakes, no fallback.

The whole thing runs on Node's stdlib, follows the same JSONL
append-only pattern as the existing user store, and delegates all
ranking arithmetic to the existing `shared/game.js` helpers. If you're
curious how we kept it small, ADR-0007 has the full design rationale. 🏆

---

## 30-Second Demo Script

**Title**: Tris — Sprint 04 Leaderboard

### Beat 1 — Empty state (0s–5s)

**Shot**: Browser showing `/leaderboard.html`.
**Narration**: "Here's the leaderboard right after a fresh start. No
scores yet — the server has nothing to show, so it tells you exactly
that."
**On screen**: "No scores yet — play a match to get on the board!"

### Beat 2 — Two players, a real match (5s–20s)

**Shot**: Split view — two browser windows side by side, both on the
Tris game board. Players take turns; the board fills up.
**Narration**: "Two players, one match. Each move goes through the
server. When the last winning move lands..."
**On screen**: Game board completes. Winner banner appears: "Alice wins!"
A subtle flash on the winner's side confirms the point was recorded.

### Beat 3 — match.ended event (20s–23s)

**Shot**: Browser DevTools network panel (or server log), showing the
`match.ended` WebSocket message with `"winner": "Alice"`.
**Narration**: "...the server emits `match.ended`, awards one point to
Alice, and fsyncs it to disk."

### Beat 4 — Leaderboard updates (23s–30s)

**Shot**: Back to `/leaderboard.html`, refreshed (or auto-updated).
**Narration**: "Back to the leaderboard — Alice is on the board."
**On screen**: Ranked table, position 1: Alice — 1 pt.
**Outro text**: "Server-side scoring. Persistent. No new dependencies."

---

## Commit SHAs

| What | SHA |
|---|---|
| Lobby leaderboard link | `d115e87` |
| Stub leaderboard page | `6f10648` |
| ScoreStore port + `GET /api/leaderboard` | `de472b0` |
| MatchHub win-award integration | `c416047` |
| Live leaderboard page (API-backed) | `a8df8ce` |
| ADR-0007 ScoreStore design | `13bfcf8` |
| QA fix: rename topN, fsync, e2e test | `fec400e` |
