# Sequence: register, login, create match, join, first move

End-to-end happy path that ties ADR-0001..0006 together. Two browsers,
one server.

```mermaid
sequenceDiagram
    autonumber
    participant Ab as Alice (browser)
    participant Bb as Bob (browser)
    participant H as HTTP (node:http)
    participant W as WS (ws)
    participant Au as Auth (scrypt + sessions)
    participant U as UserStore (JSONL)
    participant M as MatchStore (in-memory)
    participant G as shared/game.js

    Note over Ab,H: --- Alice registers ---
    Ab->>H: POST /api/register {username:"alice", password:"S3cure!"}
    H->>Au: validate + hash(password)
    Au->>U: create({alice, hash})
    U-->>Au: User
    Au-->>H: ok
    H-->>Ab: 201 {ok:true} (redirect to login client-side)

    Note over Ab,H: --- Alice logs in ---
    Ab->>H: POST /api/login {alice, S3cure!}
    H->>Au: verify(hash, plain)
    Au->>Au: sid = randomBytes(32)
    Au-->>H: sid
    H-->>Ab: 200 {username:"alice"} + Set-Cookie sid=...

    Note over Ab,H: --- Alice creates a match ---
    Ab->>H: POST /api/matches  (Cookie: sid=...)
    H->>Au: lookup(sid) -> "alice"
    H->>M: create("alice")
    M->>M: generate "A3F7K", store as waiting
    M-->>H: Match
    H-->>Ab: 201 {code:"A3F7K", role:"X"}

    Note over Ab,W: --- Alice opens the WS ---
    Ab->>W: GET /ws Upgrade (Cookie: sid=...)
    W->>Au: lookup(sid)
    Au-->>W: "alice"
    W-->>Ab: 101 Switching Protocols
    Ab->>W: {type:"subscribe", matchCode:"A3F7K"}
    W->>M: get("A3F7K")
    M-->>W: Match (waiting)
    W-->>Ab: {type:"match.state", board:[null..], status:"waiting", you:"X"}

    Note over Bb,H: --- Bob logs in (already registered) ---
    Bb->>H: POST /api/login {bob, ...}
    H-->>Bb: 200 + Set-Cookie sid=...

    Note over Bb,H: --- Bob joins by code ---
    Bb->>H: POST /api/matches/A3F7K/join
    H->>M: addOpponent("A3F7K", "bob")
    M->>M: status -> active, playerO = "bob"
    M-->>H: Match
    H-->>Bb: 200 {code:"A3F7K", role:"O", opponent:"alice"}

    Bb->>W: GET /ws Upgrade
    W-->>Bb: 101
    Bb->>W: {type:"subscribe", matchCode:"A3F7K"}
    W-->>Ab: {type:"match.joined", playerX:"alice", playerO:"bob"}
    W-->>Bb: {type:"match.state", board:[null..], turn:"X", you:"O"}
    W-->>Ab: {type:"match.state", board:[null..], turn:"X", you:"X"}

    Note over Ab,Bb: --- Alice plays cell 4 ---
    Ab->>W: {type:"move", matchCode:"A3F7K", cell:4}
    W->>M: applyMove("A3F7K", "alice", 4)
    M->>G: play(state, 4)
    G-->>M: next state (X at 4, turn=O)
    M-->>W: Match
    W-->>Ab: {type:"match.state", board:[..,X@4,..], turn:"O"}
    W-->>Bb: {type:"match.state", board:[..,X@4,..], turn:"O"}
```

Key invariants this diagram enforces:

- `sid` cookie is the only auth credential — HTTP and WS share it.
- `MatchStore` is the only writer of game state; `shared/game.js`
  computes the next state, the server stores it.
- Both players receive `match.state` for every transition — there is
  no client-only state that needs to be reconciled by polling.
