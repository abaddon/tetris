# Ports and adapters — wave 3 contract surface

This document is the single page that wave-3 developers consult to
stub each other. Every port below has exactly one production adapter
in this sprint; tests may use the in-memory adapter where listed.

## 1. `UserStore`  (ADR-0004)

```
create({ username, password }) -> Promise<User>
findByUsername(usernameAnyCase) -> Promise<User | null>
```

- `User = { usernameLower, usernameDisplay, hash, createdAt }`.
- `create` throws `{code:"USERNAME_TAKEN"}` if `findByUsername` already
  returns a record (case-insensitive).
- `create` validates `username` against `^[A-Za-z0-9_]+$` and the
  password length (>= 8); throws `{code:"VALIDATION", field, message}`.

Adapters:
- `JsonlUserStore` (default) — backed by `data/users.jsonl`.
- `InMemoryUserStore` — for unit tests.

Consumed by: register handler, login handler.

## 2. `PasswordHasher`  (ADR-0003)

```
hash(plain) -> Promise<string>          // returns "scrypt$N$r$p$salt$key"
verify(plain, hashed) -> Promise<bool>
```

Adapter: `ScryptHasher`.

Consumed by: `UserStore` (during `create`) and login handler.

## 3. `SessionStore`  (ADR-0003)

```
create(username) -> string              // returns sid
lookup(sid) -> string | null            // returns username or null
destroy(sid) -> void
```

Adapter: `MemorySessionStore`.

Consumed by: login/logout handlers, HTTP auth middleware, WS upgrade.

## 4. `HttpServer`  (ADR-0001)

```
on(method, pathPattern, handler)
onUpgrade(handler)                      // handler(req, socket, head)
listen(port) -> Promise<number>         // resolves with actual port
close() -> Promise<void>
```

- `pathPattern` supports `:param` placeholders, e.g.
  `/api/matches/:code/join`.
- `handler` is `async (req, res, params) -> void`.

Adapter: `NodeHttpServer` (wraps `node:http`).

Consumed by: `server/index.js` only.

## 5. `Transport`  (ADR-0002)

```
broadcast(matchCode, msg) -> void       // to every socket subscribed
sendTo(connection, msg) -> void
onMessage(connection, handler)          // handler(msg)
onClose(connection, handler)
subscribe(connection, matchCode) -> void
```

- `msg` is a plain JS object; the transport serializes to JSON.
- Server is the source of truth; clients only **request**, never assert.

Adapter: `WsTransport` (wraps `ws`).

Consumed by: `MatchHub`.

## 6. `MatchStore`  (ADR-0004)

```
create(ownerUsername) -> Match          // generates a code (ADR-0005)
get(code) -> Match | null               // case-insensitive
addOpponent(code, username) -> Match    // throws on full/self/missing
applyMove(code, username, cell) -> Match
requestRematch(code, username) -> Match
cancelOwned(ownerUsername) -> void      // on logout / re-create
markAbandoned(code) -> void             // on opponent disconnect
```

Errors thrown by `addOpponent`:
- `{code:"NOT_FOUND"}`
- `{code:"FULL"}`
- `{code:"SELF_JOIN"}`

Errors thrown by `applyMove`:
- `{code:"NOT_FOUND"}`
- `{code:"NOT_YOUR_TURN"}`
- `{code:"ILLEGAL_MOVE"}` (returned by `shared/game.js`)
- `{code:"GAME_OVER"}`

Adapter: `InMemoryMatchStore`.

Consumed by: match HTTP handlers and `MatchHub`.

## 7. `MatchCodeGenerator`  (ADR-0005)

```
next() -> string
```

Adapters:
- `RandomMatchCodeGenerator` (production)
- `SequenceMatchCodeGenerator` (test, deterministic)

Consumed by: `InMemoryMatchStore`.

## 8. `MatchHub`  (ADR-0002)

Not strictly a port — a module that wires `Transport` to `MatchStore`.
Behavior:

- On `subscribe`: validate session, attach socket, send `match.state`.
- On `move`: call `MatchStore.applyMove`, broadcast `match.state` (and
  `match.ended` if terminal).
- On `rematch`: call `MatchStore.requestRematch`, broadcast
  `match.rematch` and, when both ready, swap roles and broadcast a new
  `match.state`.
