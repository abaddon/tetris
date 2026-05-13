'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const BOT_SENTINEL = '__bot__';

const { DIFFICULTIES } = require('../shared/ai');
const { Router } = require('./router.js');
const { readBody, send, parseCookies, setCookieHeader } = require('./http-helpers.js');
const { ScryptHasher, MemorySessionStore } = require('./auth.js');
const { JsonlUserStore } = require('./user-store.js');
const { JsonlScoreStore } = require('./score-store.js');
const { InMemoryMatchStore } = require('./match-store.js');
const { MatchHub } = require('./match-hub.js');

// ---- boot-time copy of shared/game.js -> public/game.js ----
const sharedGame = path.join(__dirname, '../shared/game.js');
const publicGame = path.join(__dirname, '../public/game.js');
fs.copyFileSync(sharedGame, publicGame);

// ---- stores ----
const dataDir = path.join(__dirname, '../data');
const userStore = new JsonlUserStore(path.join(dataDir, 'users.jsonl'));
userStore.boot();
const scoreStore = new JsonlScoreStore(path.join(dataDir, 'scores.jsonl'));
scoreStore.boot();
const sessionStore = new MemorySessionStore();
const matchStore = new InMemoryMatchStore();
const matchHub = new MatchHub(matchStore, sessionStore, scoreStore);

// ---- static file serving ----
const PUBLIC_DIR = path.join(__dirname, '../public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end();
  }
}

// ---- auth helper ----
function getSession(req) {
  const cookies = parseCookies(req.headers['cookie']);
  return sessionStore.lookup(cookies.sid || '');
}

// ---- router ----
const router = new Router();

router.on('POST', '/api/register', async (req, res) => {
  let body;
  try { body = await readBody(req); } catch (e) { send(res, 400, { error: e.message }); return; }
  try {
    await userStore.create({ username: body.username, password: body.password });
    send(res, 201, { ok: true });
  } catch (err) {
    if (err.code === 'VALIDATION') { send(res, 400, { error: err.message }); return; }
    if (err.code === 'USERNAME_TAKEN') { send(res, 400, { error: err.message }); return; }
    send(res, 500, { error: 'Internal error' });
  }
});

router.on('POST', '/api/login', async (req, res) => {
  let body;
  try { body = await readBody(req); } catch (e) { send(res, 400, { error: e.message }); return; }
  const GENERIC = 'Invalid username or password';
  const user = await userStore.findByUsername(body.username || '');
  if (!user) { send(res, 401, { error: GENERIC }); return; }
  if (!ScryptHasher.verify(body.password || '', user.hash)) { send(res, 401, { error: GENERIC }); return; }
  const sid = sessionStore.create(user.usernameDisplay);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': setCookieHeader('sid', sid),
  });
  res.end(JSON.stringify({ username: user.usernameDisplay }));
});

router.on('POST', '/api/logout', (req, res) => {
  const cookies = parseCookies(req.headers['cookie']);
  const username = cookies.sid ? sessionStore.lookup(cookies.sid) : null;
  if (username) matchStore.cancelOwned(username);
  if (cookies.sid) sessionStore.destroy(cookies.sid);
  res.writeHead(204, { 'Set-Cookie': setCookieHeader('sid', '', { maxAge: 0 }) });
  res.end();
});

router.on('GET', '/api/me', (req, res) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  send(res, 200, { username });
});

router.on('GET', '/api/leaderboard', async (req, res) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  const entries = await scoreStore.topN(10);
  // Port returns { name, pts }; public API schema uses { username, pts }
  const mapped = entries.map(({ name, pts }) => ({ username: name, pts }));
  send(res, 200, mapped.filter(e => e.username.toLowerCase() !== '__bot__'));
});

router.on('POST', '/api/matches', (req, res) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  matchStore.cancelOwned(username);
  try {
    const match = matchStore.create(username);
    send(res, 201, { code: match.code, role: 'X' });
  } catch (err) {
    send(res, 500, { error: err.message || 'Internal error' });
  }
});

router.on('POST', '/api/matches/:code/join', (req, res, params) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  try {
    const match = matchStore.addOpponent(params.code, username);
    send(res, 200, { code: match.code, role: 'O', opponent: match.playerX });
  } catch (err) {
    if (err.code === 'NOT_FOUND') { send(res, 404, { error: 'Match not found' }); return; }
    if (err.code === 'FULL') { send(res, 409, { error: 'Match is already full' }); return; }
    if (err.code === 'SELF_JOIN') { send(res, 409, { error: 'You cannot join your own match' }); return; }
    send(res, 500, { error: 'Internal error' });
  }
});

router.on('POST', '/api/matches/:code/vs-computer', async (req, res, params) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  const match = matchStore.get(params.code);
  if (!match) { send(res, 404, { error: 'Match not found' }); return; }
  if (match.playerX !== username) { send(res, 403, { error: 'Forbidden' }); return; }
  if (match.status !== 'waiting') { send(res, 409, { error: 'Match already started' }); return; }

  // Parse body; non-JSON or missing body defaults to {}
  let body = {};
  try {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('application/json')) {
      body = await readBody(req);
    }
  } catch { /* ignore parse errors; body stays {} */ }

  // Validate difficulty — AC-1/AC-2
  const rawDiff = typeof body.difficulty === 'string' ? body.difficulty.toLowerCase() : null;
  if (rawDiff !== null && !DIFFICULTIES.includes(rawDiff)) {
    send(res, 400, { error: 'Invalid difficulty' });
    return;
  }
  const difficulty = rawDiff !== null ? rawDiff : 'medium';

  matchStore.addOpponent(params.code, BOT_SENTINEL, difficulty);
  send(res, 200, { code: match.code, role: 'X', mode: 'computer', difficulty });
});

// ---- HTTP + WS server ----
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req, username) => {
  matchHub.handleConnection(ws, username);
});

const server = http.createServer((req, res) => {
  const handled = router.dispatch(req, res);
  if (handled === null) serveStatic(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const cookies = parseCookies(req.headers['cookie']);
  const username = sessionStore.lookup(cookies.sid || '');
  if (!username) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, username);
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  const addr = server.address();
  console.log(`listening on :${addr.port}`);
});

module.exports = { server, userStore, sessionStore, matchStore, matchHub, scoreStore, BOT_SENTINEL };
