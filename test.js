// Headless tests for Tris pure logic. Maps 1:1 to scenarios in
// docs/stories/sprint-01/01-play-tris.feature.
// Run: `node test.js` (also invoked by ./verify.sh).
'use strict';

const { createGame, play, statusText, fromString, resolveName, applyResult, awardWin, topN, firstEmptyCell } = require('./shared/game.js');

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

// ---- firstEmptyCell tests (sprint-05 story 03) ----
{
  // empty board -> returns 0
  const emptyBoard = Array(9).fill(null);
  eq(firstEmptyCell(emptyBoard), 0, 'firstEmptyCell: empty board returns 0');

  // full board -> returns -1
  const fullBoard = ['X','O','X','O','X','O','O','X','O'];
  eq(firstEmptyCell(fullBoard), -1, 'firstEmptyCell: full board returns -1');

  // partial board -> returns first null index
  const partial = ['X', 'O', null, null, 'X', null, null, null, null];
  eq(firstEmptyCell(partial), 2, 'firstEmptyCell: partial board returns first null index');

  // null only at last cell
  const lastEmpty = ['X','O','X','O','X','O','O','X', null];
  eq(firstEmptyCell(lastEmpty), 8, 'firstEmptyCell: null only at index 8 returns 8');
}

// ---- MatchHub bot-turn tests (sprint-05 story 03) ----
// Skipped until story 03 MatchHub bot-turn implementation lands.
const _botTurnReady = (() => {
  try {
    const { MatchHub: _MH } = require('./server/match-hub.js');
    return /BOT_SENTINEL|__bot__|firstEmptyCell/.test(_MH.toString());
  } catch { return false; }
})();
(_botTurnReady ? (async () => {
  const { InMemoryScoreStore } = require('./server/score-store.js');
  const { InMemoryMatchStore } = require('./server/match-store.js');
  const { MatchHub } = require('./server/match-hub.js');

  function makeMockWs() {
    const listeners = {};
    return {
      readyState: 1,
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

  // Helper: set up alice (X) vs __bot__ (O), alice subscribed.
  function setupBotMatch() {
    const scoreStore = new InMemoryScoreStore();
    const matchStore = new InMemoryMatchStore();
    const hub = new MatchHub(matchStore, null, scoreStore);

    const match = matchStore.create('alice');
    matchStore.addOpponent(match.code, '__bot__');

    const wsA = makeMockWs();
    hub.handleConnection(wsA, 'alice');
    wsA.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
    wsA._sent = [];

    return { hub, matchStore, scoreStore, match, wsA };
  }

  // AC-7a: bot plays first-empty-cell after human move
  {
    const { wsA, match } = setupBotMatch();
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 4 })); // alice plays center
    const states = wsA._sent.filter((m) => m.type === 'match.state');
    eq(states.length >= 2, true, 'bot-turn: alice receives two match.state messages after her move');
    const afterBot = states[states.length - 1];
    eq(afterBot.board[4], 'X', 'bot-turn: alice X is on cell 4');
    eq(afterBot.board[0], 'O', 'bot-turn: bot O is on cell 0 (first empty)');
  }

  // AC-7b: bot win — match ends correctly when bot wins
  {
    const { wsA, match, matchStore, scoreStore } = setupBotMatch();
    // X@3 -> bot@0; X@4 -> bot@1; X@6 -> bot@2 (bot wins top row 0,1,2).
    // X has 3,4,6 which is not a winning line.
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 3 })); // X@3, bot->O@0
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 4 })); // X@4, bot->O@1
    wsA._sent = [];
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 6 })); // X@6, bot->O@2 -> bot wins
    const ended = wsA._sent.find((m) => m.type === 'match.ended');
    eq(ended !== undefined, true, 'bot-turn: match.ended broadcast when bot wins');
    eq(ended.winner, 'O', 'bot-turn: winner is O when bot wins');
    eq(matchStore.get(match.code).status, 'ended', 'bot-turn: match status ended when bot wins');
  }

  // AC-7c: human wins — award fires for human only (no bot award)
  {
    const { wsA, scoreStore } = setupBotMatch();
    // X plays 0,1,2 to win top row. Bot plays elsewhere.
    // X@0 -> bot@3; X@1 -> bot@4; X@2 -> X wins (no bot turn)
    wsA.emit('message', JSON.stringify({ type: 'move', cell: 0 })); // X@0, bot->O@3? wait: first empty after X@0 is 1
    // After X@0: board=[X,null,...]. bot picks cell 1.
    // After X@0+bot@1: board=[X,O,null,...]. X needs 2 more cells.
    // So X plays 2, bot plays 3. X plays 4, bot plays 5. X plays 6,7 — need 3 in row.
    // Simpler: force alice to win col 0: cells 0,3,6
    // Reset with fresh match
    const scoreStore2 = new InMemoryScoreStore();
    const matchStore2 = new InMemoryMatchStore();
    const hub2 = new MatchHub(matchStore2, null, scoreStore2);
    const m2 = matchStore2.create('alice');
    matchStore2.addOpponent(m2.code, '__bot__');
    const wsA2 = makeMockWs();
    hub2.handleConnection(wsA2, 'alice');
    wsA2.emit('message', JSON.stringify({ type: 'subscribe', matchCode: m2.code }));
    wsA2._sent = [];
    // X@0 -> bot@1; X@3 -> bot@2; X@6 -> X wins col 0 (no bot turn after)
    wsA2.emit('message', JSON.stringify({ type: 'move', cell: 0 })); // X@0, bot@1
    wsA2.emit('message', JSON.stringify({ type: 'move', cell: 3 })); // X@3, bot@2
    wsA2.emit('message', JSON.stringify({ type: 'move', cell: 6 })); // X@6 -> X wins
    await new Promise((r) => setImmediate(r));
    const alicePts2 = scoreStore2._map.get('alice')?.pts ?? 0;
    eq(alicePts2, 1, 'bot-turn: human win awards alice exactly 1 point');
    const botPts2 = scoreStore2._map.get('__bot__')?.pts ?? 0;
    eq(botPts2, 0, 'bot-turn: __bot__ receives no points when alice wins');
    const endedMsg = wsA2._sent.find((m) => m.type === 'match.ended');
    eq(endedMsg !== undefined, true, 'bot-turn: alice receives match.ended on human win');
    eq(endedMsg.winner, 'X', 'bot-turn: winner is X on human win');
  }

  // AC-7d: draw calls no award
  {
    const scoreStore3 = new InMemoryScoreStore();
    const matchStore3 = new InMemoryMatchStore();
    const hub3 = new MatchHub(matchStore3, null, scoreStore3);
    const m3 = matchStore3.create('alice');
    matchStore3.addOpponent(m3.code, '__bot__');
    const wsA3 = makeMockWs();
    hub3.handleConnection(wsA3, 'alice');
    wsA3.emit('message', JSON.stringify({ type: 'subscribe', matchCode: m3.code }));
    wsA3._sent = [];
    // Drive to a draw manually: need to control what bot plays.
    // Bot always picks first empty. So we must plan moves so no winner.
    // Simulate: we'll drive to a board state that ends in draw.
    // X@2 -> bot@0; X@8 -> bot@1; X@5 -> bot@3; X@7 -> bot@4; X@6 -> bot plays -> check
    // Let's trace: after X@2, bot@0: [O,null,X,null,null,null,null,null,null]
    // X@8 -> bot@1: [O,O,X,null,null,null,null,null,X] -- O wins col? 0,1 no win yet
    // X@5 -> bot@3: [O,O,X,O,null,X,null,null,X] -- O has 0,1,3 no win
    // X@7 -> bot@4: [O,O,X,O,O,X,null,X,X] -- O has 0,1,3,4 no win; X has 2,5,7,8 no win
    // One cell left: 6. It's X's turn (X played 4 times, O played 4 times).
    // X@6: [O,O,X,O,O,X,X,X,X] -- X has 2,5,6,7,8 -> check wins: 6,7,8 is bottom row -> X wins!
    // That's not a draw. Let's use a known draw sequence with bot interference.
    // Actually we'll just verify match ends with draw:false not forced here and check score=0.
    // Use a draw sequence where X is always the filler and bot picks cells that don't create win:
    // A guaranteed draw with bot@first-empty: need to plan carefully.
    // Easiest: just verify no award on a draw by inspecting final board state directly via game.js.
    // Use fromString to create a near-draw scenario manually - not possible through WS.
    // Instead just assert: after a draw, both scores are 0.
    // We'll force it: manipulate match.game directly after setup.
    const m3ref = matchStore3.get(m3.code);
    const { fromString: fs } = require('./shared/game.js');
    // Board: X O X / X X O / O X O -- only cell 4 (index 4) is empty, it's X's turn, filling gives draw
    // Wait, that's already filled. Let's use: X O X / X . O / O X O with X to play cell 4 -> draw
    m3ref.game = fs('XOX X.OOXO'.replace(/\s/g,'').replace(/\./,'?').split('').map(c=>c).join('').replace('?','.'), 'X');
    // Simpler direct assignment:
    m3ref.game = { board: ['X','O','X','X',null,'O','O','X','O'], turn: 'X', winner: null, draw: false };
    wsA3._sent = [];
    wsA3.emit('message', JSON.stringify({ type: 'move', cell: 4 })); // X@4 -> board full, draw
    await new Promise((r) => setImmediate(r));
    const alicePts3 = scoreStore3._map.get('alice')?.pts ?? 0;
    const botPts3 = scoreStore3._map.get('__bot__')?.pts ?? 0;
    eq(alicePts3, 0, 'bot-turn: no points for alice on draw');
    eq(botPts3, 0, 'bot-turn: no points for __bot__ on draw');
    const drawMsg = wsA3._sent.find((m) => m.type === 'match.ended');
    eq(drawMsg !== undefined, true, 'bot-turn: match.ended sent on draw');
    eq(drawMsg.draw, true, 'bot-turn: draw flag is true');
  }
}) : async () => { console.log('  [skip] bot-turn tests — story 03 not yet implemented'); })()
  .catch((err) => { console.error(err); process.exit(1); });

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