- On socket close: if the user is a participant, broadcast
  `match.opponentLeft` to the other socket and call `markAbandoned`.

## 9. `ScoreStore`  (ADR-0007)

```
award(usernameDisplay) -> Promise<void>          // +1; delegates to shared/game.js#awardWin
topN(n = 10)           -> Promise<[{ name, pts }, ...]>   // delegates to shared/game.js#topN
```

- `award` is synchronous in its body (no `await` inside); the returned
  Promise resolves once the in-memory map is updated AND the JSONL line
  has been written and fsynced (`fs.writeSync` + `fs.fsyncSync` inside
  a try/finally). See ADR-0007 for the "single-threaded Node"
  assumption that makes concurrent calls safe without explicit
  serialisation.
- `topN` returns at most `n` entries, sorted `pts` DESC then `name`
  ASC. The HTTP handler passes `n = 10`.
- `name` in the returned shape is the user's display name
  (`usernameDisplay`), not the lowercase key.

Adapters:
- `JsonlScoreStore` (production) — backed by `data/scores.jsonl`,
  append-only one-delta-per-line, replay-on-boot, torn-final-line
  tolerated with `console.warn`.
- `InMemoryScoreStore` (test) — same surface, no disk.

Consumed by:
- `MatchHub` (sprint-04 story 04) — receives the store via
  constructor injection; calls `award(winnerUsername)` inside `_move`
  once per terminal state where `next.winner` is set. Draws and
  abandons never trigger `award`. A rejected Promise is caught and
  logged to `console.error`; the WS broadcast continues regardless.
- `GET /api/leaderboard` HTTP handler in `server/index.js`
  (sprint-04 story 03) — auth-gated (401 without session); calls
  `scoreStore.topN(10)`; responds with
  `[{ username, pts }, ...]` JSON (the handler maps `name -> username`
  to match the public API schema in the story).

## Wave-3 stubbing recipe

Story devs can run in parallel by stubbing what they don't own:

| Dev / Story          | Owns                              | Stubs                                   |
|----------------------|-----------------------------------|-----------------------------------------|
| Story 01 (register)  | register endpoint, UserStore      | nothing                                 |
| Story 02 (login)     | login/logout, SessionStore        | UserStore -> InMemoryUserStore in tests |
| Story 03 (create)    | POST /api/matches, MatchStore.create, MatchCodeGenerator | UserStore + SessionStore (real, share with story 02 once landed) |
| Story 04 (join)      | POST /api/matches/:code/join, MatchStore.addOpponent | Transport messages may be a no-op until story 05 |
| Story 05 (sync)      | WS, MatchHub, MatchStore.applyMove/requestRematch/markAbandoned | — |
| Sprint-04 Story 03 (score-store + leaderboard API) | ScoreStore port, JsonlScoreStore, InMemoryScoreStore, GET /api/leaderboard handler | SessionStore (real); UserStore not needed |
| Sprint-04 Story 04 (match-hub win scoring) | MatchHub constructor extension, `_move` award call + error handling | ScoreStore -> InMemoryScoreStore in tests (story 03 ships the in-memory adapter first) |
| Sprint-04 Story 05 (leaderboard page live data) | public/leaderboard.html, client fetch + render + error states | GET /api/leaderboard -> may stub with a static JSON fixture until story 03 lands |

Every dev imports `shared/game.js` for game rules (ADR-0006); no one
reimplements `play`, `detectWinner`, `awardWin`, or `topN`.

## Sequence — sprint-04 win-scoring fan-out

```mermaid
sequenceDiagram
    participant C1 as Client (winner)
    participant C2 as Client (loser)
    participant H as MatchHub
    participant M as MatchStore
    participant S as ScoreStore

    C1->>H: ws { type:"move", cell:N }
    H->>H: if (match.status !== 'active') reject
    H->>M: play(state, cell) -> next (winner set)
    H->>M: match.status = 'ended'
    H->>S: award(winnerUsername)
    S-->>H: Promise resolves (sync body)
    H->>C1: ws match.state
    H->>C2: ws match.state
    H->>C1: ws match.ended { winner }
    H->>C2: ws match.ended { winner }
    Note over H,S: rejected award is .catch(console.error)d;<br/>broadcast still goes out
```
