'use strict';

const { createGame } = require('../shared/game.js');
const { RandomMatchCodeGenerator } = require('./match-codes.js');

class InMemoryMatchStore {
  constructor(codeGen) {
    this._map = new Map();
    this._codeGen = codeGen || new RandomMatchCodeGenerator();
  }

  create(ownerUsername) {
    const code = this._codeGen.next();
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

  addOpponent(code, username) {
    const match = this.get(code);
    if (!match) throw { code: 'NOT_FOUND' };
    if (match.playerO !== null) throw { code: 'FULL' };
    if (match.playerX === username) throw { code: 'SELF_JOIN' };
    match.playerO = username;
    match.status = 'active';
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
