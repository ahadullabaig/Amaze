// Breadth-First Reconnaissance.
// Optimal on unweighted graphs. Spreads in concentric rings.

export function* bfsSolver(maze, start = maze.start, goal = maze.goal) {
  const N = maze.cells.length;
  const parent = new Int32Array(N).fill(-1);
  const visited = new Uint8Array(N);
  const queue = [start];
  let head = 0;
  visited[start] = 1;
  parent[start] = start;

  yield { type: 'frontier-add', hex: start };

  while (head < queue.length) {
    const i = queue[head++];
    yield { type: 'visit', hex: i, parent: parent[i] };

    if (i === goal) {
      const path = reconstruct(parent, start, goal);
      yield { type: 'done', path };
      return;
    }

    for (const j of maze.neighborsOpen(i)) {
      if (visited[j]) continue;
      visited[j] = 1;
      parent[j] = i;
      queue.push(j);
      yield { type: 'frontier-add', hex: j };
    }
  }
  yield { type: 'done', path: null };
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
