'use strict';

// HardStrategy — depth-limited minimax with discounted evaluation (ADR-0009).
//
// Depth limit: DEFAULT_DEPTH (3 plies). Score: +10 - depth on win, -10 + depth
// on loss, 0 at draw or leaf. Tie-break by lowest cell index.
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.

const { detectWinner } = require('../../game.js');

/** Default search depth (plies). Exported for visibility and tests. */
const DEFAULT_DEPTH = 3;

/**
 * Return the terminal score from the perspective of `maximisingMark`, or null
 * if the board is not terminal.
 * @param {Array<null|'X'|'O'>} board
 * @param {'X'|'O'} maximisingMark
 * @param {number} depth  — depth already consumed (used for discounting)
 * @returns {number|null}
 */
function terminalScore(board, maximisingMark, depth) {
  const winner = detectWinner(board);
  if (winner === maximisingMark) return 10 - depth;
  if (winner !== null) return -10 + depth;      // opponent won
  if (board.every((c) => c !== null)) return 0; // draw
  return null; // not terminal
}

/**
 * Recursive minimax.
 * @param {Array<null|'X'|'O'>} board
 * @param {'X'|'O'} currentMark   — whose turn it is in this node
 * @param {'X'|'O'} maximisingMark — the top-level caller's mark (stays constant)
 * @param {number} depth           — remaining depth budget
 * @returns {number} score
 */
function minimax(board, currentMark, maximisingMark, depth) {
  const score = terminalScore(board, maximisingMark, DEFAULT_DEPTH - depth);
  if (score !== null) return score;
  if (depth === 0) return 0; // horizon — treat as draw

  const isMaximising = currentMark === maximisingMark;
  const opponent = currentMark === 'X' ? 'O' : 'X';
  let best = isMaximising ? -Infinity : Infinity;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const next = board.slice();
    next[i] = currentMark;
    const val = minimax(next, opponent, maximisingMark, depth - 1);
    if (isMaximising) {
      if (val > best) best = val;
    } else {
      if (val < best) best = val;
    }
  }
  return best;
}

/**
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} mark
 * @param {number} [depth]
 * @returns {number}
 */
function chooseCell(state, mark, depth) {
  const maxDepth = (depth != null && Number.isFinite(depth)) ? depth : DEFAULT_DEPTH;
  const board = state.board;
  const opponent = mark === 'X' ? 'O' : 'X';

  let bestScore = -Infinity;
  let bestCell = -1;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const next = board.slice();
    next[i] = mark;
    // Use the actual maxDepth for the initial call's depth parameter
    const score = _minimaxD(next, opponent, mark, maxDepth - 1, maxDepth);
    if (score > bestScore || (score === bestScore && bestCell === -1)) {
      bestScore = score;
      bestCell = i;
    }
  }
  return bestCell;
}

/**
 * Internal minimax with configurable max depth.
 */
function _minimaxD(board, currentMark, maximisingMark, depth, maxDepth) {
  const winner = detectWinner(board);
  const depthUsed = maxDepth - depth;
  if (winner === maximisingMark) return 10 - depthUsed;
  if (winner !== null) return -10 + depthUsed;
  if (board.every((c) => c !== null)) return 0;
  if (depth === 0) return 0;

  const isMaximising = currentMark === maximisingMark;
  const opponent = currentMark === 'X' ? 'O' : 'X';
  let best = isMaximising ? -Infinity : Infinity;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const next = board.slice();
    next[i] = currentMark;
    const val = _minimaxD(next, opponent, maximisingMark, depth - 1, maxDepth);
    if (isMaximising) {
      if (val > best) best = val;
    } else {
      if (val < best) best = val;
    }
  }
  return best;
}

module.exports = { chooseCell, DEFAULT_DEPTH };
