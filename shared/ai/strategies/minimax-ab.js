'use strict';

// ExpertStrategy — full minimax with alpha-beta pruning (ADR-0009).
//
// No depth limit. Score: +10 - depth on win, -10 + depth on loss, 0 on draw.
// Tie-break by lowest cell index. Provably optimal (unbeatable) for any legal board.
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.

const { detectWinner } = require('../../game.js');

/**
 * Alpha-beta minimax search.
 * @param {Array<null|'X'|'O'>} board
 * @param {'X'|'O'} currentMark
 * @param {'X'|'O'} maximisingMark
 * @param {number} depth — depth consumed so far (for discounting)
 * @param {number} alpha
 * @param {number} beta
 * @returns {number}
 */
function alphabeta(board, currentMark, maximisingMark, depth, alpha, beta) {
  const winner = detectWinner(board);
  if (winner === maximisingMark) return 10 - depth;
  if (winner !== null) return -10 + depth;
  if (board.every((c) => c !== null)) return 0;

  const isMaximising = currentMark === maximisingMark;
  const opponent = currentMark === 'X' ? 'O' : 'X';

  if (isMaximising) {
    let best = -Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue;
      const next = board.slice();
      next[i] = currentMark;
      const val = alphabeta(next, opponent, maximisingMark, depth + 1, alpha, beta);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (alpha >= beta) break; // beta cut-off
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue;
      const next = board.slice();
      next[i] = currentMark;
      const val = alphabeta(next, opponent, maximisingMark, depth + 1, alpha, beta);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (alpha >= beta) break; // alpha cut-off
    }
    return best;
  }
}

/**
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} mark
 * @returns {number}
 */
function chooseCell(state, mark) {
  const board = state.board;
  const opponent = mark === 'X' ? 'O' : 'X';

  let bestScore = -Infinity;
  let bestCell = -1;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const next = board.slice();
    next[i] = mark;
    const score = alphabeta(next, opponent, mark, 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestCell = i;
    }
    // Tie-break: lower cell index wins — since we iterate 0..8 and only update on strict >,
    // the first (lowest) cell that achieves the best score is kept.
  }

  if (bestCell === -1) return -1; // no legal move (full board)
  return bestCell;
}

module.exports = { chooseCell, alphabeta };
