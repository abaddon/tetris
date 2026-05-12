# QA Report — Sprint 03 Story 02
Date: 2026-05-12
Commit: c87be55
Verifier: qa-engineer

---

## Story 02 — Login with existing account

### verify.sh

PASS — `43 passed, 0 failed` (pure-logic) + `30 passed, 0 failed` (integration). Both suites green.

---

### AC-1: Login form is default view for unauthenticated visitors

PASS — `public/index.html` calls `GET /api/me`; on non-ok response it executes `window.location.replace('/login.html')`. An unauthenticated visitor arriving at `/` is immediately redirected to the login page. `login.html` contains a form with `#username` (type=text) and `#password` (type=password) fields plus a submit button. Integration test asserts `login.html` is served 200.

### AC-2: Correct credentials grant lobby access; username visible in UI

PASS — Server `POST /api/login` returns `200 { username }` plus a `Set-Cookie: sid=...` header on valid credentials (integration test `login 200`, `login returns username`, `login sets sid cookie`). `login.html:61` on `res.ok` redirects to `/lobby.html`. `lobby.html` fetches `GET /api/me` on load and sets `userInfoEl.textContent = 'Logged in as ' + data.username` (`lobby.html:51`), placing the username in the `#user-info` span within the `<header>`.

### AC-3: Wrong credentials produce "Invalid username or password" without field distinction

PASS — `server/index.js:93` uses a single `GENERIC = 'Invalid username or password'` constant for both unknown-user and wrong-password paths. Integration tests assert 401 + exact string for wrong password (`integration.js:108-111`) and for non-existent username (`integration.js:113-117`). Both paths return identical status and message, preventing username enumeration.

### AC-4: Blank username caught client-side before any authentication attempt

PASS — `login.html:50` trims the username and checks `if (!username)`, sets `errEl.textContent = 'Username is required'`, and `return`s before the `fetch` call. No network request is made. The error message matches the AC exactly.

### AC-5: Session survives a page reload

PASS — Session is stored server-side in `MemorySessionStore` keyed by a 64-hex-char random `sid` cookie. Cookie is `HttpOnly; SameSite=Lax; Path=/` (`http-helpers.js:52`), persisted in the browser across reloads. Integration test (`integration.js:105-110`) calls `/api/me` with the same `sid` cookie after the login response and asserts 200 + correct username — simulating a reload. `lobby.html` re-fetches `/api/me` on every page load and redirects to login if unauthenticated, so a valid session returns the lobby without re-login.

### AC-6: Log out control available; destroys session; returns to login page

PASS — `lobby.html:54` registers a click handler on `#logout-btn` ("Log out") that calls `POST /api/logout` then redirects to `/login.html`. `server/index.js:100-102` destroys the session and sets `Max-Age=0` on the cookie. Integration tests confirm: logout returns 204 with `Max-Age=0` (`integration.js:119-123`); a subsequent `/api/me` with the same `sid` returns 401 (`integration.js:126-129`).

### AC-7: Sprint-01 and sprint-02 verify.sh scenarios continue to pass

PASS — `verify.sh` reports `43 passed, 0 failed` for the full pure-logic suite. All prior sprint-01 and sprint-02 test cases are included in that count. Zero regressions.

---

## Sprint-03 Story 02 Verdict: PASS

All six feature scenarios and all seven acceptance criteria are satisfied. `verify.sh` is fully green at 43 + 30 assertions.
