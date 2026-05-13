'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ScryptHasher } = require('./auth.js');

const USERNAME_RE = /^[A-Za-z0-9_]+$/;
const BOT_SENTINEL = '__bot__';

class JsonlUserStore {
  constructor(filePath) {
    this._file = filePath;
    this._map = new Map(); // usernameLower -> User
  }

  boot() {
    const dir = path.dirname(this._file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this._file)) {
      fs.writeFileSync(this._file, '');
      return;
    }
    const raw = fs.readFileSync(this._file, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const user = JSON.parse(trimmed);
        if (user.usernameLower) this._map.set(user.usernameLower, user);
      } catch {
        console.warn('[user-store] skipping malformed line');
      }
    }
  }

  async findByUsername(username) {
    return this._map.get(username.toLowerCase()) || null;
  }

  async create({ username, password }) {
    if (!username || !username.trim()) {
      throw { code: 'VALIDATION', field: 'username', message: 'Username is required' };
    }
    if (username.toLowerCase() === BOT_SENTINEL) {
      throw { code: 'VALIDATION', field: 'username', message: 'Reserved name' };
    }
    if (!USERNAME_RE.test(username)) {
      throw { code: 'VALIDATION', field: 'username', message: 'Username may only contain letters, digits, and underscores' };
    }
    if (!password || password.length < 8) {
      throw { code: 'VALIDATION', field: 'password', message: 'Password must be at least 8 characters' };
    }
    const lower = username.toLowerCase();
    if (this._map.has(lower)) {
      throw { code: 'USERNAME_TAKEN', message: 'Username already taken' };
    }
    const hash = ScryptHasher.hash(password);
    const user = { usernameLower: lower, usernameDisplay: username, hash, createdAt: Date.now() };
    this._map.set(lower, user);
    const line = JSON.stringify(user) + '\n';
    fs.appendFileSync(this._file, line);
    return user;
  }
}

class InMemoryUserStore {
  constructor() {
    this._map = new Map();
  }

  async findByUsername(username) {
    return this._map.get(username.toLowerCase()) || null;
  }

  async create({ username, password }) {
    if (!username || !username.trim()) {
      throw { code: 'VALIDATION', field: 'username', message: 'Username is required' };
    }
    if (username.toLowerCase() === BOT_SENTINEL) {
      throw { code: 'VALIDATION', field: 'username', message: 'Reserved name' };
    }
    if (!USERNAME_RE.test(username)) {
      throw { code: 'VALIDATION', field: 'username', message: 'Username may only contain letters, digits, and underscores' };
    }
    if (!password || password.length < 8) {
      throw { code: 'VALIDATION', field: 'password', message: 'Password must be at least 8 characters' };
    }
    const lower = username.toLowerCase();
    if (this._map.has(lower)) {
      throw { code: 'USERNAME_TAKEN', message: 'Username already taken' };
    }
    const hash = ScryptHasher.hash(password);
    const user = { usernameLower: lower, usernameDisplay: username, hash, createdAt: Date.now() };
    this._map.set(lower, user);
    return user;
  }
}

module.exports = { JsonlUserStore, InMemoryUserStore };
