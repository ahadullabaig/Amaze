import { COLORS, ROUGH_WALL, ROUGH_SOLUTION, ALGO_META } from './palette.js';
import {
  axialToPixel, hexVertices, hexEdge,
  rectFootprintBounds, fitHexSize, SQRT3,
} from './hex.js';

// PanelRenderer: owns a single panel's two canvases (walls + state).
// - wallsCanvas: drawn once after generation via rough.js, then blitted as-is.
// - stateCanvas: cleared and repainted from `state` each frame.

export class PanelRenderer {
  constructor(panelEl, algo) {
    this.panelEl = panelEl;
    this.algo = algo;
    this.meta = ALGO_META[algo];
    this.wallsCanvas = panelEl.querySelector('canvas[data-role="walls"]');
    this.stateCanvas = panelEl.querySelector('canvas[data-role="state"]');
    this.wrap = panelEl.querySelector('.panel-canvas-wrap');
    this.wallsCtx = this.wallsCanvas.getContext('2d');
    this.stateCtx = this.stateCanvas.getContext('2d');
    this.rc = null; // rough canvas, lazy init when walls are drawn
    this.dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));

    this.layout = null; // {hexSize, originX, originY, cols, rows}
    this.maze = null;

    // Per-frame state
    this.state = {
      visited: new Set(),
      frontier: new Set(),
      current: -1,
      path: null,
      pathFraction: 0,     // 0..1, fraction of path stroke drawn
      finished: false,
    };
  }

  resize(targetW, targetH) {
    // Set CSS size then apply DPR-aware pixel size.
    this.wrap.style.width = `${targetW}px`;
    this.wrap.style.height = `${targetH}px`;
    for (const c of [this.wallsCanvas, this.stateCanvas]) {
      c.width = Math.round(targetW * this.dpr);
      c.height = Math.round(targetH * this.dpr);
      c.style.width = `${targetW}px`;
      c.style.height = `${targetH}px`;
      c.getContext('2d').setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  setMaze(maze, cols, rows) {
    this.maze = maze;
    const cssW = parseFloat(this.wallsCanvas.style.width) || this.wallsCanvas.width / this.dpr;
    const cssH = parseFloat(this.wallsCanvas.style.height) || this.wallsCanvas.height / this.dpr;
    const hexSize = fitHexSize(cols, rows, cssW, cssH, 14);
    const bounds = rectFootprintBounds(cols, rows, hexSize);
    const originX = (cssW - bounds.width) / 2 + hexSize * SQRT3 / 2;
    const originY = (cssH - bounds.height) / 2 + hexSize;
    this.layout = { hexSize, originX, originY, cols, rows };
  }

  clearAll() {
    const cssW = this.wallsCanvas.width / this.dpr;
    const cssH = this.wallsCanvas.height / this.dpr;
    this.wallsCtx.clearRect(0, 0, cssW, cssH);
    this.stateCtx.clearRect(0, 0, cssW, cssH);
    this.state = {
      visited: new Set(),
      frontier: new Set(),
      current: -1,
      path: null,
      pathFraction: 0,
      finished: false,
    };
  }

  // Faint hex-grid hint shown before maze generation, so the empty page
  // doesn't look blank — like graph paper for a future map.
  drawEmptyGrid() {
    const ctx = this.wallsCtx;
    const { hexSize, originX, originY, cols, rows } = this.layout;
    ctx.strokeStyle = 'rgba(107, 68, 35, 0.16)';
    ctx.lineWidth = 0.6;
    for (let r = 0; r < rows; r++) {
      const qOff = -Math.floor(r / 2);
      for (let q = qOff; q < qOff + cols; q++) {
        const { x, y } = axialToPixel(q, r, hexSize, originX, originY);
        const v = hexVertices(x, y, hexSize);
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < 6; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // Render maze walls via rough.js to the walls canvas. Uses shared seed
  // so all three panels produce IDENTICAL jitter (read as the same maze).
  drawWalls(seed) {
    if (!this.maze || !this.layout) return;
    const ctx = this.wallsCtx;
    const cssW = this.wallsCanvas.width / this.dpr;
    const cssH = this.wallsCanvas.height / this.dpr;
    ctx.clearRect(0, 0, cssW, cssH);

    // re-init rough.js to apply our seed
    this.rc = window.rough.canvas(this.wallsCanvas, { options: { ...ROUGH_WALL, seed } });

    const { hexSize, originX, originY } = this.layout;
    const maze = this.maze;

    // Collect unique edges (avoid double-drawing shared walls). Only draw
    // edge i for hex with smaller index than its neighbor across dir i.
    const opts = { ...ROUGH_WALL, seed };
    for (let i = 0; i < maze.cells.length; i++) {
      const { q, r } = maze.cells[i];
      const { x, y } = axialToPixel(q, r, hexSize, originX, originY);
      for (let d = 0; d < 6; d++) {
        if (!maze.hasWall(i, d)) continue;
        const neighbors = maze.neighborsAll(i);
        const nb = neighbors.find(n => n.dir === d);
        if (nb && nb.j < i) continue; // neighbor will draw (or did)
        const e = hexEdge(x, y, hexSize, d);
        this.rc.line(e.a.x, e.a.y, e.b.x, e.b.y, opts);
      }
    }
    this._drawStartGoalMarkers();
  }

  _drawStartGoalMarkers() {
    const ctx = this.wallsCtx;
    const { hexSize, originX, originY } = this.layout;
    const drawMark = (idx, kind) => {
      if (idx < 0 || idx == null) return;
      const c = this.maze.cells[idx];
      const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = COLORS.ironGall;
      ctx.fillStyle = COLORS.ironGall;
      ctx.lineWidth = 1.2;
      if (kind === 'start') {
        // small compass mark: filled dot + 4 short rays
        ctx.beginPath();
        ctx.arc(0, 0, hexSize * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        const r = hexSize * 0.42;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          ctx.moveTo(Math.cos(a) * hexSize * 0.26, Math.sin(a) * hexSize * 0.26);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
      } else {
        // goal: hand-drawn × with a circle around
        ctx.fillStyle = COLORS.vermillion;
        ctx.strokeStyle = COLORS.vermillion;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        const r = hexSize * 0.4;
        ctx.moveTo(-r, -r); ctx.lineTo(r, r);
        ctx.moveTo(-r, r);  ctx.lineTo(r, -r);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, hexSize * 0.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      ctx.restore();
    };
    drawMark(this.maze.start, 'start');
    drawMark(this.maze.goal, 'goal');
  }

  applyStep(step) {
    switch (step.type) {
      case 'visit':
        this.state.visited.add(step.hex);
        this.state.frontier.delete(step.hex);
        this.state.current = step.hex;
        break;
      case 'frontier-add':
        if (!this.state.visited.has(step.hex)) this.state.frontier.add(step.hex);
        break;
      case 'frontier-pop':
        this.state.frontier.delete(step.hex);
        break;
      case 'done':
        this.state.path = step.path;
        this.state.finished = true;
        this.state.current = -1;
        break;
    }
  }

  // Paint the state canvas. Called every animation frame.
  paint() {
    const ctx = this.stateCtx;
    const cssW = this.stateCanvas.width / this.dpr;
    const cssH = this.stateCanvas.height / this.dpr;
    ctx.clearRect(0, 0, cssW, cssH);

    const { hexSize, originX, originY } = this.layout;
    const color = this.meta.color;

    // 1. Visited fill (per-algo pattern)
    if (this.state.visited.size > 0) {
      this._paintVisited(ctx, color);
    }

    // 2. Frontier outlines (subtle inner ring)
    if (this.state.frontier.size > 0) {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = withAlpha(color, 0.55);
      this.state.frontier.forEach(i => {
        const c = this.maze.cells[i];
        const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
        const v = hexVertices(x, y, hexSize * 0.7);
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (let k = 1; k < 6; k++) ctx.lineTo(v[k].x, v[k].y);
        ctx.closePath();
        ctx.stroke();
      });
    }

    // 3. Current "head" hex — small pulsing fill
    if (this.state.current >= 0) {
      const c = this.maze.cells[this.state.current];
      const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
      ctx.fillStyle = withAlpha(color, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, hexSize * 0.28, 0, Math.PI * 2);
      ctx.fill();
      // Quill halo
      ctx.strokeStyle = withAlpha(color, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, hexSize * 0.48, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Solution path
    if (this.state.path && this.state.pathFraction > 0) {
      this._paintPath(ctx);
    }
  }

  _paintVisited(ctx, color) {
    const { hexSize, originX, originY } = this.layout;
    const pattern = this.meta.pattern;
    // Soft full-hex wash first (very low opacity) so the trail is legible.
    ctx.fillStyle = withAlpha(color, 0.08);
    this.state.visited.forEach(i => {
      const c = this.maze.cells[i];
      const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
      const v = hexVertices(x, y, hexSize * 0.92);
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      for (let k = 1; k < 6; k++) ctx.lineTo(v[k].x, v[k].y);
      ctx.closePath();
      ctx.fill();
    });

    if (pattern === 'solid') {
      // A*: stronger solid wash over wash
      ctx.fillStyle = withAlpha(color, 0.22);
      this.state.visited.forEach(i => {
        const c = this.maze.cells[i];
        const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
        const v = hexVertices(x, y, hexSize * 0.78);
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        for (let k = 1; k < 6; k++) ctx.lineTo(v[k].x, v[k].y);
        ctx.closePath();
        ctx.fill();
      });
    } else if (pattern === 'stipple') {
      // BFS: dotted stipple within hex
      ctx.fillStyle = withAlpha(color, 0.7);
      this.state.visited.forEach(i => {
        const c = this.maze.cells[i];
        const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
        // 5 deterministic dots
        const dots = [
          [0.0, 0.0], [0.35, -0.15], [-0.3, 0.18],
          [0.18, 0.32], [-0.22, -0.3],
        ];
        for (const [dx, dy] of dots) {
          ctx.beginPath();
          ctx.arc(x + dx * hexSize, y + dy * hexSize, hexSize * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    } else if (pattern === 'hatch') {
      // DFS: diagonal hatch lines
      ctx.strokeStyle = withAlpha(color, 0.5);
      ctx.lineWidth = 1.2;
      this.state.visited.forEach(i => {
        const c = this.maze.cells[i];
        const { x, y } = axialToPixel(c.q, c.r, hexSize, originX, originY);
        const s = hexSize * 0.72;
        ctx.beginPath();
        // three diagonal strokes inside hex bbox
        for (const off of [-s * 0.5, 0, s * 0.5]) {
          ctx.moveTo(x - s * 0.5, y + off + s * 0.4);
          ctx.lineTo(x + s * 0.5, y + off - s * 0.4);
        }
        ctx.stroke();
      });
    }
  }

  _paintPath(ctx) {
    const path = this.state.path;
    if (!path || path.length < 2) return;
    const { hexSize, originX, originY } = this.layout;
    const frac = Math.max(0, Math.min(1, this.state.pathFraction));
    const totalSegments = path.length - 1;
    const segsToDraw = totalSegments * frac;
    const fullSegs = Math.floor(segsToDraw);
    const partial = segsToDraw - fullSegs;

    const pts = path.map(i => {
      const c = this.maze.cells[i];
      return axialToPixel(c.q, c.r, hexSize, originX, originY);
    });

    const drawPolyline = (lw, style) => {
      ctx.lineWidth = lw;
      ctx.strokeStyle = style;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= fullSegs && i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (fullSegs < totalSegments && partial > 0) {
        const a = pts[fullSegs], b = pts[fullSegs + 1];
        ctx.lineTo(a.x + (b.x - a.x) * partial, a.y + (b.y - a.y) * partial);
      }
      ctx.stroke();
    };

    // Gold-leaf glow (shared "treasure" underlay)
    drawPolyline(10, withAlpha(COLORS.goldLeaf, 0.32));
    drawPolyline(6,  withAlpha(COLORS.goldLeaf, 0.55));
    // Top stroke in the algorithm's ink — preserves panel identity at completion
    drawPolyline(3, this.meta.color);
  }
}

function withAlpha(hex, alpha) {
  // hex: "#rrggbb"
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
