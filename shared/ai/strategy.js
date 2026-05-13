'use strict';

// Strategy registry for the Tris AI engine (ADR-0009).
//
// BotStrategy (JSDoc typedef):
//   An object with a single method:
//     chooseCell(state: GameState, mark: 'X'|'O') -> number  // integer in [0..8] or -1
//
// GameState shape (from shared/game.js):
//   { board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }

/**
 * @typedef {Object} BotStrategy
 * @property {function(GameState, 'X'|'O'): number} chooseCell
 */

/**
 * Canonical difficulty levels for the AI engine.
 * @type {string[]}
 */
const DIFFICULTIES = ['trivial', 'easy', 'medium', 'hard', 'expert', 'showcase'];

/**
 * Creates a fresh, empty strategy registry backed by a Map.
 * The registry is pre-populated with the trivial strategy only.
 *
 * Registry API:
 *   registry.register(difficulty: string, strategy: BotStrategy) -> void
 *   registry.get(difficulty: string) -> BotStrategy   (falls back to trivial + console.warn)
 *   registry.list() -> string[]
 *
 * @returns {Object}
 */
function createRegistry() {
  const trivialStrategy = require('./strategies/trivial.js');
  const _map = new Map();

  // Pre-populate trivial (the only strategy story 01 ships).
  _map.set('trivial', trivialStrategy);

  return {
    /**
     * Register a strategy for a given difficulty key.
     * @param {string} difficulty
     * @param {BotStrategy} strategy
     */
    register(difficulty, strategy) {
      _map.set(difficulty, strategy);
    },

    /**
     * Retrieve the strategy for the given difficulty.
     * Falls back to 'trivial' with a console.warn for unknown values.
     * Never throws.
     * @param {string} difficulty
     * @returns {BotStrategy}
     */
    get(difficulty) {
      const key = typeof difficulty === 'string' ? difficulty.toLowerCase() : '';
      if (_map.has(key)) return _map.get(key);
      console.warn('[match-hub] unknown difficulty: %s — using trivial', difficulty);
      return _map.get('trivial');
    },

    /**
     * Returns the list of registered difficulty keys.
     * @returns {string[]}
     */
    list() {
      return Array.from(_map.keys());
    },
  };
}

// Default registry — pre-populated with all strategies (ADR-0009 wave-3b).
const defaultRegistry = createRegistry();
defaultRegistry.register('easy',     require('./strategies/random.js'));
defaultRegistry.register('medium',   require('./strategies/heuristic.js'));
defaultRegistry.register('hard',     require('./strategies/minimax.js'));
defaultRegistry.register('expert',   require('./strategies/minimax-ab.js'));
defaultRegistry.register('showcase', require('./strategies/mcts.js'));

module.exports = { BotStrategy: undefined, DIFFICULTIES, createRegistry, defaultRegistry };
