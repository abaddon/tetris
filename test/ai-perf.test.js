'use strict';

// Performance regression tests for AI strategies (sprint-06 story 05).
// For each difficulty in DIFFICULTIES, measures chooseCell(state, 'O') on
// three canonical boards: empty, mid-game, near-terminal.
// Asserts each measured time < 50ms.
// Uses process.hrtime.bigint() — no external dependencies.
//
// Guard: if shared/ai is not yet merged, or if registry.get(difficulty)
// resolves to the trivial fallback for a named difficulty, the test for
// that difficulty is skipped with a console.log message — it does NOT fail.

let DIFFICULTIES;
let defaultRegistry;
let aiModuleLoaded = false;

try {
  const aiIndex = require('../shared/ai/index.js');
  DIFFICULTIES = aiIndex.DIFFICULTIES;
  defaultRegistry = aiIndex.defaultRegistry;
  aiModuleLoaded = true;
} catch (err) {
  // shared/ai not yet merged — skip all perf tests gracefully
  console.log('[ai-perf] shared/ai module not found — skipping all perf tests until foundation branch merges');
  console.log(`[ai-perf] (require error: ${err.message})`);
  console.log('\nAI perf: 0 passed, 0 failed (module not yet available)');
  process.exit(0);
}

// ---- test harness (matches style of test.js) ----

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, label) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL: ${label}`);
  }
}

// ---- canonical board states ----

const { createGame, play } = require('../shared/game.js');

// Empty board (turn: X)
function emptyState() {
  return createGame();
}

// Mid-game: 3 X, 2 O played; it is O's turn
// X @ 0,2,6  O @ 4,5
// board: X . X / . O O / X . .
function midGameState() {
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 4); // O
  s = play(s, 2); // X
  s = play(s, 5); // O
  s = play(s, 6); // X
  // turn is now O — 5 cells played, O's turn
  return s;
}

// Near-terminal: 4 X, 4 O played; one cell left; O's turn
// A board where no winner yet and 1 empty cell remains after O moves
// X O X / X X O / O . O
// cell 7 is empty, O to move
function nearTerminalState() {
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 1); // O
  s = play(s, 2); // X
  s = play(s, 5); // O
  s = play(s, 3); // X
  s = play(s, 6); // O
  s = play(s, 4); // X
  s = play(s, 8); // O
  // Board: [X,O,X,X,X,O,O,null,O] turn=X — wait, X has 0,2,3,4 which is 4 wins?
  // Let me verify: 0,2,3,4 -> no winning line (0,1,2 not all X; 3,4,5 not all X)
  // Actually X@0,2,3,4 -> check lines: [0,1,2]: X,O,X no; [3,4,5]: X,X,O no; [0,3,6]: X,X,O no
  // [1,4,7]: O,X,null no; [2,4,6]: X,X,O no; [0,4,8]: X,X,O no — no winner. Good.
  // turn should be X since we played 8 moves (4X,4O); actually X played 4, O played 4 -> X's turn
  // But we want O's turn for chooseCell(state,'O'). Let me adjust.
  return s;
}

// Alternative near-terminal where it is O's turn (use fromString)
const { fromString } = require('../shared/game.js');

// Board: X O X / X O O / X . .  -> X wins col0 (0,3,6)? 0=X,3=X,6=X yes! That's a winner already.
// Need a non-terminal near-terminal for O.
// Board: X O X / O X O / . . X  -> X has 0,2,4,8; O has 1,3,5. Check: [0,4,8]: X win! also terminal.
// Just use: X O X / X . O / O X .  -> 7 cells placed, 2 empty (4,8), no winner, O's turn
// X@0,2,3,8? wait let me pick carefully.
// Board: X O X / . X O / O . X  -> cell 4 is X (center), X has 0,2,4,8 -> [0,4,8] diagonal win -> terminal
// Board: X O X / O . X / . O X  -> X@0,2,5,8 -> [2,5,8] col right! terminal
// Let's use: . O X / X O . / X . X -> X@2,3,6,8 -> [6,7,8] no; [2,5,8] 2=X,5=null no; [0,3,6] null,X,X no
//   O@1,4 -> [1,4,7] 1=O,4=O,7=null no. Turn: X played 4, O played 2 -> X's turn. Need O's turn.
// Simpler: use a state where X played 3, O played 3 and it's O's turn (7th move total, O's 4th)
// Actually: X played n, O played n-1 when it's X's turn; X played n, O played n when it's O's turn (but that's wrong)
// X goes first: after 1 X move -> O's turn. After n X + n O moves -> X's turn.
// So O's turn means X played one more than O: X played n+1, O played n.
// For near-terminal with O's turn: 8 moves total? No: 4X+4O -> X's turn.
// 4X+3O = 7 moves total -> X's turn? Wait: game starts with X. After each pair (1X+1O) it's X's turn again.
// Sequence: X turn, O turn, X turn, O turn...
// After move 1 (X): O's turn. After move 2 (O): X's turn. After 2n moves: X's turn. After 2n+1 moves: O's turn.
// Near-terminal with O's turn: 7 moves played (3X+4O? no wait)
// Actually: move 1=X, move 2=O, move 3=X, move 4=O, move 5=X, move 6=O, move 7=X...
// Odd number of moves played = O's turn next. Even = X's turn next.
// 7 moves played (4X+3O) -> O's turn. Board has 2 empties.
// X@0,2,4,6 O@1,3,5 -> [0,2,4]: 0,2,4 not a line; [0,4,8]: X,X,null no; check X wins: [0,3,6]: X,O,X no;
//   [0,1,2]: X,O,X no; [3,4,5]: O,X,O no; [6,7,8]: X,null,null no. No winner yet.
//   O has [1,3,5]: [3,4,5] O,X,O no; [1,4,7] O,X,null no. No winner. Good.
//   Empty cells: 7, 8. O's turn.

function buildNearTerminal() {
  // 7 moves played, O's turn, no winner
  // Tried: X@0,1,6,7 O@2,3,4 (5 moves O's turn=false; that's 4X+3O=7 moves, O's turn)
  // [0,1,2]: X,X,O no; [3,4,5]: O,O,null no; [6,7,8]: X,X,null no
  // [0,3,6]: X,O,X no; [1,4,7]: X,O,X no; [2,5,8]: O,null,null no
  // [0,4,8]: X,O,null no; [2,4,6]: O,O,X no
  // No winner! Empty cells: 5,8. O's turn.
  let s = createGame();
  s = play(s, 0); // X
  s = play(s, 2); // O
  s = play(s, 1); // X
  s = play(s, 3); // O
  s = play(s, 6); // X
  s = play(s, 4); // O
  s = play(s, 7); // X
  // 7 moves: X@0,1,6,7 O@2,3,4 -> O's turn, 2 empties (5,8)
  return s;
}

const BOARDS = [
  { label: 'empty',        state: emptyState() },
  { label: 'mid-game',     state: midGameState() },
  { label: 'near-terminal', state: buildNearTerminal() },
];

const NS_PER_MS = 1_000_000n;
const LIMIT_MS = 50;

// ---- run perf tests ----

// Detect if a strategy is the trivial fallback by checking its name/constructor
// The trivial strategy (shared/ai/strategies/trivial.js) is what defaultRegistry
// returns for any difficulty until real strategies are registered.
// We detect fallback by: does registry.get(difficulty) return the same object
// as registry.get('easy') when called with a difficulty that has no real impl?
// Better: try to require the trivial strategy and compare.

let TrivialStrategy = null;
try {
  TrivialStrategy = require('../shared/ai/strategies/trivial.js');
} catch {
  // trivial strategy module not found; cannot detect fallback
}

function isTrivialFallback(strategy, difficulty) {
  // Strategies are plain objects { chooseCell: fn } per ADR-0009.
  // Detect trivial fallback by reference equality on the chooseCell fn.
  if (!strategy) return true;
  if (TrivialStrategy && strategy.chooseCell === TrivialStrategy.chooseCell && difficulty !== 'trivial') {
    return true;
  }
  return false;
}

// Run the perf tests
(async () => {
  for (const difficulty of DIFFICULTIES) {
    let strategy;
    try {
      strategy = defaultRegistry.get(difficulty);
    } catch (err) {
      console.log(`[ai-perf] skipped: ${difficulty} — registry.get threw: ${err.message}`);
      continue;
    }

    if (isTrivialFallback(strategy, difficulty)) {
      console.log(`[ai-perf] skipped: ${difficulty} not yet registered (resolves to trivial fallback)`);
      continue;
    }

    if (!strategy || typeof strategy.chooseCell !== 'function') {
      console.log(`[ai-perf] skipped: ${difficulty} — strategy.chooseCell is not a function`);
      continue;
    }

    for (const { label, state } of BOARDS) {
      const t0 = process.hrtime.bigint();
      let result;
      try {
        result = strategy.chooseCell(state, 'O');
      } catch (err) {
        fail++;
        failures.push(`  FAIL: ai-perf [${difficulty}/${label}] chooseCell threw: ${err.message}`);
        continue;
      }
      const t1 = process.hrtime.bigint();
      const elapsedMs = Number((t1 - t0) / NS_PER_MS);
      console.log(`  [ai-perf] ${difficulty}/${label}: ${elapsedMs}ms (result cell=${result})`);
      assert(
        elapsedMs < LIMIT_MS,
        `ai-perf [${difficulty}/${label}]: ${elapsedMs}ms < ${LIMIT_MS}ms`
      );
    }
  }

  console.log(`\nAI perf: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
