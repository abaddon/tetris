'use strict';

// TrivialStrategy — wraps firstEmptyCell from shared/game.js.
// This is the sprint-05 baseline adapter. Behaviour is bit-exact with the
// original direct firstEmptyCell(board) call: returns the index of the first
// null cell, or -1 if the board is full.
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.
// `mark` is accepted for interface conformance but is not used by this strategy.

const { firstEmptyCell } = require('../../game.js');

/**
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} _mark
 * @returns {number}
 */
function chooseCell(state, _mark) {
  return firstEmptyCell(state.board);
}

module.exports = { chooseCell };
