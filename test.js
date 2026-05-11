// Headless tests for Tris pure logic. Maps 1:1 to scenarios in
// docs/stories/sprint-01/01-play-tris.feature.
// Run: `node test.js` (also invoked by ./verify.sh).
'use strict';

const { createGame, play, statusText, fromString } = require('./game.js');

let pass = 0;
let fail = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL: ${label}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

// --- Scenario: First move places X on an empty cell ---
{
  const s0 = createGame();
  eq(statusText(s0), 'Turn: X', 'fresh game status');
  const s1 = play(s0, 0);
  eq(s1.board[0], 'X', 'top-left becomes X');
  eq(statusText(s1), 'Turn: O', 'status flips to O after X plays');
}

// --- Scenario: Players alternate turns ---
{
  let s = createGame();
  s = play(s, 4); // X center
  s = play(s, 2); // O top-right
  eq(s.board[2], 'O', 'top-right becomes O');
  eq(statusText(s), 'Turn: X', 'turn returns to X');
}

// --- Scenario: Cannot play on an occupied cell ---
{
  let s = createGame();
  s = play(s, 4); // X center
  const before = JSON.stringify(s);
  const sAfter = play(s, 4); // O tries center
  eq(sAfter.board[4], 'X', 'occupied cell unchanged');
  eq(statusText(sAfter), 'Turn: O', 'turn unchanged on illegal move');
  eq(JSON.stringify(sAfter), before, 'state is unchanged object content on illegal move');
}

// --- Scenario Outline: Winning lines ---
// XX....... + X plays 2 -> X wins top row
{
  const s = fromString('XX.......', 'X');
  const w = play(s, 2);
  eq(statusText(w), 'Winner: X', 'X wins top row');
  // No further moves accepted
  const blocked = play(w, 5);
  eq(blocked.board[5], null, 'no moves after win');
}
// OO.XX.... + O plays 2 -> O wins top row
{
  const s = fromString('OO.XX....', 'O');
  const w = play(s, 2);
  eq(statusText(w), 'Winner: O', 'O wins top row');
}
// X...X.... + X plays 8 -> X wins main diagonal
{
  const s = fromString('X...X....', 'X');
  const w = play(s, 8);
  eq(statusText(w), 'Winner: X', 'X wins main diagonal');
}
// ..X.X.... + X plays 6 -> X wins anti-diagonal
{
  const s = fromString('..X.X....', 'X');
  const w = play(s, 6);
  eq(statusText(w), 'Winner: X', 'X wins anti-diagonal');
}

// Columns + middle row sanity
{
  // X col 0: 0,3,6
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 1); // O
  s = play(s, 3); // X
  s = play(s, 2); // O
  s = play(s, 6); // X wins
  eq(statusText(s), 'Winner: X', 'X wins left column');
}
{
  // Middle row 3,4,5 by O
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 3); // O
  s = play(s, 1); // X
  s = play(s, 4); // O
  s = play(s, 8); // X
  s = play(s, 5); // O wins
  eq(statusText(s), 'Winner: O', 'O wins middle row');
}

// --- Scenario: Draw ---
{
  // Reach a real draw via legal play sequence:
  // X O X
  // X X O
  // O X O
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 1); // O
  s = play(s, 2); // X
  s = play(s, 5); // O
  s = play(s, 3); // X
  s = play(s, 6); // O
  s = play(s, 7); // X
  s = play(s, 8); // O
  s = play(s, 4); // X (fills board, no winner)
  eq(s.board.every((c) => c !== null), true, 'board full');
  eq(s.winner, null, 'no winner on draw');
  eq(statusText(s), 'Draw', 'status reads Draw');
  // No further moves accepted
  const blocked = play(s, 0);
  eq(JSON.stringify(blocked), JSON.stringify(s), 'no moves after draw');
}

// --- Scenario: Reset ---
{
  // After a win, "reset" = createGame() (the UI binds Reset to this).
  let s = createGame();
  s = play(s, 0); s = play(s, 3); s = play(s, 1); s = play(s, 4); s = play(s, 2);
  eq(statusText(s), 'Winner: X', 'X wins before reset');
  const reset = createGame();
  eq(reset.board, Array(9).fill(null), 'reset clears board');
  eq(statusText(reset), 'Turn: X', 'reset returns to Turn: X');
}

// --- Out-of-range moves are ignored ---
{
  const s = createGame();
  eq(play(s, -1), s, 'negative cell ignored');
  eq(play(s, 9), s, 'cell >= 9 ignored');
}

console.log(`\nTris tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(failures.join('\n'));
  process.exit(1);
}
process.exit(0);
