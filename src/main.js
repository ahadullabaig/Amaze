import { HexMaze } from './maze.js';
import { generateMazeInstantly, pickStartAndGoal } from './generator.js';
import { mulberry32, randomSeed, seedToFolio } from './rng.js';
import { PanelRenderer } from './renderer.js';
import { Orchestrator } from './orchestrator.js';
import { unfoldTriptych, foldTriptychBack } from './triptych.js';
import { paintParchment, installMarginalia, stampWaxSeal, hideWaxSeal } from './marginalia.js';
import { ALGOS_ORDER, ALGO_META, COLORS } from './palette.js';

// ──────────────── Boot ────────────────

const parchment = document.getElementById('parchment-bg');
const marginaliaEl = document.getElementById('marginalia');
const stage = document.getElementById('stage');
const ribbon = document.getElementById('ribbon');
const seedDisplay = document.getElementById('seed-display');

const dialSize  = document.getElementById('dial-size');
const dialSpeed = document.getElementById('dial-speed');
const dialSizeVal  = document.getElementById('dial-size-val');
const dialSpeedVal = document.getElementById('dial-speed-val');

const btnGenerate  = document.getElementById('btn-generate');
const btnSolve     = document.getElementById('btn-solve');
const btnPause     = document.getElementById('btn-pause');
const btnStep      = document.getElementById('btn-step');
const btnReset     = document.getElementById('btn-reset');
const btnRegen     = document.getElementById('btn-regenerate');
const btnExport    = document.getElementById('btn-export');

const panels = {
  left:   document.querySelector('.panel-left'),
  center: document.querySelector('.panel-center'),
  right:  document.querySelector('.panel-right'),
};
const algoPanels = {
  bfs:   panels.left,
  astar: panels.center,
  dfs:   panels.right,
};

const renderers = new Map();
for (const algo of ALGOS_ORDER) {
  renderers.set(algo, new PanelRenderer(algoPanels[algo], algo));
}

const orchestrator = new Orchestrator(renderers, ribbon);

let currentSeed = randomSeed();
let currentMaze = null;
let mode = 'idle'; // idle | generated | solving | finished

// ──────────────── Sizing ────────────────

function computePanelSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vertical = window.matchMedia('(max-width: 1100px)').matches;

  // Reserve space for cartouche (top), dock + legend (bottom), border.
  const reservedV = 280;
  const reservedH = 160;

  if (vertical) {
    // single column: each panel is wider but shorter
    const w = Math.min(vw - reservedH, 560);
    const h = Math.min((vh - reservedV) / 1.2, 380);
    return { single: { w: Math.round(w), h: Math.round(h) },
             triptych: { w: Math.round(w), h: Math.round(h) } };
  }
  // horizontal triptych
  const availW = vw - reservedH;
  const triW = Math.max(280, Math.min(460, Math.floor((availW - 80) / 3)));
  const triH = Math.max(240, Math.min(420, Math.floor(triW * 0.78)));
  // single mode: a bigger maze
  const singleW = Math.min(720, availW - 40);
  const singleH = Math.min(520, vh - reservedV);
  return {
    single:   { w: Math.round(singleW), h: Math.round(singleH) },
    triptych: { w: Math.round(triW),   h: Math.round(triH) },
  };
}

function resizeAllPanels() {
  const sizes = computePanelSize();
  const inTriptych = stage.dataset.mode === 'triptych';
  for (const [algo, panel] of Object.entries(algoPanels)) {
    const isCenter = panel.classList.contains('panel-center');
    const sz = (inTriptych || !isCenter) ? sizes.triptych : sizes.single;
    renderers.get(algo).resize(sz.w, sz.h);
  }
}

// ──────────────── Maze lifecycle ────────────────

function buildMaze() {
  const order = parseInt(dialSize.value, 10);
  const cols = order;
  const rows = order;
  const maze = HexMaze.fromRect(cols, rows);
  maze.seed = currentSeed;
  const rng = mulberry32(currentSeed);
  generateMazeInstantly(maze, rng);
  pickStartAndGoal(maze);
  return { maze, cols, rows };
}

