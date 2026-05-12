'use strict';

// Integration smoke test — run after the server is up.
// PORT env var must be set.

const http = require('node:http');

const PORT = parseInt(process.env.PORT || '3000', 10);
let pass = 0;
let fail = 0;
const failures = [];

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(buf); } catch { data = buf; }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(`  FAIL: ${label}`); }
}

async function run() {
  const u = `user_${Date.now()}`;
  const p = 'Password1!';

  // ---- Story 01: Register ----

  {
    const r = await req('POST', '/api/register', { username: u, password: p });
    assert(r.status === 201, `register 201 (got ${r.status})`);
    assert(r.data.ok === true, 'register body ok:true');
  }

  // duplicate register
  {
    const r = await req('POST', '/api/register', { username: u, password: p });
    assert(r.status === 400, `duplicate register 400 (got ${r.status})`);
    assert(r.data.error === 'Username already taken', `duplicate error message`);
  }

  // blank username
  {
    const r = await req('POST', '/api/register', { username: '', password: p });
    assert(r.status === 400, `blank username 400`);
    assert(r.data.error === 'Username is required', `blank username error`);
  }

  // short password
  {
    const r = await req('POST', '/api/register', { username: `${u}b`, password: 'short' });
    assert(r.status === 400, `short password 400`);
    assert(r.data.error === 'Password must be at least 8 characters', `short password error`);
  }

  // invalid chars
  {
    const r = await req('POST', '/api/register', { username: 'ali ce!', password: p });
    assert(r.status === 400, `invalid chars 400`);
    assert(r.data.error === 'Username may only contain letters, digits, and underscores', `invalid chars error`);
  }

  // case-insensitive uniqueness
  {
    const upper = u.toUpperCase();
    const r = await req('POST', '/api/register', { username: upper, password: p });
    assert(r.status === 400, `case-insensitive dupe 400`);
    assert(r.data.error === 'Username already taken', `case-insensitive dupe error`);
  }

  // ---- Story 02: Login ----

  // successful login
  let cookie = '';
  {
    const r = await req('POST', '/api/login', { username: u, password: p });
    assert(r.status === 200, `login 200 (got ${r.status})`);
    assert(typeof r.data.username === 'string', 'login returns username');
    cookie = r.headers['set-cookie']?.[0] || '';
    assert(cookie.includes('sid='), 'login sets sid cookie');
    assert(cookie.includes('HttpOnly'), 'cookie is HttpOnly');
    assert(cookie.includes('SameSite=Lax'), 'cookie SameSite=Lax');
  }

  // /api/me — session survives (simulates reload)
  const sidVal = cookie.split(';')[0];
  {
    const r = await req('GET', '/api/me', null, { Cookie: sidVal });
    assert(r.status === 200, `/api/me 200 (session persists)`);
    assert(r.data.username.toLowerCase() === u.toLowerCase(), `/api/me returns username`);
  }

  // wrong password
  {
    const r = await req('POST', '/api/login', { username: u, password: 'wrongpass1' });
    assert(r.status === 401, `wrong password 401`);
    assert(r.data.error === 'Invalid username or password', `wrong password error message`);
  }

  // non-existent username — same generic error (no info leak)
  {
    const r = await req('POST', '/api/login', { username: 'ghost_nobody', password: p });
    assert(r.status === 401, `non-existent user 401`);
    assert(r.data.error === 'Invalid username or password', `non-existent user error message`);
  }

  // logout
  {
    const r = await req('POST', '/api/logout', null, { Cookie: sidVal });
    assert(r.status === 204, `logout 204`);
    const clearCookie = r.headers['set-cookie']?.[0] || '';
    assert(clearCookie.includes('Max-Age=0'), 'logout clears cookie');
  }

  // after logout, /api/me returns 401
  {
    const r = await req('GET', '/api/me', null, { Cookie: sidVal });
    assert(r.status === 401, `/api/me 401 after logout`);
  }

  // static pages reachable
  {
    const r = await req('GET', '/register.html', null);
    assert(r.status === 200, 'register.html served');
  }
  {
    const r = await req('GET', '/login.html', null);
    assert(r.status === 200, 'login.html served');
  }
  {
    const r = await req('GET', '/lobby.html', null);
    assert(r.status === 200, 'lobby.html served');
  }

  // unauthenticated /api/me returns 401
  {
    const r = await req('GET', '/api/me', null);
    assert(r.status === 401, '/api/me 401 without session');
  }

  // ---- results ----
  console.log(`\nIntegration: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(failures.join('\n'));
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
