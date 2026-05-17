// Depth-First Plunge.
// Iterative DFS with explicit stack. Not guaranteed optimal.
// Visually: long winding plunges, occasional dramatic backtracks.

export function* dfsSolver(maze, start = maze.start, goal = maze.goal) {
  const N = maze.cells.length;
  const visited = new Uint8Array(N);
  const parent = new Int32Array(N).fill(-1);
  const stack = [start];
  parent[start] = start;
  visited[start] = 1;
  yield { type: 'frontier-add', hex: start };

  while (stack.length) {
    const i = stack[stack.length - 1];
    yield { type: 'visit', hex: i, parent: parent[i] };

    if (i === goal) {
      const path = reconstructStack(stack);
      yield { type: 'done', path };
      return;
    }

    let advanced = false;
    for (const j of maze.neighborsOpen(i)) {
      if (visited[j]) continue;
      visited[j] = 1;
      parent[j] = i;
      stack.push(j);
      yield { type: 'frontier-add', hex: j };
      advanced = true;
      break; // depth-first: take one branch then commit
    }
    if (!advanced) {
      stack.pop();
      yield { type: 'frontier-pop', hex: i };
    }
  }
  yield { type: 'done', path: null };
}

function reconstructStack(stack) {
  // The stack itself IS the current DFS path from start to goal.
  return stack.slice();
}
