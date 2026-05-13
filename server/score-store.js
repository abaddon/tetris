'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { awardWin, topN } = require('../shared/game.js');

/**
 * JsonlScoreStore — production adapter for the ScoreStore port.
 *
 * Backed by an append-only `data/scores.jsonl` file.
 * Each `award` call appends one JSONL line: { usernameLower, usernameDisplay, delta:1, at }.
 * On boot the file is replayed line-by-line, summing deltas into an in-memory Map.
 *
 * IMPORTANT: `award` is `async` only for port-signature uniformity. Its body
 * contains NO `await` points: the Map update, the fd write, and the fsync all
 * run synchronously inside a single JS task. This is the load-bearing
 * "single-threaded Node" assumption described in ADR-0007. Any future refactor
 * that introduces `await fs.promises.appendFile` here MUST also add explicit
 * serialisation (e.g. a per-username promise queue), because two concurrent
 * callers would then interleave between the Map read and the Map write.
 */
class JsonlScoreStore {
  /**
   * @param {string} filePath - absolute path to the scores JSONL file.
   */
  constructor(filePath) {
    this._file = filePath;
    /** @type {Map<string, { usernameDisplay: string, pts: number }>} */
    this._map = new Map(); // usernameLower -> { usernameDisplay, pts }
  }

  /**
   * Read (or create) the scores file and replay all delta lines into _map.
   * Torn / malformed last lines are skipped with console.warn — same behaviour
   * as JsonlUserStore (server/user-store.js lines 26-30).
   */
  boot() {
    const dir = path.dirname(this._file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this._file)) {
      fs.writeFileSync(this._file, '');
      return;
    }
    const raw = fs.readFileSync(this._file, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const record = JSON.parse(trimmed);
        if (!record.usernameLower || !record.usernameDisplay) continue;
        const cur = this._map.get(record.usernameLower) || { usernameDisplay: record.usernameDisplay, pts: 0 };
        // Delegate arithmetic to shared/game.js#awardWin
        const storeObj = { [record.usernameDisplay]: cur.pts };
        const next = awardWin(storeObj, record.usernameDisplay);
        cur.pts = next[record.usernameDisplay];
        cur.usernameDisplay = record.usernameDisplay; // preserve casing of this line
        this._map.set(record.usernameLower, cur);
      } catch {
        console.warn('[score-store] skipping malformed line');
      }
    }
  }

  /**
   * Increment usernameDisplay's score by 1, append a JSONL delta, fsync.
   * Synchronous body — see class-level JSDoc for the concurrency contract.
   * A disk-write failure throws synchronously, rejecting the returned Promise.
   *
   * @param {string} usernameDisplay
   * @returns {Promise<void>}
   */
  async award(usernameDisplay) {
    if (usernameDisplay.toLowerCase() === '__bot__') {
      throw { code: 'SENTINEL_REJECTED', name: usernameDisplay };
    }
    const lower = usernameDisplay.toLowerCase();
    const cur = this._map.get(lower) || { usernameDisplay, pts: 0 };
    // Delegate increment to shared/game.js#awardWin
    const storeObj = { [usernameDisplay]: cur.pts };
    const next = awardWin(storeObj, usernameDisplay);
    cur.pts = next[usernameDisplay];
    cur.usernameDisplay = usernameDisplay; // preserve casing of latest call
    this._map.set(lower, cur);
    const line = JSON.stringify({ usernameLower: lower, usernameDisplay, delta: 1, at: Date.now() }) + '\n';
    const fd = fs.openSync(this._file, 'a');
    try {
      fs.writeSync(fd, line);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Return the top-n entries sorted pts DESC, name ASC.
   * Delegates to shared/game.js#topN; default cap is 10.
   *
   * @param {number} [n=10]
   * @returns {Promise<Array<{ name: string, pts: number }>>}
   */
  async topN(n = 10) {
    // Build a plain object store { [usernameDisplay]: pts } for topN
    const storeObj = {};
    for (const { usernameDisplay, pts } of this._map.values()) {
      storeObj[usernameDisplay] = pts;
    }
    return topN(storeObj, n);
  }
}

/**
 * InMemoryScoreStore — test adapter for the ScoreStore port.
 * Same surface as JsonlScoreStore; no disk I/O.
 */
class InMemoryScoreStore {
  constructor() {
    /** @type {Map<string, { usernameDisplay: string, pts: number }>} */
    this._map = new Map();
  }

  /**
   * @param {string} usernameDisplay
   * @returns {Promise<void>}
   */
  async award(usernameDisplay) {
    if (usernameDisplay.toLowerCase() === '__bot__') {
      throw { code: 'SENTINEL_REJECTED', name: usernameDisplay };
    }
    const lower = usernameDisplay.toLowerCase();
    const cur = this._map.get(lower) || { usernameDisplay, pts: 0 };
    const storeObj = { [usernameDisplay]: cur.pts };
    const next = awardWin(storeObj, usernameDisplay);
    cur.pts = next[usernameDisplay];
    cur.usernameDisplay = usernameDisplay;
    this._map.set(lower, cur);
  }

  /**
   * @param {number} [n=10]
   * @returns {Promise<Array<{ name: string, pts: number }>>}
   */
  async topN(n = 10) {
    const storeObj = {};
    for (const { usernameDisplay, pts } of this._map.values()) {
      storeObj[usernameDisplay] = pts;
    }
    return topN(storeObj, n);
  }
}

module.exports = { JsonlScoreStore, InMemoryScoreStore };
