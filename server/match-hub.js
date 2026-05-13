'use strict';

const { play, firstEmptyCell } = require('../shared/game.js');

const PING_INTERVAL_MS = 30_000;
const BOT_SENTINEL = '__bot__';
const PONG_TIMEOUT_MS = 60_000;

class MatchHub {
  constructor(matchStore, sessionStore, scoreStore) {
    this._matchStore = matchStore;
    this._sessionStore = sessionStore;
    this._scoreStore = scoreStore || null;
    // matchCode -> Set<ws> (both players)
    this._rooms = new Map();
    // ws -> { username, matchCode, lastPong }
    this._clients = new Map();

    this._pingTimer = setInterval(() => this._pingAll(), PING_INTERVAL_MS);
    this._pingTimer.unref?.();
  }

  handleConnection(ws, username) {
    this._clients.set(ws, { username, matchCode: null, lastPong: Date.now() });

    ws.on('pong', () => {
      const client = this._clients.get(ws);
      if (client) client.lastPong = Date.now();
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      this._onMessage(ws, msg);
    });

    ws.on('close', () => this._onClose(ws));
    ws.on('error', () => this._onClose(ws));
  }

  _onMessage(ws, msg) {
    const client = this._clients.get(ws);
    if (!client) return;
    switch (msg.type) {
      case 'subscribe': return this._subscribe(ws, client, msg.matchCode);
      case 'move': return this._move(ws, client, msg.cell);
      case 'rematch': return this._rematch(ws, client);
    }
  }

  _subscribe(ws, client, matchCode) {
    if (!matchCode) { this._send(ws, { type: 'error', message: 'matchCode required' }); return; }
    const match = this._matchStore.get(matchCode);
    if (!match) { this._send(ws, { type: 'error', code: 'NOT_FOUND', message: 'Match not found' }); return; }

    // leave previous room if any
    if (client.matchCode) this._leave(ws, client);

    client.matchCode = match.code;
    if (!this._rooms.has(match.code)) this._rooms.set(match.code, new Set());
    this._rooms.get(match.code).add(ws);

    // send current state to subscriber
    this._send(ws, this._stateMsg(match, client.username));

    // if match is active (second player already joined), notify existing room members
    if (match.status === 'active') {
      const room = this._rooms.get(match.code);
      for (const conn of room) {
        if (conn === ws) continue; // skip the subscriber who just got state above
        const c = this._clients.get(conn);
        this._send(conn, this._stateMsg(match, c ? c.username : ''));
      }
    }
  }

  _move(ws, client, cell) {
    if (client.matchCode === null) { this._send(ws, { type: 'error', message: 'Not subscribed to a match' }); return; }
    const match = this._matchStore.get(client.matchCode);
    if (!match) { this._send(ws, { type: 'error', message: 'Match not found' }); return; }
    if (match.status !== 'active') { this._send(ws, { type: 'error', message: 'Match not active' }); return; }

    const playerRole = match.playerX === client.username ? 'X' : match.playerO === client.username ? 'O' : null;
    if (!playerRole) { this._send(ws, { type: 'error', message: 'Not a participant' }); return; }
    if (match.game.turn !== playerRole) { this._send(ws, { type: 'error', message: 'Not your turn' }); return; }
    if (match.game.winner || match.game.draw) { this._send(ws, { type: 'error', message: 'Game is over' }); return; }

    const next = play(match.game, cell);
    if (next === match.game) { this._send(ws, { type: 'error', message: 'Illegal move' }); return; }
    match.game = next;

    if (next.winner || next.draw) {
      match.status = 'ended';
      if (next.winner && this._scoreStore) {
        const winnerUsername = next.winner === 'X' ? match.playerX : match.playerO;
        if (winnerUsername !== BOT_SENTINEL) {
          this._scoreStore.award(winnerUsername).catch((err) => console.error('[match-hub] score award failed', err));
        }
      }
      this._broadcastState(match);
      this._broadcast(match.code, { type: 'match.ended', code: match.code, winner: next.winner, draw: next.draw });
    } else {
      this._broadcastState(match);

      if (match.status === 'active' && !next.winner && !next.draw && match.playerO === BOT_SENTINEL && next.turn === 'O') {
        const botCell = firstEmptyCell(next.board);
        if (botCell === -1) { console.error('[match-hub] bot has no legal move'); return; }
        const afterBot = play(next, botCell);
        if (afterBot === next) { console.error('[match-hub] bot move produced no change'); return; }
        match.game = afterBot;
        if (afterBot.winner || afterBot.draw) {
          match.status = 'ended';
          if (afterBot.winner && this._scoreStore) {
            const winnerUsername = afterBot.winner === 'X' ? match.playerX : match.playerO;
            if (winnerUsername !== BOT_SENTINEL) {
              this._scoreStore.award(winnerUsername).catch((err) => console.error('[match-hub] score award failed', err));
            }
          }
          this._broadcastState(match);
          this._broadcast(match.code, { type: 'match.ended', code: match.code, winner: afterBot.winner, draw: afterBot.draw });
        } else {
          this._broadcastState(match);
        }
      }
    }
  }

