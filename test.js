// Headless tests for Tris pure logic. Maps 1:1 to scenarios in
// docs/stories/sprint-01/01-play-tris.feature.
// Run: `node test.js` (also invoked by ./verify.sh).
'use strict';

const { createGame, play, statusText, fromString, resolveName, applyResult, awardWin, topN } = require('./shared/game.js');

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

// --- resolveName ---
{
  eq(resolveName('Alice', 'X'), 'Alice', 'resolveName: normal name');
  eq(resolveName('', 'X'), 'Player X', 'resolveName: blank falls back to default X');
  eq(resolveName('', 'O'), 'Player O', 'resolveName: blank falls back to default O');
  eq(resolveName('  Alice  ', 'X'), 'Alice', 'resolveName: trims whitespace');
  eq(resolveName('   ', 'X'), 'Player X', 'resolveName: whitespace-only falls back');
  eq(resolveName(null, 'X'), 'Player X', 'resolveName: null falls back');
}

// --- applyResult ---
{
  const zero = { X: 0, O: 0 };
  eq(applyResult(zero, 'X'), { X: 1, O: 0 }, 'applyResult: X wins increments X');
  eq(applyResult(zero, 'O'), { X: 0, O: 1 }, 'applyResult: O wins increments O');
  eq(applyResult(zero, null), { X: 0, O: 0 }, 'applyResult: draw leaves scores unchanged');
  // accumulation
  const mid = { X: 2, O: 1 };
  eq(applyResult(mid, 'X'), { X: 3, O: 1 }, 'applyResult: accumulates across matches');
  // immutability
  const before = { X: 0, O: 0 };
  applyResult(before, 'X');
  eq(before, { X: 0, O: 0 }, 'applyResult: does not mutate input');
}

// --- awardWin ---
{
  const store = {};
  const s1 = awardWin(store, 'Alice');
  eq(s1, { Alice: 1 }, 'awardWin: first win creates entry');
  const s2 = awardWin(s1, 'Alice');
  eq(s2, { Alice: 2 }, 'awardWin: second win accumulates');
  const s3 = awardWin(s1, 'Bob');
  eq(s3, { Alice: 1, Bob: 1 }, 'awardWin: second player entry added');
  eq(store, {}, 'awardWin: does not mutate original store');
}

// --- topN ---
{
  // basic sort descending by points
  const store = { Alice: 3, Bob: 5, Carol: 1 };
  eq(topN(store, 3), [{ name: 'Bob', pts: 5 }, { name: 'Alice', pts: 3 }, { name: 'Carol', pts: 1 }], 'topN: sorted desc by points');
  // top-N limit
  eq(topN(store, 2), [{ name: 'Bob', pts: 5 }, { name: 'Alice', pts: 3 }], 'topN: capped at N');
  // tie broken alphabetically
  const tied = { Carol: 5, Alice: 5 };
  eq(topN(tied, 2), [{ name: 'Alice', pts: 5 }, { name: 'Carol', pts: 5 }], 'topN: ties broken alphabetically ASC');
  // top-10 cap
  const big = {};
  for (var i = 0; i < 12; i++) big['Player' + i] = i;
  eq(topN(big, 10).length, 10, 'topN: returns at most 10 entries');
}

