# QA Report — Sprint 03 Story 03
Date: 2026-05-12
Commit: 5e153aa
Verifier: qa-engineer

---

## Story 03 — Create a new multiplayer match and receive a shareable code

### verify.sh

PASS — `43 passed, 0 failed` (pure-logic) + `43 passed, 0 failed` (integration). Both suites green.

---

### AC-1: "Create Match" action available to authenticated lobby users

PASS — `lobby.html` contains `<button id="create-match-btn" type="button">Create match</button>` unconditionally in `#lobby-section`. The lobby page is only reachable by authenticated users (it re-checks `/api/me` on load and redirects to `/login.html` if unauthenticated). Integration test asserts that `POST /api/matches` without a session returns 401, confirming the endpoint guards auth correctly.

### AC-2: Match code is 4–8 uppercase alphanumeric characters, human-readable

PASS — `match-codes.js` generates 5-char codes from the 32-symbol alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (confusable chars `0`, `1`, `I`, `O` excluded per ADR-0005). Each byte is masked with `& 31` for unbiased selection. Integration tests assert: code is a string, `length >= 4 && length <= 8`, and matches `/^[A-Z2-9]+$/` (`integration.js:183-186`). 5 chars gives 33M possibilities, well within ADR-0005 requirements.

### AC-3: Creator is assigned Player X; UI shows waiting state

PASS — `POST /api/matches` returns `{ code, role: 'X' }` (integration test `r.data.role === 'X'`, line 187). On success, `lobby.html:96-99` sets `matchCodeDisplay.textContent = res.data.code`, adds the `visible` class to `#match-panel`, and sets `waitingLabel.textContent = 'Waiting for opponent to join…'`. The waiting label has `aria-live="polite"` for accessibility.

### AC-4: Match code shown with a copy affordance

PASS — `lobby.html:49-55` renders the `#match-panel` with `#match-code-display` (large font, letter-spacing) and a `#copy-btn` ("Copy code") in `#copy-row`. The button is always in the DOM alongside the code display; the panel becomes visible (`display: flex`) after a match is created. The copy handler uses `navigator.clipboard.writeText()` with a fallback status message if the API is unavailable.

### AC-5: Player X cannot make moves in the waiting state

PASS — The game board is not rendered on `lobby.html` at all during the waiting state. The match panel shows only the code, copy button, and waiting label. No board cells exist in the waiting view, so no moves can be made. The board will only appear in `game.html` (a future story), which requires both players to be present.

### AC-6: Creating a second match while one is pending cancels the first

PASS — `server/index.js:105` calls `matchStore.cancelOwned(username)` before `matchStore.create(username)` on every `POST /api/matches`. `match-store.js:46-52` deletes all `waiting` matches owned by that user. Integration test (`integration.js:193-198`) creates a second match with the same session, then confirms the first code returns 404 when a different user tries to join it.

### AC-7: Logging out while a match is pending cancels that match

PASS — `server/index.js:90-91` added `matchStore.cancelOwned(username)` to the logout handler, executed before `sessionStore.destroy()`. Integration test (`integration.js:213-224`) confirms that after logout, the pending match code returns 404 when a third user attempts to join it.

### AC-8: Sprint-01 and sprint-02 verify.sh scenarios continue to pass

PASS — `verify.sh` reports `43 passed, 0 failed` for the full pure-logic suite. All prior sprint-01 and sprint-02 test cases are included in that count. Zero regressions.

---

## Sprint-03 Story 03 Verdict: PASS

All six feature scenarios and all eight acceptance criteria are satisfied. `verify.sh` is fully green at 43 + 43 assertions.