  _rematch(ws, client) {
    if (client.matchCode === null) return;
    const match = this._matchStore.get(client.matchCode);
    if (match && match.playerO === BOT_SENTINEL) { this._send(ws, { type: 'error', message: 'Rematch not available in single-player' }); return; }
    if (!match || match.status !== 'ended') { this._send(ws, { type: 'error', message: 'No ended match' }); return; }

    const isX = match.playerX === client.username;
    const isO = match.playerO === client.username;
    if (!isX && !isO) return;

    if (isX) match.rematchReady.X = true;
    if (isO) match.rematchReady.O = true;

    this._broadcast(match.code, { type: 'match.rematch', code: match.code, ready: { X: match.rematchReady.X, O: match.rematchReady.O } });

    if (match.rematchReady.X && match.rematchReady.O) {
      // swap roles
      const prevX = match.playerX;
      match.playerX = match.playerO;
      match.playerO = prevX;
      match.status = 'active';
      match.rematchReady = { X: false, O: false };
      const { createGame } = require('../shared/game.js');
      match.game = createGame();
      this._broadcastState(match);
    }
  }

  _onClose(ws) {
    const client = this._clients.get(ws);
    if (!client) return;
    this._clients.delete(ws);
    if (client.matchCode) {
      const room = this._rooms.get(client.matchCode);
      if (room) room.delete(ws);
      // notify the remaining peer
      const match = this._matchStore.get(client.matchCode);
      if (match && (match.status === 'waiting' || match.status === 'active')) {
        match.status = 'abandoned';
        this._broadcast(client.matchCode, { type: 'match.opponentLeft', code: client.matchCode });
      }
      if (room && room.size === 0) this._rooms.delete(client.matchCode);
    }
  }

  _leave(ws, client) {
    const room = this._rooms.get(client.matchCode);
    if (room) {
      room.delete(ws);
      if (room.size === 0) this._rooms.delete(client.matchCode);
    }
    client.matchCode = null;
  }

  _stateMsg(match, username) {
    return {
      type: 'match.state',
      code: match.code,
      board: match.game.board,
      turn: match.game.turn,
      winner: match.game.winner,
      draw: match.game.draw,
      playerX: match.playerX,
      playerO: match.playerO,
      you: match.playerX === username ? 'X' : match.playerO === username ? 'O' : null,
      status: match.status,
    };
  }

  _broadcastState(match) {
    const room = this._rooms.get(match.code);
    if (!room) return;
    for (const conn of room) {
      const c = this._clients.get(conn);
      this._send(conn, this._stateMsg(match, c ? c.username : ''));
    }
  }

  _broadcast(matchCode, msg) {
    const room = this._rooms.get(matchCode);
    if (!room) return;
    for (const conn of room) this._send(conn, msg);
  }

  _send(ws, msg) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  _pingAll() {
    const now = Date.now();
    for (const [ws, client] of this._clients) {
      if (now - client.lastPong > PONG_TIMEOUT_MS) {
        ws.terminate();
      } else {
        ws.ping();
      }
    }
  }
}

module.exports = { MatchHub };