// ---- MatchHub win-scoring tests (AC-1 through AC-9, sprint-04 story 04) ----
// Uses InMemoryScoreStore (no disk) and InMemoryMatchStore with mock WS objects.
// Wrapped in an async IIFE so we can await the rejected-award microtask test (AC-5).
(async () => {
  const { InMemoryScoreStore } = require('./server/score-store.js');
  const { InMemoryMatchStore } = require('./server/match-store.js');
  const { MatchHub } = require('./server/match-hub.js');

  // Minimal mock WebSocket: records sent messages, exposes event emitter API.
  function makeMockWs() {
    const listeners = {};
    return {
      readyState: 1, // OPEN
      _sent: [],
      send(raw) { this._sent.push(JSON.parse(raw)); },
      on(event, handler) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
      },
      emit(event, ...args) {
        (listeners[event] || []).forEach((h) => h(...args));
      },
      ping() {},
    };
  }

  // Helper: set up alice (X) and bob (O) in an active match, both subscribed.
  function setupMatch() {
    const scoreStore = new InMemoryScoreStore();
    const matchStore = new InMemoryMatchStore();
    const hub = new MatchHub(matchStore, null, scoreStore);

    const match = matchStore.create('alice');
    matchStore.addOpponent(match.code, 'bob');

    const wsA = makeMockWs();
    const wsB = makeMockWs();
    hub.handleConnection(wsA, 'alice');
    hub.handleConnection(wsB, 'bob');
    wsA.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
    wsB.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
    // Drain subscribe state messages
    wsA._sent = [];
    wsB._sent = [];

    return { hub, matchStore, scoreStore, match, wsA, wsB };
  }

  // Helper: drive the board to one move before alice (X) wins top row (cells 0,1 -> 2)
  function driveToAliceWin({ wsA, wsB }) {
    // X plays 0, O plays 3, X plays 1, O plays 4, then X plays 2 to win
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 0 })); // X cell 0
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 3 })); // O cell 3
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 1 })); // X cell 1
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 4 })); // O cell 4
    // Now play the winning move
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 2 })); // X cell 2 -> X wins
  }

  // Helper: drive to a full-board draw
  // Board: X O X / X X O / O X O  (no winner)
  function driveToDraw({ wsA, wsB }) {
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 0 })); // X
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 1 })); // O
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 2 })); // X
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 5 })); // O
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 3 })); // X
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 6 })); // O
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 7 })); // X
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 8 })); // O
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 4 })); // X fill -> draw
  }

  // AC-2: Winner gets exactly +1 point
  {
    const { scoreStore, wsA, wsB } = setupMatch();
    driveToAliceWin({ wsA, wsB });
    const alicePts = scoreStore._map.get('alice')?.pts ?? 0;
    eq(alicePts, 1, 'scoring: winner alice gets +1 point after win');
  }

  // AC-3: Bob (loser) receives no points
  {
    const { scoreStore, wsA, wsB } = setupMatch();
    driveToAliceWin({ wsA, wsB });
    const bobPts = scoreStore._map.get('bob')?.pts ?? 0;
    eq(bobPts, 0, 'scoring: loser bob gets 0 points after alice wins');
  }

  // AC-3: Draw awards nothing
  {
    const { scoreStore, wsA, wsB } = setupMatch();
    driveToDraw({ wsA, wsB });
    const alicePts = scoreStore._map.get('alice')?.pts ?? 0;
    const bobPts = scoreStore._map.get('bob')?.pts ?? 0;
    eq(alicePts, 0, 'scoring: alice gets 0 points on draw');
    eq(bobPts, 0, 'scoring: bob gets 0 points on draw');
  }

  // AC-4: Abandoned match (bob disconnects) awards nothing
  {
    const { scoreStore, wsA, wsB } = setupMatch();
    // Make one move so match is mid-game, then bob disconnects
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 0 })); // X plays
    wsB.emit('close'); // bob disconnects
    const alicePts = scoreStore._map.get('alice')?.pts ?? 0;
    const bobPts = scoreStore._map.get('bob')?.pts ?? 0;
    eq(alicePts, 0, 'scoring: alice gets 0 points on abandoned match');
    eq(bobPts, 0, 'scoring: bob gets 0 points on abandoned match');
  }

  // AC-5: Rejected award does not crash hub; both clients still receive match.ended
  {
    const matchStore = new InMemoryMatchStore();
    const rejectingStore = {
      award() { return Promise.reject(new Error('disk error')); },
    };
    const hub = new MatchHub(matchStore, null, rejectingStore);
    const match = matchStore.create('alice');
    matchStore.addOpponent(match.code, 'bob');
    const wsA = makeMockWs();
    const wsB = makeMockWs();
    hub.handleConnection(wsA, 'alice');
    hub.handleConnection(wsB, 'bob');
    wsA.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
    wsB.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
    wsA._sent = [];
    wsB._sent = [];

    // Play to alice win
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 0 }));
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 3 }));
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 1 }));
    wsB.emit('message', JSON.stringify({ type: 'move', cell: 4 }));
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 2 })); // X wins

    // Allow the rejected Promise's microtask to settle before asserting
    await new Promise((r) => setImmediate(r));

    const aEndedMsg = wsA._sent.find((m) => m.type === 'match.ended');
    const bEndedMsg = wsB._sent.find((m) => m.type === 'match.ended');
    eq(aEndedMsg !== undefined, true, 'scoring: alice still receives match.ended when award rejects');
    eq(bEndedMsg !== undefined, true, 'scoring: bob still receives match.ended when award rejects');
    eq(wsA.readyState, 1, 'scoring: alice WS not closed when award rejects');
    eq(wsB.readyState, 1, 'scoring: bob WS not closed when award rejects');
  }

  // AC-6: Guard prevents double-scoring on replay (second move message after ended)
  {
    const { scoreStore, wsA, wsB } = setupMatch();
    driveToAliceWin({ wsA, wsB });
    // Try to send another move after the match has ended
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 5 }));
    const alicePts = scoreStore._map.get('alice')?.pts ?? 0;
    eq(alicePts, 1, 'scoring: replay after ended does not double-score alice');
  }

  // AC-1: MatchHub accepts scoreStore as 3rd constructor arg (verified structurally)
  {
    const store = new InMemoryScoreStore();
    const hub = new MatchHub(new InMemoryMatchStore(), null, store);
    eq(hub._scoreStore === store, true, 'scoring: MatchHub stores scoreStore from 3rd constructor arg');
  }

  console.log(`\nTris tests: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
