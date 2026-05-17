import { hexDistance } from '../hex.js';

// A* with admissible hex-distance heuristic. Sorted-insert array for the
// open set — fine for ≤300 hexes; no need for a heap.

export function* astarSolver(maze, start = maze.start, goal = maze.goal) {
  const N = maze.cells.length;
  const gScore = new Float32Array(N).fill(Infinity);
  const fScore = new Float32Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const inOpen = new Uint8Array(N);
  const closed = new Uint8Array(N);

  const gc = maze.cells[goal];
  const h = i => {
    const c = maze.cells[i];
    return hexDistance(c.q, c.r, gc.q, gc.r);
  };

  gScore[start] = 0;
  fScore[start] = h(start);
  parent[start] = start;

  // open: array of indices, kept sorted by fScore ascending.
  const open = [start];
  inOpen[start] = 1;
  yield { type: 'frontier-add', hex: start };

  while (open.length) {
    const i = open.shift();
    inOpen[i] = 0;
    if (closed[i]) continue;
    closed[i] = 1;

    yield { type: 'visit', hex: i, parent: parent[i] };

    if (i === goal) {
      const path = reconstruct(parent, start, goal);
      yield { type: 'done', path };
      return;
    }

    for (const j of maze.neighborsOpen(i)) {
      if (closed[j]) continue;
      const tentative = gScore[i] + 1;
      if (tentative < gScore[j]) {
        parent[j] = i;
        gScore[j] = tentative;
        fScore[j] = tentative + h(j);
        if (inOpen[j]) {
          // remove existing, re-insert sorted
          const idx = open.indexOf(j);
          if (idx >= 0) open.splice(idx, 1);
        }
        insertSorted(open, j, fScore);
        inOpen[j] = 1;
        yield { type: 'frontier-add', hex: j };
      }
    }
  }
  yield { type: 'done', path: null };
}

function insertSorted(arr, val, scoreArr) {
  let lo = 0, hi = arr.length;
  const s = scoreArr[val];
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (scoreArr[arr[mid]] <= s) lo = mid + 1; else hi = mid;
  }
  arr.splice(lo, 0, val);
}

function reconstruct(parent, start, goal) {
  const path = [];
  let cur = goal;
  while (cur !== start) {
    path.push(cur);
    cur = parent[cur];
  }
  path.push(start);
  return path.reverse();
}
