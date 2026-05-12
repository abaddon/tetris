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

  // ---- Story 03: Create match ----

  // re-login to get a fresh session
  let matchCookie = '';
  {
    const r = await req('POST', '/api/login', { username: u, password: p });
    assert(r.status === 200, `re-login 200 for match tests`);
    matchCookie = (r.headers['set-cookie']?.[0] || '').split(';')[0];
  }

  // create match — 201 with code and role X
  let matchCode = '';
  {
    const r = await req('POST', '/api/matches', null, { Cookie: matchCookie });
    assert(r.status === 201, `create match 201 (got ${r.status})`);
    assert(typeof r.data.code === 'string', 'match code is string');
    assert(r.data.code.length >= 4 && r.data.code.length <= 8, 'match code 4-8 chars');
    assert(/^[A-Z2-9]+$/.test(r.data.code), 'match code uppercase alphanumeric');
    assert(r.data.role === 'X', 'creator is Player X');
    matchCode = r.data.code;
  }

  // creating a second match cancels the first
  let matchCode2 = '';
  {
    const r = await req('POST', '/api/matches', null, { Cookie: matchCookie });
    assert(r.status === 201, `second match 201`);
    matchCode2 = r.data.code;
    assert(matchCode2 !== matchCode, 'new code differs from cancelled code');
  }

  // first code is no longer joinable after cancellation
  {
    const u2 = `user2_${Date.now()}`;
    await req('POST', '/api/register', { username: u2, password: p });
    const r2 = await req('POST', '/api/login', { username: u2, password: p });
    const c2 = (r2.headers['set-cookie']?.[0] || '').split(';')[0];
    const r = await req('POST', `/api/matches/${matchCode}/join`, null, { Cookie: c2 });
    assert(r.status === 404, `cancelled match not joinable (got ${r.status})`);
    assert(r.data.error === 'Match not found', `cancelled match error message`);
  }

  // unauthenticated create match returns 401
  {
    const r = await req('POST', '/api/matches', null);
    assert(r.status === 401, 'create match 401 without session');
  }

  // logout cancels pending match
  {
    const r = await req('POST', '/api/logout', null, { Cookie: matchCookie });
    assert(r.status === 204, 'logout 204 (match cancel)');
    // matchCode2 should now be gone — login as another user to check
    const u3 = `user3_${Date.now()}`;
    await req('POST', '/api/register', { username: u3, password: p });
    const r3 = await req('POST', '/api/login', { username: u3, password: p });
    const c3 = (r3.headers['set-cookie']?.[0] || '').split(';')[0];
    const rJoin = await req('POST', `/api/matches/${matchCode2}/join`, null, { Cookie: c3 });
    assert(rJoin.status === 404, `match cancelled on logout (got ${rJoin.status})`);
  }

  // ---- Story 04: Join match by code ----

  // register alice4 and bob4 as fresh users for this section
  const alice4 = `alice4_${Date.now()}`;
  const bob4 = `bob4_${Date.now()}`;
  let aCookie = '';
  let bCookie = '';

  await req('POST', '/api/register', { username: alice4, password: p });
  await req('POST', '/api/register', { username: bob4, password: p });

  {
    const r = await req('POST', '/api/login', { username: alice4, password: p });
    aCookie = (r.headers['set-cookie']?.[0] || '').split(';')[0];
  }
  {
    const r = await req('POST', '/api/login', { username: bob4, password: p });
    bCookie = (r.headers['set-cookie']?.[0] || '').split(';')[0];
  }

  // alice creates a match
  let joinCode = '';
  {
    const r = await req('POST', '/api/matches', null, { Cookie: aCookie });
    assert(r.status === 201, `story04: alice creates match 201`);
    joinCode = r.data.code;
  }

  // bob joins with uppercase code
  {
    const r = await req('POST', `/api/matches/${joinCode}/join`, null, { Cookie: bCookie });
    assert(r.status === 200, `story04: bob joins match 200 (got ${r.status})`);
    assert(r.data.role === 'O', 'bob is Player O');
    assert(r.data.opponent === alice4, 'opponent is alice');
    assert(r.data.code === joinCode, 'join response echoes code');
  }

  // match is now full — carol cannot join
  {
    const carol4 = `carol4_${Date.now()}`;
    await req('POST', '/api/register', { username: carol4, password: p });
    const rc = await req('POST', '/api/login', { username: carol4, password: p });
    const carolCookie = (rc.headers['set-cookie']?.[0] || '').split(';')[0];
    const r = await req('POST', `/api/matches/${joinCode}/join`, null, { Cookie: carolCookie });
    assert(r.status === 409, `story04: full match 409 (got ${r.status})`);
    assert(r.data.error === 'Match is already full', 'full match error message');
  }

  // alice creates a new match for self-join and case-insensitive tests
  let joinCode2 = '';
  {
    const r = await req('POST', '/api/matches', null, { Cookie: aCookie });
    assert(r.status === 201, `story04: alice creates match2`);
    joinCode2 = r.data.code;
  }

  // alice tries to join her own match
  {
    const r = await req('POST', `/api/matches/${joinCode2}/join`, null, { Cookie: aCookie });
    assert(r.status === 409, `story04: self-join 409`);
    assert(r.data.error === 'You cannot join your own match', 'self-join error message');
  }

  // case-insensitive join (lowercase code)
  {
    const dave4 = `dave4_${Date.now()}`;
    await req('POST', '/api/register', { username: dave4, password: p });
    const rd = await req('POST', '/api/login', { username: dave4, password: p });
    const daveCookie = (rd.headers['set-cookie']?.[0] || '').split(';')[0];
    const r = await req('POST', `/api/matches/${joinCode2.toLowerCase()}/join`, null, { Cookie: daveCookie });
    assert(r.status === 200, `story04: case-insensitive join 200`);
    assert(r.data.role === 'O', 'case-insensitive join gives O role');
  }

  // unknown code returns 404
  {
    const r = await req('POST', '/api/matches/ZZZZ9/join', null, { Cookie: bCookie });
    assert(r.status === 404, `story04: unknown code 404`);
    assert(r.data.error === 'Match not found', 'unknown code error message');
  }

  // unauthenticated join returns 401
  {
    const r = await req('POST', `/api/matches/${joinCode2}/join`, null);
    assert(r.status === 401, 'story04: join 401 without session');
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
