'use strict';

// EasyStrategy — uniform random selection from empty cells (ADR-0009).
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.
// `mark` is accepted for interface conformance but is not used by this strategy.

/**
 * Returns a uniformly random empty cell index, or -1 if no legal move exists.
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} _mark
 * @returns {number}
 */
function chooseCell(state, _mark) {
  const empty = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) empty.push(i);
  }
  if (empty.length === 0) return -1;
  return empty[Math.floor(Math.random() * empty.length)];
}

module.exports = { chooseCell };
