Feature: Leaderboard page with a back-to-lobby link
  As a logged-in Tris player
  I want a leaderboard page I can open from the lobby and return from
  So that the navigation feels complete even before scores are tracked

  Background:
    Given "alice" is registered and logged in
    And "alice" is on the Tris lobby page

  Scenario: The leaderboard page exists at /leaderboard.html
    When "alice" requests "/leaderboard.html"
    Then the server responds with HTTP 200
    And the response body is HTML containing a heading such as "Leaderboard"

  Scenario: The page communicates the prototype state
    When "alice" opens "/leaderboard.html"
    Then she sees a clear placeholder message such as
      "Coming soon — no games scored yet."
      (no fabricated scores are shown)

  Scenario: The page has a Back-to-lobby link
    When "alice" opens "/leaderboard.html"
    Then she sees a link labelled "Back to lobby" (or equivalent)
    And the link is keyboard-focusable
    When "alice" clicks the "Back to lobby" link
    Then her browser navigates to "/lobby.html"

  Scenario: Unauthenticated user reaching the page is sent to login
    Given "eve" is not logged in
    When "eve" opens "/leaderboard.html"
    Then she is redirected to "/login.html"
      (client-side redirect using /api/me — same pattern as lobby.html — is acceptable)

```
## Acceptance criteria
- AC-1: A new file `public/leaderboard.html` exists. Because static files in `public/` are auto-served, requesting `/leaderboard.html` returns it with HTTP 200.
- AC-2: The page displays a visible heading containing the word "Leaderboard".
- AC-3: The page displays a placeholder message indicating scores are not yet tracked (e.g. "Coming soon — no games scored yet.") — NO fake scoreboard data is rendered.
- AC-4: The page includes a `<a href="/lobby.html">` (or equivalent) labelled "Back to lobby" that is focusable.
- AC-5: The page uses the same `/api/me` auth-gating pattern as `lobby.html`: on load, fetch `/api/me`; if not 2xx, set `window.location.href = '/login.html'`.
- AC-6: No new backend route is added in this story — the leaderboard is a static stub for prototype rigor. (A real `/api/leaderboard` endpoint can come in a later sprint once games persist results.)
- AC-7: All sprint-01 / 02 / 03 stories continue to pass `./verify.sh`.

## NFR
- visual: page styling is self-contained (inline `<style>` or shared pattern) and consistent with the other public pages.
- security: same auth gate as lobby — never render content to an unauthenticated visitor (the existing `lobby.html` client-side gate is the reference pattern).

## Priority
- MoSCoW: must

## Source
- feedback: goal

## Trade-off note (prototype rigor)
The leaderboard is a STUB. There is no persisted score store in this codebase
(match-store is in-memory and games do not persist results). Building a real
`/api/leaderboard` endpoint would require introducing persistence, which is
out of scope for prototype rigor and a 2-file UI change. Defer to a future
sprint when a persistence ADR exists.
```