function showEmptyHint() {
  resizeAllPanels();
  // Only show grid hint on center panel in idle mode.
  const r = renderers.get('astar');
  r.clearAll();
  // Build a phantom maze just for grid hint footprint
  const order = parseInt(dialSize.value, 10);
  const ghost = HexMaze.fromRect(order, order);
  r.setMaze(ghost, order, order);
  r.drawEmptyGrid();
  // clear other renderers
  for (const algo of ['bfs', 'dfs']) renderers.get(algo).clearAll();
}

function generateAndDraw() {
  hideWaxSeal();
  ribbon.hidden = true;
  ribbon.querySelector('#ribbon-grid').innerHTML = '';
  resetStatPlates();
  resizeAllPanels();

  const { maze, cols, rows } = buildMaze();
  currentMaze = maze;
  seedDisplay.textContent = seedToFolio(currentSeed);

  // In idle/generated, we draw only the center panel.
  // Other panels keep blank until triptych unfolds.
  for (const algo of ALGOS_ORDER) {
    const r = renderers.get(algo);
    r.clearAll();
    r.setMaze(maze, cols, rows);
  }
  renderers.get('astar').drawWalls(currentSeed);
  mode = 'generated';
  setButtonStates();
  // wax seal stamps on
  requestAnimationFrame(() => stampWaxSeal());
}

function resetStatPlates() {
  document.querySelectorAll('.plate-stats .stat-val').forEach((el, idx) => {
    el.textContent = el.dataset.stat === 'visited' ? '0' : '—';
  });
}

// ──────────────── Solve ────────────────

async function startSolve() {
  if (!currentMaze) return;
  resetStatPlates();
  orchestrator.setMaze(currentMaze);
  orchestrator.setStepsPerSecond(parseInt(dialSpeed.value, 10));

  // Unfold the triptych, pre-rendering side panel walls.
  const prepareSidePanels = () => {
    // Now that the side panels are display:flex, resize their canvases.
    resizeAllPanels();
    // ensure they all use the maze and draw walls with shared seed
    const order = parseInt(dialSize.value, 10);
    for (const algo of ['bfs', 'dfs']) {
      const r = renderers.get(algo);
      r.setMaze(currentMaze, order, order);
      r.drawWalls(currentSeed);
    }
    // also re-render center walls at any new size
    const cR = renderers.get('astar');
    cR.setMaze(currentMaze, order, order);
    cR.drawWalls(currentSeed);
  };

  await unfoldTriptych(stage, panels, prepareSidePanels);

  mode = 'solving';
  setButtonStates();
  orchestrator.start(onSolveComplete);
}

function onSolveComplete() {
  mode = 'finished';
  setButtonStates();
}

async function reset() {
  orchestrator.stop();
  if (stage.dataset.mode === 'triptych') {
    await foldTriptychBack(stage, panels);
  }
  for (const r of renderers.values()) {
    r.state = { visited: new Set(), frontier: new Set(), current: -1, path: null, pathFraction: 0, finished: false };
    r.paint();
  }
  resetStatPlates();
  ribbon.hidden = true;
  if (currentMaze) {
    // redraw the center maze (single-mode view of the existing maze)
    resizeAllPanels();
    const order = parseInt(dialSize.value, 10);
    const center = renderers.get('astar');
    center.setMaze(currentMaze, order, order);
    center.drawWalls(currentSeed);
    mode = 'generated';
  } else {
    mode = 'idle';
    showEmptyHint();
  }
  setButtonStates();
}

async function regenerate() {
  orchestrator.stop();
  if (stage.dataset.mode === 'triptych') {
    await foldTriptychBack(stage, panels);
  }
  currentSeed = randomSeed();
  generateAndDraw();
}

// ──────────────── Buttons / state ────────────────

function setButtonStates() {
  btnGenerate.disabled = mode === 'solving';
  btnSolve.disabled    = !(mode === 'generated');
  btnPause.disabled    = mode !== 'solving';
  btnStep.disabled     = mode !== 'solving';
  btnReset.disabled    = mode !== 'solving' && mode !== 'finished';
  btnExport.disabled   = mode !== 'finished';
  btnRegen.disabled    = mode === 'solving';
  btnPause.textContent = orchestrator.paused ? 'Resume' : 'Pause';
}

// ──────────────── Export PNG ────────────────

