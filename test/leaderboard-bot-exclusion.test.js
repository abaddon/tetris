'use strict';

// Leaderboard integrity regression — bot exclusion across all AI difficulties
// (sprint-06 story 06).
//
// For each DIFFICULTIES value, simulates a bot match completion with a human
// win, then asserts the human score IS awarded and the bot score is NOT in
// score-store. Also verifies that the bot sentinel never appears in topN output.
//
// Uses InMemoryMatchStore + InMemoryScoreStore + MatchHub (no disk, no server).
// Matches test style from test.js (plain assert/eq helpers, async IIFEs).

const { InMemoryMatchStore } = require('../server/match-store.js');
const { InMemoryScoreStore } = require('../server/score-store.js');
const { MatchHub } = require('../server/match-hub.js');
const trivialStrategy = require('../shared/ai/strategies/trivial.js');

// Pin the bot to the trivial strategy so the board trace is predictable
// regardless of which difficulty value is stored on the match. The point of
// THIS test is the sentinel exclusion path, not per-strategy gameplay.
const pinnedTrivialResolver = () => trivialStrategy;

// ---- load DIFFICULTIES (graceful skip if shared/ai not merged) ----

let DIFFICULTIES;
try {
  const aiIndex = require('../shared/ai/index.js');
  DIFFICULTIES = aiIndex.DIFFICULTIES;
} catch {
  // shared/ai not yet merged — use the single known difficulty from sprint-05
  // (trivial / sentinel-guarded play). Story 06 AC covers "all DIFFICULTIES
  // values"; until the AI branch merges we fall back to the sentinel itself.
  DIFFICULTIES = ['trivial'];
  console.log('[leaderboard-bot-exclusion] shared/ai not found — testing with fallback difficulty list: ' + DIFFICULTIES.join(', '));
}

// ---- test harness (matches test.js style) ----

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

function assert(cond, label) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`  FAIL: ${label}`);
  }
}

// ---- mock WebSocket (same as test.js) ----

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

const BOT_SENTINEL = '__bot__';

// ---- helper: set up a human-vs-bot match and drive human to win top row ----
//
// Match setup: alice (X) vs __bot__ (O).
// Win sequence: X plays 0, bot->first-empty (1); X plays 2, bot->3; X wins... wait.
// Need X to win without bot winning first.
// alice plays cells 0, 3, 6 (left column win). Bot plays first-empty after each:
//   After X@0: bot picks cell 1. After X@3: bot picks cell 2. After X@6: X wins (no bot turn).
//
// Board trace:
//   X@0 -> bot@1: [X,O,.,.,.,.,.,.,.]
//   X@3 -> bot@2: [X,O,O,X,.,.,.,.,.]  -- O@1,2 : does O win? [1,4,7] no; [0,1,2] O,O,? no yet
//   X@6 -> X wins col 0 (0,3,6). Match ended. Bot gets no turn.

function setupAndDriveBotMatch(difficulty) {
  const scoreStore = new InMemoryScoreStore();
  const matchStore = new InMemoryMatchStore();
  const hub = new MatchHub(matchStore, null, scoreStore, pinnedTrivialResolver);

  const match = matchStore.create('alice');
  matchStore.addOpponent(match.code, BOT_SENTINEL, difficulty);

  const wsAlice = makeMockWs();
  hub.handleConnection(wsAlice, 'alice');
  wsAlice.emit('message', JSON.stringify({ type: 'subscribe', matchCode: match.code }));
  wsAlice._sent = [];

  // alice plays column 0: cells 0, 3, 6 -> X wins
  // After X@0: bot plays cell 1 (first empty).
  // After X@3: bot plays cell 2 (first empty after 0=X,1=O,2=null -> 2).
  // After X@6: X wins col-left (0,3,6). No bot turn.
  wsAlice.emit('message', JSON.stringify({ type: 'move', cell: 0 }));
  wsAlice.emit('message', JSON.stringify({ type: 'move', cell: 3 }));
  wsAlice.emit('message', JSON.stringify({ type: 'move', cell: 6 }));

  return { scoreStore, match, wsAlice, matchStore };
}

// ---- run tests for each difficulty ----

(async () => {
  for (const difficulty of DIFFICULTIES) {
    const { scoreStore, match, wsAlice, matchStore } = setupAndDriveBotMatch(difficulty);

    // Allow any async microtasks (e.g. award Promises) to settle
    await new Promise((r) => setImmediate(r));

    const matchRef = matchStore.get(match.code);

    // 1. Match must have ended
    assert(
      matchRef && matchRef.status === 'ended',
      `bot-exclusion [${difficulty}]: match status is 'ended' after human win`
    );

    // 2. Winner broadcast must say X
    const endedMsg = wsAlice._sent.find((m) => m.type === 'match.ended');
    assert(endedMsg !== undefined, `bot-exclusion [${difficulty}]: alice receives match.ended`);
    eq(endedMsg && endedMsg.winner, 'X', `bot-exclusion [${difficulty}]: winner is X`);

    // 3. alice (human winner) receives exactly +1 point
    const alicePts = scoreStore._map.get('alice')?.pts ?? 0;
    eq(alicePts, 1, `bot-exclusion [${difficulty}]: alice receives +1 point for winning`);

    // 4. __bot__ must NOT be in score-store._map
    const botInMap = scoreStore._map.has(BOT_SENTINEL);
    eq(botInMap, false, `bot-exclusion [${difficulty}]: __bot__ is NOT in scoreStore._map`);

    // 5. topN output must not contain __bot__ (or any case variant)
    const topEntries = await scoreStore.topN(10);
    const hasBotInTop = topEntries.some(
      (e) => typeof e.name === 'string' && e.name.toLowerCase() === BOT_SENTINEL
    );
    eq(hasBotInTop, false, `bot-exclusion [${difficulty}]: __bot__ does NOT appear in topN result`);

    // 6. topN output does contain alice
    const aliceInTop = topEntries.some((e) => e.name === 'alice');
    eq(aliceInTop, true, `bot-exclusion [${difficulty}]: alice DOES appear in topN after winning`);

    // 7. Verify bot sentinel rejection: awarding __bot__ directly must throw SENTINEL_REJECTED
    let sentinelRejected = null;
    try {
      await scoreStore.award(BOT_SENTINEL);
    } catch (e) {
      sentinelRejected = e;
    }
    assert(
      sentinelRejected !== null && sentinelRejected.code === 'SENTINEL_REJECTED',
      `bot-exclusion [${difficulty}]: ScoreStore.award('__bot__') rejects with SENTINEL_REJECTED`
    );

    // 8. Case variant __BOT__ also rejected
    let upperRejected = null;
    try {
      await scoreStore.award('__BOT__');
    } catch (e) {
      upperRejected = e;
    }
    assert(
      upperRejected !== null && upperRejected.code === 'SENTINEL_REJECTED',
      `bot-exclusion [${difficulty}]: ScoreStore.award('__BOT__') rejects with SENTINEL_REJECTED (case-insensitive)`
    );
  }

  console.log(`\nLeaderboard bot exclusion: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
