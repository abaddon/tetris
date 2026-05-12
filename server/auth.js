'use strict';

const crypto = require('node:crypto');

const SCRYPT_N = 32768; // 2^15
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LEN = 16;
const KEY_LEN = 64;
// 128 * N * r * p = 128 * 32768 * 8 * 1 = 32 MB; set maxmem slightly above
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const ScryptHasher = {
  hash(plain) {
    const salt = crypto.randomBytes(SALT_LEN);
    const key = crypto.scryptSync(plain, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
  },

  verify(plain, stored) {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltHex, keyHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    try {
      const actual = crypto.scryptSync(plain, salt, expected.length, {
        N: parseInt(N, 10), r: parseInt(r, 10), p: parseInt(p, 10), maxmem: SCRYPT_MAXMEM,
      });
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  },
};

class MemorySessionStore {
  constructor() {
    this._map = new Map();
  }

  create(username) {
    const sid = crypto.randomBytes(32).toString('hex');
    this._map.set(sid, { username, createdAt: Date.now() });
    return sid;
  }

  lookup(sid) {
    const entry = this._map.get(sid);
    return entry ? entry.username : null;
  }

  destroy(sid) {
    this._map.delete(sid);
  }
}

module.exports = { ScryptHasher, MemorySessionStore };