function exportFolio() {
  // Compose three panel canvases (walls + state) into one image with a title.
  const pad = 32;
  const titleH = 70;
  const gap = 18;
  const panelW = renderers.get('bfs').wallsCanvas.width / renderers.get('bfs').dpr;
  const panelH = renderers.get('bfs').wallsCanvas.height / renderers.get('bfs').dpr;
  const totalW = pad * 2 + panelW * 3 + gap * 2;
  const totalH = pad * 2 + titleH + panelH + 24;

  const out = document.createElement('canvas');
  const dpr = 2;
  out.width = Math.round(totalW * dpr);
  out.height = Math.round(totalH * dpr);
  const ctx = out.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Parchment-ish background
  const g = ctx.createLinearGradient(0, 0, 0, totalH);
  g.addColorStop(0, '#f1e6cd');
  g.addColorStop(1, '#dccaa1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, totalW, totalH);

  // Title
  ctx.fillStyle = COLORS.ironGall;
  ctx.font = '32px "IM Fell English", serif';
  ctx.textAlign = 'center';
  ctx.fillText('Labyrinthus Hexagonalis', totalW / 2, 44);
  ctx.font = 'italic 14px "IM Fell English", serif';
  ctx.fillStyle = COLORS.sepia;
  ctx.fillText(`Folio Seed · ${seedToFolio(currentSeed)}`, totalW / 2, 64);

  // Panels
  const order = ['bfs', 'astar', 'dfs'];
  order.forEach((algo, i) => {
    const x = pad + i * (panelW + gap);
    const y = pad + titleH;
    const r = renderers.get(algo);
    ctx.drawImage(r.wallsCanvas, x, y, panelW, panelH);
    ctx.drawImage(r.stateCanvas, x, y, panelW, panelH);
    ctx.strokeStyle = COLORS.sepia;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, panelW, panelH);
    // plate label
    ctx.fillStyle = COLORS.ironGall;
    ctx.font = '11px "IM Fell English SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(ALGO_META[algo].name.toUpperCase(), x + panelW / 2, y + panelH + 18);
  });

  const link = document.createElement('a');
  link.download = `folio-${seedToFolio(currentSeed).replace('·', '-')}.png`;
  link.href = out.toDataURL('image/png');
  link.click();
}

// ──────────────── Wiring ────────────────

function init() {
  paintParchment(parchment);
  installMarginalia(marginaliaEl);
  showEmptyHint();
  setButtonStates();

  btnGenerate.addEventListener('click', () => generateAndDraw());
  btnSolve.addEventListener('click', () => startSolve());
  btnPause.addEventListener('click', () => {
    orchestrator.togglePause();
    setButtonStates();
  });
  btnStep.addEventListener('click', () => orchestrator.step());
  btnReset.addEventListener('click', () => reset());
  btnRegen.addEventListener('click', () => regenerate());
  btnExport.addEventListener('click', () => exportFolio());

  dialSize.addEventListener('input', () => {
    dialSizeVal.textContent = dialSize.value;
    // Update grid hint live in idle mode.
    if (mode === 'idle') showEmptyHint();
  });
  dialSpeed.addEventListener('input', () => {
    dialSpeedVal.textContent = `${dialSpeed.value}/s`;
    orchestrator.setStepsPerSecond(parseInt(dialSpeed.value, 10));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (mode === 'generated') startSolve();
      else if (mode === 'solving') { orchestrator.togglePause(); setButtonStates(); }
    } else if (e.code === 'KeyR' && !btnRegen.disabled) {
      regenerate();
    } else if (e.code === 'KeyS' && mode === 'solving') {
      orchestrator.step();
    } else if (e.code === 'Escape' && !btnReset.disabled) {
      reset();
    } else if (e.code === 'KeyE' && !btnExport.disabled) {
      exportFolio();
    } else if (e.code === 'KeyG' && !btnGenerate.disabled) {
      generateAndDraw();
    }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      paintParchment(parchment);
      resizeAllPanels();
      if (mode === 'idle') showEmptyHint();
      else if (currentMaze) {
        const order = parseInt(dialSize.value, 10);
        const algos = stage.dataset.mode === 'triptych' ? ALGOS_ORDER : ['astar'];
        for (const algo of algos) {
          const r = renderers.get(algo);
          r.setMaze(currentMaze, order, order);
          r.drawWalls(currentSeed);
        }
      }
    }, 150);
  });
}

document.addEventListener('DOMContentLoaded', init);
