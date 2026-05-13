'use strict';

// Public surface for shared/ai.
// Only import this module from server/ and test files.

const { DIFFICULTIES, createRegistry, defaultRegistry } = require('./strategy.js');
const trivial     = require('./strategies/trivial.js');
const random      = require('./strategies/random.js');
const heuristic   = require('./strategies/heuristic.js');
const minimax     = require('./strategies/minimax.js');
const minimaxAb   = require('./strategies/minimax-ab.js');
const mcts        = require('./strategies/mcts.js');

module.exports = {
  DIFFICULTIES,
  createRegistry,
  defaultRegistry,
  strategies: { trivial, random, heuristic, minimax, minimaxAb, mcts },
};
