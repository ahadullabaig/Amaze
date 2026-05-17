// ─────────────────────────────────────────────────────────────────────────────
// POINTY-TOP hexagons. Axial coordinates (q, r).
// Direction 0 = E neighbor; directions advance clockwise (E, SE, SW, W, NW, NE).
// Vertex 0 = top-right (angle -30°); vertices advance clockwise.
// Edge i is between vertex i and vertex i+1, shared with neighbor in direction i.
// Wall storage: 6-bit mask per hex. Carve symmetrically: removing wall i on hex A
// also removes wall (i + 3) % 6 on its neighbor.
// ─────────────────────────────────────────────────────────────────────────────

export const SQRT3 = Math.sqrt(3);

// Order: E, SE, SW, W, NW, NE  (clockwise from East, for pointy-top)
export const AXIAL_DIRS = [
  { q: +1, r:  0 }, // 0  E
  { q:  0, r: +1 }, // 1  SE
  { q: -1, r: +1 }, // 2  SW
  { q: -1, r:  0 }, // 3  W
  { q:  0, r: -1 }, // 4  NW
  { q: +1, r: -1 }, // 5  NE
];

export const OPPOSITE = [3, 4, 5, 0, 1, 2];

export function neighbor(q, r, dir) {
  const d = AXIAL_DIRS[dir];
  return { q: q + d.q, r: r + d.r };
}

// Axial → pixel for pointy-top hex of given size s (center → vertex).
export function axialToPixel(q, r, s, ox = 0, oy = 0) {
  const x = ox + s * SQRT3 * (q + r / 2);
  const y = oy + s * 1.5 * r;
  return { x, y };
}

// The six vertices of a pointy-top hex, vertex 0 at top-right.
// Angle for vertex i: -30° + 60° * i, measured clockwise.
export function hexVertices(cx, cy, s) {
  const verts = new Array(6);
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (-30 + 60 * i);
    verts[i] = { x: cx + s * Math.cos(ang), y: cy + s * Math.sin(ang) };
  }
  return verts;
}

// Returns the segment of edge i (between vertex i and vertex i+1) for drawing walls.
export function hexEdge(cx, cy, s, i) {
  const v = hexVertices(cx, cy, s);
  return { a: v[i], b: v[(i + 1) % 6] };
}

// Hex distance in axial coordinates. Admissible heuristic for A* on a hex grid
// without obstacles — equals the true minimum step count.
export function hexDistance(aq, ar, bq, br) {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// Build a rectangular footprint of axial cells: r in [0, rows), q in
// [-floor(r/2), cols - floor(r/2)). This is the "rhombus with shear" layout
// that fits a rectangular canvas cleanly for pointy-top hexes.
export function buildRectFootprint(cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const qOffset = -Math.floor(r / 2);
    for (let q = qOffset; q < qOffset + cols; q++) {
      cells.push({ q, r });
    }
  }
  return cells;
}

// Bounding box (in pixels) of a rect footprint rendered at hex size s.
export function rectFootprintBounds(cols, rows, s) {
  const w = s * SQRT3 * cols + s * SQRT3 / 2;
  const h = s * 1.5 * (rows - 1) + s * 2;
  return { width: w, height: h };
}

// Inverse: pick a hex size that fits cols×rows into a target box.
export function fitHexSize(cols, rows, maxW, maxH, pad = 12) {
  const availW = maxW - pad * 2;
  const availH = maxH - pad * 2;
  const sByW = availW / (SQRT3 * cols + SQRT3 / 2);
  const sByH = availH / (1.5 * (rows - 1) + 2);
  return Math.max(6, Math.min(sByW, sByH));
}

// Canonical key for a cell.
export const key = (q, r) => `${q},${r}`;
