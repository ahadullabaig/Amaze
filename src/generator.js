import { shuffle } from './rng.js';

// Recursive Backtracker, iterative form. Yields step events for animated
// generation if desired.
//   { type: 'carve', from, to, dir }
//   { type: 'backtrack', at }
//   { type: 'done' }

export function* recursiveBacktracker(maze, rng, startIdx = 0) {
  const visited = new Uint8Array(maze.cells.length);
  const stack = [startIdx];
  visited[startIdx] = 1;

  while (stack.length) {
    const i = stack[stack.length - 1];
    const candidates = [];
    const neigh = maze.neighborsAll(i);
    for (const { j, dir } of neigh) {
      if (!visited[j]) candidates.push({ j, dir });
    }
    if (candidates.length === 0) {
      stack.pop();
      yield { type: 'backtrack', at: i };
      continue;
    }
    const pick = shuffle(rng, candidates)[0];
    maze.carve(i, pick.dir);
    visited[pick.j] = 1;
    stack.push(pick.j);
    yield { type: 'carve', from: i, to: pick.j, dir: pick.dir };
  }
  yield { type: 'done' };
}

export function generateMazeInstantly(maze, rng, startIdx = 0) {
  for (const _step of recursiveBacktracker(maze, rng, startIdx)) { /* no-op */ }
}

// Pick a sensible start/goal pair: far-apart corners of the rectangle.
export function pickStartAndGoal(maze) {
  // Take leftmost-top and rightmost-bottom cells.
  let bestStart = 0, bestGoal = 0;
  let minQ = Infinity, maxQ = -Infinity;
  let minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < maze.cells.length; i++) {
    const c = maze.cells[i];
    if (c.r < minR || (c.r === minR && c.q < minQ)) { minR = c.r; minQ = c.q; bestStart = i; }
    if (c.r > maxR || (c.r === maxR && c.q > maxQ)) { maxR = c.r; maxQ = c.q; bestGoal = i; }
  }
  maze.start = bestStart;
  maze.goal = bestGoal;
}
