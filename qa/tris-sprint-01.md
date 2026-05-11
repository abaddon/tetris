# QA Report — Tris (sprint-01)

- Scope: `docs/stories/sprint-01/01-play-tris.feature`
- Implementation: commit `57a5769` on `main`
- Rigor: prototype (architect + integration suite skipped per `docs/rigor-level.md`)
- Verify command: `./verify.sh` → `node test.js`

## Verdict: GREEN

`./verify.sh` exit 0; 24 assertions passed, 0 failed.

## Acceptance criteria coverage

| Scenario | Covered by | Result |
|----------|------------|--------|
| First move places X on an empty cell | `test.js` "fresh game status" + "top-left becomes X" + "status flips to O" | pass |
| Players alternate turns | `test.js` "top-right becomes O" + "turn returns to X" | pass |
| Cannot play on an occupied cell | `test.js` "occupied cell unchanged" + state-equality assertion | pass |
| Win — top row by X (XX. + 2) | `test.js` "X wins top row" + "no moves after win" | pass |
| Win — top row by O (OO.XX. + 2) | `test.js` "O wins top row" | pass |
| Win — main diagonal (X...X + 8) | `test.js` "X wins main diagonal" | pass |
| Win — anti-diagonal (..X.X + 6) | `test.js` "X wins anti-diagonal" | pass |
| Win — column (extra coverage) | `test.js` "X wins left column" | pass |
| Win — middle row (extra coverage) | `test.js` "O wins middle row" | pass |
| Draw — full board, no winner | `test.js` "board full" + "no winner on draw" + "status reads Draw" + "no moves after draw" | pass |
| Reset returns to initial state | `test.js` "reset clears board" + "reset returns to Turn: X" | pass |

## UI verification (manual, not automated)

The browser UI (`index.html`) binds DOM events to the same pure functions
exercised by `test.js`:
- `render()` reads `state.board` and `statusText(state)`; cells are
  `disabled` once occupied or once the game is over, so the "no moves
  after win/draw" rule is enforced both at the logic layer and the UI.
- The Reset button replaces `state` with `createGame()`, matching the
  reset scenario asserted in the test suite.

No automated DOM/E2E test is included; prototype rigor permits this.

## Notes / follow-ups (non-blocking)

- `game.js` is shared between the browser (loaded as a global script)
  and Node (CommonJS export). Kept dependency-free intentionally.
- If this graduates to `production`, add: (a) a DOM smoke test with a
  headless browser or `jsdom`, (b) ADR for the storage/state model, and
  (c) integration mode in `verify.sh --integration`.
