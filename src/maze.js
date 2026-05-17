import { AXIAL_DIRS, OPPOSITE, buildRectFootprint, key } from './hex.js';

// Maze is a graph over an arbitrary set of axial-coordinate cells.
// Walls are stored as a 6-bit mask per cell (bit i = wall i present).
// Carving a passage removes bit i from cell A and bit OPPOSITE[i] from neighbor B.

export class HexMaze {
  constructor(cells) {
    // cells: array of {q, r}
    this.cells = cells.map(c => ({ q: c.q, r: c.r }));
    this.index = new Map(); // key -> index
    this.cells.forEach((c, i) => this.index.set(key(c.q, c.r), i));
    this.walls = new Uint8Array(this.cells.length).fill(0b111111);
    this.start = null;
    this.goal = null;
    this.seed = 0;
  }

  static fromRect(cols, rows) {
    return new HexMaze(buildRectFootprint(cols, rows));
  }

  has(q, r) { return this.index.has(key(q, r)); }
  idxOf(q, r) { return this.index.get(key(q, r)); }
  cell(i) { return this.cells[i]; }

  neighborsOpen(i) {
    // Open (passable) neighbor indices for cell i.
    const { q, r } = this.cells[i];
    const w = this.walls[i];
    const out = [];
    for (let d = 0; d < 6; d++) {
      if (w & (1 << d)) continue; // wall closed
      const nq = q + AXIAL_DIRS[d].q;
      const nr = r + AXIAL_DIRS[d].r;
      const j = this.index.get(key(nq, nr));
      if (j !== undefined) out.push(j);
    }
    return out;
  }

  neighborsAll(i) {
    // All in-bounds neighbors regardless of walls; returns [{j, dir}, ...].
    const { q, r } = this.cells[i];
    const out = [];
    for (let d = 0; d < 6; d++) {
      const nq = q + AXIAL_DIRS[d].q;
      const nr = r + AXIAL_DIRS[d].r;
      const j = this.index.get(key(nq, nr));
      if (j !== undefined) out.push({ j, dir: d });
    }
    return out;
  }

  hasWall(i, dir) { return (this.walls[i] & (1 << dir)) !== 0; }

  carve(i, dir) {
    const { q, r } = this.cells[i];
    const nq = q + AXIAL_DIRS[dir].q;
    const nr = r + AXIAL_DIRS[dir].r;
    const j = this.index.get(key(nq, nr));
    if (j === undefined) return;
    this.walls[i] &= ~(1 << dir);
    this.walls[j] &= ~(1 << OPPOSITE[dir]);
  }

  resetWalls() {
    this.walls.fill(0b111111);
  }
}
