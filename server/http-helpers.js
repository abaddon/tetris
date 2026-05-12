'use strict';

const MAX_BODY = 16 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let len = 0;
    req.on('data', (chunk) => {
      len += chunk.length;
      if (len > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      buf += chunk;
    });
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    out[key] = val;
  }
  return out;
}

function setCookieHeader(name, value, opts = {}) {
  let hdr = `${name}=${value}; HttpOnly; SameSite=Lax; Path=/`;
  if (opts.maxAge !== undefined) hdr += `; Max-Age=${opts.maxAge}`;
  return hdr;
}

module.exports = { readBody, send, parseCookies, setCookieHeader };
