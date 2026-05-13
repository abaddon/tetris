# LinkedIn — Sprint 06

Tris now ships six AI difficulty tiers for single-player mode: trivial (first-empty-cell baseline), random, weighted heuristic with 1-ply win/block scan, depth-limited minimax (depth 3), full minimax with alpha-beta pruning, and UCT Monte Carlo Tree Search (500 iterations).

The interesting engineering problem here is not the algorithms themselves — tic-tac-toe is solved, and alpha-beta on a 3x3 board fits in 5 ms worst-case, well inside the 50 ms NFR we set for every strategy. The value is in the architecture: a `BotStrategy` port injected into `MatchHub`, a registry keyed by difficulty string, and six pure-function strategy modules in `shared/ai/` that import nothing outside Node core and `shared/game.js`.

Sprint-05's leaderboard exclusion guarantees (sentinel scoring guard + three-layer filter) are structurally above the strategy dispatch and are unaffected. 1,439 assertions, 0 failures.

Commit SHAs: f2924a1 (ADR-0009), 5483a86 (strategies), 34acf33 (API), 7978f25 (QA fixes)
