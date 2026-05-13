'use strict';

const { createGame } = require('../shared/game.js');
const { RandomMatchCodeGenerator } = require('./match-codes.js');

class InMemoryMatchStore {
  constructor(codeGen) {
    this._map = new Map();
    this._codeGen = codeGen || new RandomMatchCodeGenerator();
  }

  create(ownerUsername) {
    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = this._codeGen.next();
      if (!this._map.has(candidate.toUpperCase())) { code = candidate; break; }
    }
    if (!code) throw { code: 'CODE_COLLISION', message: 'Could not generate match code' };
    const match = {
      code,
      createdAt: Date.now(),
      playerX: ownerUsername,
      playerO: null,
      status: 'waiting',
      game: createGame(),
      rematchReady: { X: false, O: false },
    };
    this._map.set(code.toUpperCase(), match);
    return match;
  }

  get(code) {
    return this._map.get(code.toUpperCase()) || null;
  }

  addOpponent(code, username, difficulty) {
    const match = this.get(code);
    if (!match) throw { code: 'NOT_FOUND' };
    if (match.playerO !== null) throw { code: 'FULL' };
    if (match.playerX === username) throw { code: 'SELF_JOIN' };
    match.playerO = username;
    match.status = 'active';
    if (difficulty !== undefined) match.difficulty = difficulty;
    return match;
  }

  cancelOwned(ownerUsername) {
    for (const [key, match] of this._map) {
      if (match.playerX === ownerUsername && match.status === 'waiting') {
        this._map.delete(key);
      }
    }
  }

  markAbandoned(code) {
    const match = this.get(code);
    if (match) match.status = 'abandoned';
  }
}

module.exports = { InMemoryMatchStore };
