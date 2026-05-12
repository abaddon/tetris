'use strict';

const crypto = require('node:crypto');
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CODE_LEN = 5; // 32^5 = 33M possibilities per ADR-0005

class RandomMatchCodeGenerator {
  next() {
    let code = '';
    const bytes = crypto.randomBytes(CODE_LEN);
    for (let i = 0; i < CODE_LEN; i++) {
      code += CHARS[bytes[i] & 31]; // 32 symbols, 32 divides 256 — unbiased
    }
    return code;
  }
}

class SequenceMatchCodeGenerator {
  constructor() { this._n = 0; }
  next() { return String(++this._n).padStart(CODE_LEN, '0'); }
}

module.exports = { RandomMatchCodeGenerator, SequenceMatchCodeGenerator };
