// Pure game logic for Tris (tic-tac-toe). No DOM, no globals.
// Used by both the browser (index.html) and the Node test runner (test.js).

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

function createGame() {
  return {
    board: Array(9).fill(null), // null | 'X' | 'O'
    turn: 'X',
    winner: null,               // null | 'X' | 'O'
    draw: false,
  };
}

function play(state, cell) {
  if (state.winner || state.draw) return state;          // game over: ignore
  if (cell < 0 || cell > 8) return state;
  if (state.board[cell] !== null) return state;          // occupied: ignore

  const board = state.board.slice();
  board[cell] = state.turn;

  const winner = detectWinner(board);
  const draw = !winner && board.every((c) => c !== null);
  const turn = winner || draw ? state.turn : (state.turn === 'X' ? 'O' : 'X');

  return { board, turn, winner, draw };
}

function detectWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function statusText(state) {
  if (state.winner) return `Winner: ${state.winner}`;
  if (state.draw) return 'Draw';
  return `Turn: ${state.turn}`;
}

// Parse a 9-char board string: 'X','O','.' (dot = empty). Helper for tests/scenarios.
// `nextTurn` is optional and overrides the inferred turn (useful for scenario
// outlines where the spec dictates whose move it is).
function fromString(s, nextTurn) {
  if (typeof s !== 'string' || s.length !== 9) {
    throw new Error('board string must be 9 chars');
  }
  const board = s.split('').map((c) => (c === 'X' ? 'X' : c === 'O' ? 'O' : null));
  const xs = board.filter((c) => c === 'X').length;
  const os = board.filter((c) => c === 'O').length;
  const inferred = xs <= os ? 'X' : 'O';
  const turn = nextTurn === 'X' || nextTurn === 'O' ? nextTurn : inferred;
  const winner = detectWinner(board);
  const draw = !winner && board.every((c) => c !== null);
  return { board, turn, winner, draw };
}

function resolveName(raw, side) {
  var trimmed = (typeof raw === 'string' ? raw : '').trim();
  return trimmed.length > 0 ? trimmed : ('Player ' + side);
}

// Returns new scores object with winner's score incremented; draw leaves scores unchanged.
function applyResult(scores, winner) {
  if (!winner) return { X: scores.X, O: scores.O };
  return {
    X: scores.X + (winner === 'X' ? 1 : 0),
    O: scores.O + (winner === 'O' ? 1 : 0),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGame, play, detectWinner, statusText, fromString, resolveName, applyResult };
}
