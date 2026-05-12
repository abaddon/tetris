# QA Report — Sprint 03 Story 01
Date: 2026-05-12
Commit: 21ffd5c
Verifier: qa-engineer

---

## Story 01 — Register account + server foundation

### verify.sh

PASS — `43 passed, 0 failed` (pure-logic) + `19 passed, 0 failed` (integration). Both suites green.

---

### AC-1: Registration form reachable from start screen

PASS — `public/index.html` (the start screen) redirects unauthenticated visitors to `/login.html`. `login.html:44` contains `<a href="/register.html">Register</a>`. `register.html` is served at `/register.html` (confirmed by integration assertion "register.html served"). The path from start → login → register is navigable with one click.

### AC-2: Successful submission creates account and redirects to login page

PASS — `POST /api/register` returns `201 { ok: true }` on valid input (`integration.js:53-56`). `register.html:59-60` on `res.ok` executes `window.location.href = '/login.html'`. Integration test confirms 201 status and `ok: true` body. No account is created client-side; the redirect fires only after server confirmation.

### AC-3: Duplicate usernames (case-insensitive) rejected with "Username already taken"

PASS — `user-store.js:54` checks `this._map.has(lower)` and throws `{ code: 'USERNAME_TAKEN', message: 'Username already taken' }`. `index.js:77` maps `USERNAME_TAKEN` to HTTP 400. Integration tests assert both exact-match dupe (`integration.js:59-62`) and uppercased dupe (`integration.js:87-91`) return 400 with the correct message. `register.html:62` displays `data.error` in the `#error` element.

### AC-4: Blank username rejected with "Username is required"

PASS — `user-store.js:44` checks `!username || !username.trim()` and throws `{ code: 'VALIDATION', message: 'Username is required' }`. Integration test (`integration.js:66-69`) asserts 400 + exact message. `register.html` displays server error in `#error`.

### AC-5: Password shorter than 8 characters rejected with "Password must be at least 8 characters"

PASS — `user-store.js:49` checks `!password || password.length < 8` and throws the correct message. Integration test (`integration.js:72-75`) confirms 400 + exact message. Note: the check is on `password.length < 8` which correctly accepts exactly 8 characters.

### AC-6: Invalid username characters rejected with correct message

PASS — `user-store.js:41` applies `USERNAME_RE = /^[A-Za-z0-9_]+$/` and throws `{ code: 'VALIDATION', message: 'Username may only contain letters, digits, and underscores' }`. Integration test (`integration.js:79-83`) uses `'ali ce!'` (space + `!`) and asserts 400 + exact message.

### AC-7: Passwords never displayed in plain text

PASS — `register.html:38` uses `<input type="password" ...>` for the password field. The hash stored in `users.jsonl` is a scrypt token (`auth.js:14-17`); the raw password is never serialised or logged. The login endpoint (`index.js:93`) only reads the stored hash for comparison and never echoes it.

### AC-8: Sprint-01 and sprint-02 verify.sh scenarios continue to pass

PASS — `verify.sh` reports `43 passed, 0 failed` for the full pure-logic suite, which encompasses all sprint-01 and sprint-02 test cases. Zero regressions.

---

## Sprint-03 Story 01 Verdict: PASS

All six feature scenarios and all eight acceptance criteria are satisfied. `verify.sh` is fully green.
