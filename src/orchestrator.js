import { bfsSolver }   from './solvers/bfs.js';
import { astarSolver } from './solvers/astar.js';
import { dfsSolver }   from './solvers/dfs.js';
import { ALGO_META, ALGOS_ORDER } from './palette.js';

const SOLVER_FACTORY = {
  bfs: bfsSolver,
  astar: astarSolver,
  dfs: dfsSolver,
};

const PATH_DRAW_MS = 900;
const MAX_STEPS_PER_FRAME = 6;

export class Orchestrator {
  constructor(renderers, ribbonEl) {
    this.renderers = renderers; // Map<algo, PanelRenderer>
    this.ribbonEl = ribbonEl;
    this.maze = null;
    this.stepsPerSecond = 40;
    this.paused = false;
    this.running = false;
    this.lastTime = 0;
    this.rafId = null;
    this.onComplete = null;

    this.runners = new Map(); // algo -> {gen, acc, done, finishedAt, stats}
  }

  setMaze(maze) {
    this.maze = maze;
  }

  setStepsPerSecond(sps) {
    this.stepsPerSecond = Math.max(1, sps);
  }

  start(onComplete) {
    if (!this.maze) return;
    this.onComplete = onComplete;
    this.paused = false;
    this.running = true;
    this.runners.clear();
    for (const algo of ALGOS_ORDER) {
      const gen = SOLVER_FACTORY[algo](this.maze);
      this.runners.set(algo, {
        gen,
        acc: 0,
        done: false,
        finishedAt: 0,
        startedAt: performance.now(),
        stats: { visited: 0, pathLength: null, timeMs: null, optimal: ALGO_META[algo].optimal },
        pathDrawStart: 0,
      });
    }
    this.lastTime = performance.now();
    this._loop();
  }

  pause()  { this.paused = true; }
  resume() { this.paused = false; this.lastTime = performance.now(); }
  togglePause() {
    if (this.paused) this.resume(); else this.pause();
  }

  // Single step: advance each unfinished solver by exactly one event.
  step() {
    if (!this.running) return;
    for (const [algo, r] of this.runners) {
      if (r.done) continue;
      this._advanceOne(algo, r);
    }
    this._paintAll();
    this._checkAllFinished();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reset() {
    this.stop();
    for (const r of this.renderers.values()) {
      // re-clear state canvas but keep walls
      r.state = {
        visited: new Set(), frontier: new Set(),
        current: -1, path: null, pathFraction: 0, finished: false,
      };
      r.paint();
    }
    this.ribbonEl.hidden = true;
    this.ribbonEl.querySelector('#ribbon-grid').innerHTML = '';
  }

  _loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dtMs = Math.min(now - this.lastTime, 80); // clamp huge gaps
    this.lastTime = now;

    if (!this.paused) {
      const stepIntervalMs = 1000 / this.stepsPerSecond;
      for (const [algo, r] of this.runners) {
        if (r.done) {
          // animate path draw
          if (r.pathDrawStart > 0 && r.stats.pathLength != null) {
            const t = (now - r.pathDrawStart) / PATH_DRAW_MS;
            this.renderers.get(algo).state.pathFraction = Math.min(1, t);
          }
          continue;
        }
        r.acc += dtMs;
        let stepsThisFrame = 0;
        while (r.acc >= stepIntervalMs && stepsThisFrame < MAX_STEPS_PER_FRAME && !r.done) {
          this._advanceOne(algo, r);
          r.acc -= stepIntervalMs;
          stepsThisFrame++;
        }
      }
    }

    this._paintAll();
    this._checkAllFinished();
    if (this.running) this.rafId = requestAnimationFrame(this._loop);
  };

  _advanceOne(algo, r) {
    const { value: step, done } = r.gen.next();
    if (done) {
      r.done = true;
      r.finishedAt = performance.now();
      r.stats.timeMs = r.finishedAt - r.startedAt;
      return;
    }
    const rend = this.renderers.get(algo);
    rend.applyStep(step);

    if (step.type === 'visit') {
      r.stats.visited++;
      this._updateStatDOM(algo, 'visited', String(r.stats.visited));
    } else if (step.type === 'done') {
      r.done = true;
      r.finishedAt = performance.now();
      r.stats.timeMs = r.finishedAt - r.startedAt;
      r.stats.pathLength = step.path ? step.path.length - 1 : null;
      r.pathDrawStart = performance.now();
      this._updateStatDOM(algo, 'path', step.path ? String(step.path.length - 1) : '∅');
      this._updateStatDOM(algo, 'time', `${Math.round(r.stats.timeMs)}ms`);
    }
  }

