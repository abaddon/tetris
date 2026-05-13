'use strict';

// Public surface for shared/ai.
// Only import this module from server/ and test files.
// Wave-3b stories that add new strategies call registry.register() on the
// defaultRegistry exported here.

const { DIFFICULTIES, createRegistry, defaultRegistry } = require('./strategy.js');

module.exports = { DIFFICULTIES, createRegistry, defaultRegistry };
