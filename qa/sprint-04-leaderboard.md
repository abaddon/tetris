# QA report — sprint-04 leaderboard (stories 01 + 02)

Status: **GREEN**

## Verification
- `./verify.sh` → 43/43 logic, 76/76 integration. No regressions.

## Story 01 — Leaderboard link on lobby header
- AC-1 (link present in header with text "Leaderboard", href `/leaderboard.html`): met — `public/lobby.html` line ~45 `<a id="leaderboard-link" class="header-link" href="/leaderboard.html">Leaderboard</a>`.
- AC-2 (focusable / accessible): met — native `<a>` is focusable, visible text serves as accessible name.
- AC-3 (no regression of lobby controls): met — verify.sh integration tests still pass; the change is additive.
- AC-4 (sprint-01/02/03 still pass `./verify.sh`): met.

## Story 02 — Leaderboard page with back-to-lobby link
- AC-1 (`public/leaderboard.html` exists, served via static handler): met — file created. Static serving from `public/` is wired in `server/`.
- AC-2 (visible heading "Leaderboard"): met — `<h1>Tris — Leaderboard</h1>`.
- AC-3 (placeholder, no fabricated scores): met — placeholder reads "Coming soon — No games scored yet…".
- AC-4 (Back-to-lobby link, focusable): met — `<a id="back-to-lobby" class="header-link" href="/lobby.html">Back to lobby</a>`.
- AC-5 (auth gate via `/api/me`, redirect to `/login.html` on 4xx): met — identical pattern copied from `lobby.html`.
- AC-6 (no new backend route): met — stub only.
- AC-7 (sprint-01/02/03 still pass): met.

## Files changed
- `public/lobby.html` (added header link + CSS class `.header-link`)
- `public/leaderboard.html` (new)

## qa_iterations: 0 (green on first run)
