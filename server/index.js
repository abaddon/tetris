'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { Router } = require('./router.js');
const { readBody, send, parseCookies, setCookieHeader } = require('./http-helpers.js');
const { ScryptHasher, MemorySessionStore } = require('./auth.js');
const { JsonlUserStore } = require('./user-store.js');
const { InMemoryMatchStore } = require('./match-store.js');

// ---- boot-time copy of shared/game.js -> public/game.js ----
const sharedGame = path.join(__dirname, '../shared/game.js');
const publicGame = path.join(__dirname, '../public/game.js');
fs.copyFileSync(sharedGame, publicGame);

// ---- stores ----
const dataDir = path.join(__dirname, '../data');
const userStore = new JsonlUserStore(path.join(dataDir, 'users.jsonl'));
userStore.boot();
const sessionStore = new MemorySessionStore();
const matchStore = new InMemoryMatchStore();

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
  // prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end(); return;
  }
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
  if (cookies.sid) sessionStore.destroy(cookies.sid);
  res.writeHead(204, { 'Set-Cookie': setCookieHeader('sid', '', { maxAge: 0 }) });
  res.end();
});

router.on('GET', '/api/me', (req, res) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  send(res, 200, { username });
});

router.on('POST', '/api/matches', (req, res) => {
  const username = getSession(req);
  if (!username) { send(res, 401, { error: 'Not authenticated' }); return; }
  matchStore.cancelOwned(username);
  const match = matchStore.create(username);
  send(res, 201, { code: match.code, role: 'X' });
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

// ---- HTTP server ----
const server = http.createServer((req, res) => {
  const handled = router.dispatch(req, res);
  if (handled === null) serveStatic(req, res);
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  const addr = server.address();
  console.log(`listening on :${addr.port}`);
});

module.exports = { server, userStore, sessionStore, matchStore };
