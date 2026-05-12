# ADR-0003: Auth model — scrypt + session cookie

**Status**: accepted
**Date**: 2026-05-12
**Stories**: 01-register, 02-login, 05-multiplayer-sync

## Context

Stories 01 and 02 establish account registration and login with username
+ password. The session must:

- survive a page reload (story 02, scenario "Session persists across a
  page reload");
- be destroyable via a "Log out" control (story 02, scenario "User can
  log out…");
- authenticate the WS upgrade request without extra plumbing (ADR-0002).

Password handling must be reasonable even at prototype rigor — we will
not store plaintext passwords on disk.

Candidates for hashing: bcrypt, argon2, scrypt. Candidates for session:
in-memory session id keyed by cookie vs. signed JWT.

## Decision

**Password hashing — `node:crypto` `scrypt`.** Node ships scrypt in the
standard library, so it adds zero dependencies. We use `scryptSync` with
`N=2^15, r=8, p=1`, a 16-byte random salt, and a 64-byte derived key.
Records are stored as `scrypt$N$r$p$<saltHex>$<keyHex>` to leave room to
upgrade parameters later.

**Session — opaque random id in an HTTP-only cookie.** On successful
login the server generates `sid = randomBytes(32).toString('hex')` and
stores `sid -> {username, createdAt}` in an in-memory `Map`. The cookie
is set as `sid=<value>; HttpOnly; SameSite=Lax; Path=/`. We **do not**
set `Secure` in dev because we run over plain HTTP on localhost; this is
called out in the production-promotion notes below.

**Logout** deletes the in-memory entry and sends
`Set-Cookie: sid=; Max-Age=0`.

**WebSocket auth** reuses the same cookie: the upgrade `request` object
exposes the `Cookie` header; the server parses `sid`, looks it up, and
rejects the upgrade with `401` if missing or unknown.

### Validation rules (story-driven)

| Field    | Rule                                              | Error message |
|----------|---------------------------------------------------|---------------|
| username | required, non-blank                               | "Username is required" |
| username | `^[A-Za-z0-9_]+$`                                 | "Username may only contain letters, digits, and underscores" |
| username | case-insensitively unique                         | "Username already taken" |
| password | length >= 8                                       | "Password must be at least 8 characters" |

Login errors are always the generic `"Invalid username or password"` —
no information leak about whether the username exists (story 02).

## Consequences

- positive:
  - No new dependencies — scrypt is built in.
  - HttpOnly cookie cannot be read by JS, mitigating XSS token theft.
  - Same cookie authenticates HTTP and WS — one auth path.
  - Session is invalidated server-side on logout (impossible with
    stateless JWTs without a denylist).
- negative:
  - In-memory sessions are lost on server restart; users must log in
    again. Acceptable at prototype rigor.
  - scrypt parameters are conservative for laptop; tune if registration
    feels slow.
- neutral:
  - Cookie scope is the whole origin; no need for CSRF tokens on the
    JSON API as long as we enforce `SameSite=Lax` and a JSON
    `Content-Type` check on state-changing endpoints.

### What would change for production

- Set `Secure` on the cookie and serve over TLS.
- Move sessions out of process memory (Redis or a signed cookie with
  rotation).
- Add rate limiting on `/api/login` and `/api/register`.
- Add CSRF defense (double-submit token) for any cookie-authenticated
  state-changing endpoint that might be invoked from a browser
  cross-origin.
- Reconsider scrypt vs. argon2id; bump cost parameters and benchmark.
- Persist users with a real DB and add password reset.

## Ports / Adapters

- `PasswordHasher` (port): `hash(plain) -> string`, `verify(plain, hash) -> bool`.
- `ScryptHasher` (adapter): concrete impl using `node:crypto`.
- `SessionStore` (port): `create(username) -> sid`, `lookup(sid) -> username|null`, `destroy(sid)`.
- `MemorySessionStore` (adapter): `Map<sid, {username, createdAt}>`.
- `CookieCodec` (helper): parse `Cookie` header, format `Set-Cookie`.

## Sequence

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    B->>S: POST /api/register {username, password}
    S->>S: validate; scrypt.hash(password)
    S-->>B: 201 {ok:true}
    B->>S: POST /api/login {username, password}
    S->>S: scrypt.verify; sid = randomBytes(32)
    S-->>B: 200 + Set-Cookie sid=...
    B->>S: GET /api/me (Cookie: sid=...)
    S-->>B: 200 {username}
    B->>S: POST /api/logout
    S-->>B: 204 + Set-Cookie sid=; Max-Age=0
```
