'use strict';

// ShowcaseStrategy — UCT Monte Carlo Tree Search (ADR-0009).
//
// ITERATIONS = 500, EXPLORATION = sqrt(2).
// Rollout: uniform random (reuses random.js logic).
// Result: most-visited child. Tie-break by lowest cell index.
//
// Signature: (state, mark) => number   where number is in [0..8] or -1.

const { detectWinner } = require('../../game.js');
const { chooseCell: randomChoose } = require('./random.js');

/** Number of UCT iterations. Exported for visibility and tests. */
const ITERATIONS = 500;

/** UCT exploration constant. */
const EXPLORATION = Math.SQRT2;

/**
 * A node in the MCTS tree.
 */
class MctsNode {
  /**
   * @param {Array<null|'X'|'O'>} board
   * @param {'X'|'O'} markToMove  — whose turn it is to play from this node
   * @param {'X'|'O'} rootMark    — the strategy's own mark (constant throughout the tree)
   * @param {MctsNode|null} parent
   * @param {number} moveIndex    — the cell that was played to reach this node (-1 for root)
   */
  constructor(board, markToMove, rootMark, parent, moveIndex) {
    this.board = board;
    this.markToMove = markToMove;
    this.rootMark = rootMark;
    this.parent = parent;
    this.moveIndex = moveIndex;

    this.wins = 0;
    this.visits = 0;
    this.children = [];

    // Unvisited legal moves from this position
    this.untriedMoves = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) this.untriedMoves.push(i);
    }
  }

  /** True if this node is a terminal game state. */
  isTerminal() {
    return detectWinner(this.board) !== null || this.board.every((c) => c !== null);
  }

  /** True if all legal moves have been expanded. */
  isFullyExpanded() {
    return this.untriedMoves.length === 0;
  }

  /**
   * UCT score from the perspective of the parent (i.e., maximise for this node's owner).
   * @param {number} parentVisits
   * @returns {number}
   */
  uctScore(parentVisits) {
    if (this.visits === 0) return Infinity;
    return this.wins / this.visits + EXPLORATION * Math.sqrt(Math.log(parentVisits) / this.visits);
  }

  /**
   * Select the child with the highest UCT score.
   * @returns {MctsNode}
   */
  selectBestChild() {
    let best = -Infinity;
    let bestNode = null;
    // Iterate lowest index first so ties resolve to the lowest cell index
    const sorted = this.children.slice().sort((a, b) => a.moveIndex - b.moveIndex);
    for (const child of sorted) {
      const score = child.uctScore(this.visits);
      if (score > best) {
        best = score;
        bestNode = child;
      }
    }
    return bestNode;
  }

  /**
   * Expand one untried move and return the new child node.
   * @returns {MctsNode}
   */
  expand() {
    // Pop the first untried move (in index order)
    this.untriedMoves.sort((a, b) => a - b);
    const move = this.untriedMoves.shift();
    const nextBoard = this.board.slice();
    nextBoard[move] = this.markToMove;
    const nextMark = this.markToMove === 'X' ? 'O' : 'X';
    const child = new MctsNode(nextBoard, nextMark, this.rootMark, this, move);
    this.children.push(child);
    return child;
  }
}

/**
 * Simulate a random playout from `board` starting with `markToMove`.
 * Returns the winner ('X'|'O') or null for a draw.
 * @param {Array<null|'X'|'O'>} board
 * @param {'X'|'O'} markToMove
 * @returns {'X'|'O'|null}
 */
function rollout(board, markToMove) {
  const b = board.slice();
  let mark = markToMove;
  while (true) {
    const winner = detectWinner(b);
    if (winner !== null) return winner;
    const empty = [];
    for (let i = 0; i < b.length; i++) {
      if (b[i] === null) empty.push(i);
    }
    if (empty.length === 0) return null; // draw
    const move = empty[Math.floor(Math.random() * empty.length)];
    b[move] = mark;
    mark = mark === 'X' ? 'O' : 'X';
  }
}

/**
 * Backpropagate the result up the tree.
 * `result` is the winner mark or null for a draw.
 * We count a win from the perspective of rootMark.
 * @param {MctsNode} node
 * @param {'X'|'O'|null} result
 */
function backpropagate(node, result) {
  let current = node;
  while (current !== null) {
    current.visits++;
    if (result === current.rootMark) current.wins++;
    current = current.parent;
  }
}

/**
 * @param {{ board: Array<null|'X'|'O'>, turn: 'X'|'O', winner: null|'X'|'O', draw: boolean }} state
 * @param {'X'|'O'} mark
 * @returns {number}
 */
function chooseCell(state, mark) {
  const board = state.board;

  // Quick check: no legal moves
  const hasMoves = board.some((c) => c === null);
  if (!hasMoves) return -1;

  const root = new MctsNode(board.slice(), mark, mark, null, -1);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // 1. Selection
    let node = root;
    while (!node.isTerminal() && node.isFullyExpanded()) {
      node = node.selectBestChild();
    }

    // 2. Expansion
    if (!node.isTerminal() && !node.isFullyExpanded()) {
      node = node.expand();
    }

    // 3. Simulation
    const result = rollout(node.board.slice(), node.markToMove);

    // 4. Backpropagation
    backpropagate(node, result);
  }

  // Choose the most-visited child; tie-break by lowest cell index
  if (root.children.length === 0) return -1;
  let bestVisits = -1;
  let bestMove = -1;
  // Sort by moveIndex so that ties resolve to lowest cell
  const sortedChildren = root.children.slice().sort((a, b) => a.moveIndex - b.moveIndex);
  for (const child of sortedChildren) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestMove = child.moveIndex;
    }
  }
  return bestMove;
}

module.exports = { chooseCell, ITERATIONS, EXPLORATION };
