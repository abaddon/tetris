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

## Wave-3 stubbing recipe

Story devs can run in parallel by stubbing what they don't own:

| Dev / Story          | Owns                              | Stubs                                   |
|----------------------|-----------------------------------|-----------------------------------------|
| Story 01 (register)  | register endpoint, UserStore      | nothing                                 |
| Story 02 (login)     | login/logout, SessionStore        | UserStore -> InMemoryUserStore in tests |
| Story 03 (create)    | POST /api/matches, MatchStore.create, MatchCodeGenerator | UserStore + SessionStore (real, share with story 02 once landed) |
| Story 04 (join)      | POST /api/matches/:code/join, MatchStore.addOpponent | Transport messages may be a no-op until story 05 |
| Story 05 (sync)      | WS, MatchHub, MatchStore.applyMove/requestRematch/markAbandoned | — |

Every dev imports `shared/game.js` for game rules (ADR-0006); no one
reimplements `play` or `detectWinner`.