  _paintAll() {
    for (const r of this.renderers.values()) r.paint();
  }

  _checkAllFinished() {
    let allDone = true;
    for (const r of this.runners.values()) {
      if (!r.done) { allDone = false; break; }
      if (r.stats.pathLength != null) {
        const rend = this.renderers.get(this._algoForRunner(r));
        if (rend && rend.state.pathFraction < 1) { allDone = false; break; }
      }
    }
    if (allDone && this.running) {
      this.running = false;
      this._populateRibbon();
      if (this.onComplete) this.onComplete();
    }
  }

  _algoForRunner(r) {
    for (const [algo, runner] of this.runners) if (runner === r) return algo;
    return null;
  }

  _updateStatDOM(algo, statKey, text) {
    const panel = this.renderers.get(algo).panelEl;
    const el = panel.querySelector(`[data-stat="${statKey}"]`);
    if (el) el.textContent = text;
  }

  _populateRibbon() {
    const grid = this.ribbonEl.querySelector('#ribbon-grid');
    grid.innerHTML = '';

    const stats = ALGOS_ORDER.map(algo => ({ algo, ...this.runners.get(algo).stats }));
    const maxVisited = Math.max(...stats.map(s => s.visited || 0), 1);
    const maxTime    = Math.max(...stats.map(s => s.timeMs || 0), 1);
    // For path: use the longest path as the bar reference (longer = larger bar);
    // optimal path is shortest, so its bar will be small — that's the desired "good" look.
    const maxPath    = Math.max(...stats.map(s => s.pathLength || 0), 1);
    const minPath    = Math.min(...stats.filter(s => s.pathLength != null).map(s => s.pathLength), Infinity);

    for (const s of stats) {
      const meta = ALGO_META[s.algo];
      const row = document.createElement('div');
      row.className = 'ribbon-row';
      row.dataset.algo = s.algo;

      const pathTxt   = s.pathLength == null ? '∅' : String(s.pathLength);
      const timeTxt   = s.timeMs == null ? '—' : `${Math.round(s.timeMs)}ms`;
      const visitedW  = (s.visited / maxVisited) * 100;
      const timeW     = (s.timeMs  / maxTime) * 100;
      const pathW     = s.pathLength ? (s.pathLength / maxPath) * 100 : 0;

      const winnerMark =
        (s.pathLength != null && s.pathLength === minPath)
          ? '<span class="winner-mark">— Shortest Route</span>' : '';

      row.innerHTML = `
        <div class="ribbon-name">
          <span class="roman">${meta.roman}</span>
          <span>${meta.name}</span>
        </div>
        <div class="ribbon-metrics">
          <div class="ribbon-metric">
            <div class="ribbon-metric-head">
              <span class="ribbon-metric-label">Cells Visited</span>
              <span class="ribbon-metric-val">${s.visited}</span>
            </div>
            <div class="ribbon-bar"><div class="ribbon-bar-fill" data-w="${visitedW}"></div></div>
          </div>
          <div class="ribbon-metric">
            <div class="ribbon-metric-head">
              <span class="ribbon-metric-label">Path Length</span>
              <span class="ribbon-metric-val">${pathTxt}</span>
            </div>
            <div class="ribbon-bar"><div class="ribbon-bar-fill" data-w="${pathW}"></div></div>
          </div>
          <div class="ribbon-metric">
            <div class="ribbon-metric-head">
              <span class="ribbon-metric-label">Time</span>
              <span class="ribbon-metric-val">${timeTxt}</span>
            </div>
            <div class="ribbon-bar"><div class="ribbon-bar-fill" data-w="${timeW}"></div></div>
          </div>
        </div>
        <div class="optimality" data-opt="${meta.optimal ? 'yes' : 'no'}">
          ${meta.optimal ? '✓ optimal' : 'heuristic'}
          ${winnerMark}
        </div>
      `;
      grid.appendChild(row);
    }

    this.ribbonEl.hidden = false;
    // Trigger bar fill transition
    requestAnimationFrame(() => {
      grid.querySelectorAll('.ribbon-bar-fill').forEach(el => {
        el.style.width = `${el.dataset.w}%`;
      });
    });
  }
}
