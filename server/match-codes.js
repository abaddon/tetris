'use strict';

const crypto = require('node:crypto');
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class RandomMatchCodeGenerator {
  next() {
    let code = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      code += CHARS[bytes[i] % CHARS.length];
    }
    return code;
  }
}

class SequenceMatchCodeGenerator {
  constructor() { this._n = 0; }
  next() { return String(++this._n).padStart(4, '0'); }
}

module.exports = { RandomMatchCodeGenerator, SequenceMatchCodeGenerator };
