'use strict';

// Stub for story 01 — full impl lands in story 05
class MatchHub {
  constructor(matchStore, sessionStore) {
    this._matchStore = matchStore;
    this._sessionStore = sessionStore;
  }

  handleUpgrade(req, socket, head, wss) {
    // Full WS handling wired in story 05
    socket.destroy();
  }
}

module.exports = { MatchHub };
