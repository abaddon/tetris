'use strict';

// MediumStrategy — 1-ply win/block scan + weighted-cell fallback (ADR-0009).
//
// Priority order:
//   1. Take an immediate winning move for `mark`.
//   2. Block an immediate winning move for the opponent.
//   3. Weighted-random fallback: center (cell 4) weight 4, corners (0,2,6,8) weight 2,
//      edges (1,3,5,7) weight 1.
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.

// WIN_LINES is not exported from game.js so we define it here (same data).
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

// Cell weights: center=4, corners=2, edges=1
const CELL_WEIGHTS = [2, 1, 2, 1, 4, 1, 2, 1, 2];

/**
 * Returns the index of an immediate win for `mark` on `board`, or -1 if none.
 * @param {Array<null|'X'|'O'>} board
 * @param {'X'|'O'} mark
 * @returns {number}
 */
function findWinningMove(board, mark) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [board[a], board[b], board[c]];
    const markCount = line.filter((v) => v === mark).length;
    const emptyCount = line.filter((v) => v === null).length;
    if (markCount === 2 && emptyCount === 1) {
      // Return the empty cell in this winning line
      if (board[a] === null) return a;
      if (board[b] === null) return b;
      return c;
    }
  }
  return -1;
}

/**
 * Returns a cell using the weighted-random fallback for empty cells.
 * Among tied-weight cells, picks uniformly at random.
 * @param {Array<null|'X'|'O'>} board
 * @returns {number}
 */
function weightedFallback(board) {
  // Build weighted pool
  const pool = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      for (let w = 0; w < CELL_WEIGHTS[i]; w++) {
        pool.push(i);
      }
    }
  }
  if (pool.length === 0) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} mark
 * @returns {number}
 */
function chooseCell(state, mark) {
  const board = state.board;
  const opponent = mark === 'X' ? 'O' : 'X';

  // 1. Immediate win
  const win = findWinningMove(board, mark);
  if (win !== -1) return win;

  // 2. Block opponent's immediate win
  const block = findWinningMove(board, opponent);
  if (block !== -1) return block;

  // 3. Weighted-random fallback
  const fallback = weightedFallback(board);
  if (fallback !== -1) return fallback;

  return -1;
}

module.exports = { chooseCell, findWinningMove, weightedFallback };
