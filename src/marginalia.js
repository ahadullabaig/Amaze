import { COLORS } from './palette.js';
import { mulberry32 } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────────
// Parchment background — procedural texture painted to a fixed canvas.
// Layers: base fill → paper fiber noise → tea-stain blotches → corner vignette
// ─────────────────────────────────────────────────────────────────────────────

export function paintParchment(canvas) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Base parchment with a warm tonal gradient (top slightly lighter).
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f1e6cd');
  grad.addColorStop(0.55, COLORS.parchment);
  grad.addColorStop(1, '#e1d2af');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Paper fiber noise — many translucent specks.
  const rng = mulberry32(0xC4A77098);
  ctx.globalAlpha = 1;
  const speckCount = Math.round((w * h) / 1600);
  for (let i = 0; i < speckCount; i++) {
    const x = rng() * w, y = rng() * h;
    const a = 0.04 + rng() * 0.08;
    const tone = rng();
    ctx.fillStyle =
      tone < 0.5  ? `rgba(108, 78, 38, ${a})` :
      tone < 0.85 ? `rgba(80, 50, 20, ${a * 0.8})` :
                    `rgba(255, 250, 230, ${a * 0.9})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Larger soft "tea stains" — 6-10 elliptical blotches at random spots.
  const stainCount = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < stainCount; i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const rx = 100 + rng() * 240;
    const ry = 80  + rng() * 200;
    const ang = rng() * Math.PI;
    const tone = `rgba(110, 70, 30, ${0.04 + rng() * 0.05})`;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    g.addColorStop(0, tone);
    g.addColorStop(0.7, tone.replace(/[\d.]+\)$/, '0.018)'));
    g.addColorStop(1, 'rgba(110, 70, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A few darker age-spot dots scattered sparingly.
  for (let i = 0; i < 28; i++) {
    const x = rng() * w, y = rng() * h;
    const r = 1 + rng() * 2.5;
    ctx.fillStyle = `rgba(80, 50, 20, ${0.12 + rng() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corner vignette — radial darkening toward edges.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(80, 50, 20, 0)');
  vg.addColorStop(1, 'rgba(40, 22, 8, 0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Subtle fold crease — soft vertical line down the center.
  const fold = ctx.createLinearGradient(w / 2 - 40, 0, w / 2 + 40, 0);
  fold.addColorStop(0,   'rgba(80, 50, 20, 0)');
  fold.addColorStop(0.5, 'rgba(80, 50, 20, 0.04)');
  fold.addColorStop(1,   'rgba(80, 50, 20, 0)');
  ctx.fillStyle = fold;
  ctx.fillRect(w / 2 - 40, 0, 80, h);
}

// ─────────────────────────────────────────────────────────────────────────────
// Marginalia: border, compass rose, scale bar, sea monster, sextant, wax seal.
// Composed as a single inline SVG covering the viewport.
// ─────────────────────────────────────────────────────────────────────────────

export function installMarginalia(host) {
  host.innerHTML = svgMarginalia();
}

function svgMarginalia() {
  return /* html */`
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
         style="position:fixed; inset:0; width:100vw; height:100vh; pointer-events:none;">
      <!-- Double-rule border (uses non-uniform scaling intentionally) -->
      <rect x="1.2" y="1.2" width="97.6" height="97.6"
            fill="none" stroke="${COLORS.sepia}" stroke-width="0.12" vector-effect="non-scaling-stroke" />
      <rect x="1.8" y="1.8" width="96.4" height="96.4"
            fill="none" stroke="${COLORS.sepia}" stroke-width="0.06" stroke-dasharray="0.4 0.3"
            vector-effect="non-scaling-stroke" opacity="0.8" />
    </svg>

    <svg style="position:fixed; top:18px; left:18px; pointer-events:none;"
         width="58" height="58" viewBox="0 0 100 100">
      ${cornerFlourish('tl')}
    </svg>
    <svg style="position:fixed; top:18px; right:18px; pointer-events:none;"
         width="58" height="58" viewBox="0 0 100 100">
      ${cornerFlourish('tr')}
    </svg>
    <svg style="position:fixed; bottom:18px; left:18px; pointer-events:none;"
         width="58" height="58" viewBox="0 0 100 100">
      ${cornerFlourish('bl')}
    </svg>
    <svg style="position:fixed; bottom:18px; right:18px; pointer-events:none;"
         width="58" height="58" viewBox="0 0 100 100">
      ${cornerFlourish('br')}
    </svg>

    ${compassRose()}
    ${sextant()}
    ${seaMonster()}
    ${scaleBar()}
    ${waxSeal()}
  `;
}

function cornerFlourish(corner) {
  // Hand-drawn-looking scroll: a quarter-circle plus little leaves.
  // Rotated/reflected via SVG transforms per corner.
  const rot = {
    tl: 'rotate(0 50 50)',
    tr: 'rotate(90 50 50)',
    br: 'rotate(180 50 50)',
    bl: 'rotate(270 50 50)',
  }[corner];
  return `
    <g transform="${rot}" stroke="${COLORS.sepia}" stroke-width="1.2" fill="none" stroke-linecap="round">
      <path d="M10,10 C 10,32 22,52 50,50" />
      <path d="M14,12 C 12,18 14,24 22,24" opacity="0.7" />
      <circle cx="50" cy="50" r="2" fill="${COLORS.sepia}" />
      <!-- tiny leaf -->
      <path d="M28,14 q 4 -4 10 -2 q -2 6 -10 2 Z" fill="${COLORS.sepia}" opacity="0.6" />
      <path d="M14,28 q -4 4 -2 10 q 6 -2 2 -10 Z" fill="${COLORS.sepia}" opacity="0.6" />
    </g>
  `;
}

function compassRose() {
  // Top-right area, beneath the corner flourish.
  return `
    <svg style="position:fixed; top:90px; right:54px; pointer-events:none;
                animation: compassSway 9s ease-in-out infinite alternate;"
         width="120" height="120" viewBox="-50 -50 100 100">
      <defs>
        <radialGradient id="cgrad" cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0"   stop-color="${COLORS.parchmentLight}" stop-opacity="0.85" />
          <stop offset="0.7" stop-color="${COLORS.parchment}" stop-opacity="0.3" />
          <stop offset="1"   stop-color="${COLORS.parchment}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle r="46" fill="url(#cgrad)" />
      <circle r="44" fill="none" stroke="${COLORS.sepia}" stroke-width="0.6" />
      <circle r="40" fill="none" stroke="${COLORS.sepia}" stroke-width="0.4" stroke-dasharray="1 2.2" />

      <!-- 8-pointed star: cardinal (long) + intercardinal (short) -->
      <g stroke="${COLORS.ironGall}" stroke-width="0.7" stroke-linejoin="miter">
        <!-- N -->
        <polygon points="0,-40 5,-6 0,0 -5,-6" fill="${COLORS.ironGall}" />
        <!-- S -->
        <polygon points="0,40 -5,6 0,0 5,6" fill="${COLORS.parchmentLight}" />
        <!-- E -->
        <polygon points="40,0 6,-5 0,0 6,5" fill="${COLORS.ironGall}" />
        <!-- W -->
        <polygon points="-40,0 -6,5 0,0 -6,-5" fill="${COLORS.parchmentLight}" />
        <!-- NE -->
        <polygon points="22,-22 6,-3 0,0 3,-6" fill="${COLORS.sepia}" opacity="0.85" />
        <!-- SE -->
        <polygon points="22,22 3,6 0,0 6,3" fill="${COLORS.parchmentLight}" />
        <!-- SW -->
        <polygon points="-22,22 -6,3 0,0 -3,6" fill="${COLORS.sepia}" opacity="0.85" />
        <!-- NW -->
        <polygon points="-22,-22 -3,-6 0,0 -6,-3" fill="${COLORS.parchmentLight}" />
      </g>
      <circle r="3" fill="${COLORS.goldLeaf}" stroke="${COLORS.ironGall}" stroke-width="0.5" />

      <g font-family="'IM Fell English SC', serif" font-size="6" fill="${COLORS.ironGall}" text-anchor="middle" letter-spacing="1">
        <text x="0" y="-45">N</text>
        <text x="0" y="49">S</text>
        <text x="46" y="2">E</text>
        <text x="-46" y="2">W</text>
      </g>
    </svg>
    <style>
      @keyframes compassSway {
        0%   { transform: rotate(-1.2deg); }
        100% { transform: rotate(1.2deg); }
      }
      @keyframes sealStamp {
        0%   { transform: scale(2.6) rotate(-12deg); opacity: 0; }
        45%  { transform: scale(0.84) rotate(2deg);  opacity: 1; }
        70%  { transform: scale(1.08) rotate(-1deg); opacity: 1; }
        100% { transform: scale(1) rotate(0);        opacity: 1; }
      }
    </style>
  `;
}

function sextant() {
  // Top-left — a small drafting instrument sketch.
  return `
    <svg style="position:fixed; top:96px; left:54px; pointer-events:none; opacity:0.8;"
         width="90" height="90" viewBox="0 0 100 100">
      <g stroke="${COLORS.sepia}" stroke-width="1" fill="none" stroke-linecap="round">
        <path d="M12,82 L 88,82 L 50,18 Z" />
        <path d="M22,70 A 36 36 0 0 1 78 70" />
        <!-- tick marks on arc -->
        <g stroke-width="0.6" opacity="0.8">
          <line x1="22" y1="70" x2="20" y2="74"/>
          <line x1="30" y1="58" x2="27" y2="60"/>
          <line x1="42" y1="50" x2="40" y2="53"/>
          <line x1="58" y1="50" x2="60" y2="53"/>
          <line x1="70" y1="58" x2="73" y2="60"/>
          <line x1="78" y1="70" x2="80" y2="74"/>
        </g>
        <line x1="50" y1="18" x2="50" y2="82" stroke-dasharray="2 2" opacity="0.6" />
        <circle cx="50" cy="18" r="2" fill="${COLORS.sepia}" />
      </g>
      <text x="50" y="94" font-family="'IM Fell English', serif" font-style="italic"
            font-size="8" fill="${COLORS.sepia}" text-anchor="middle">sextans</text>
    </svg>
  `;
}

function seaMonster() {
  // Left middle/lower — small whimsical serpent with Latin marginalia.
  return `
    <svg style="position:fixed; left:34px; bottom:36%; pointer-events:none; opacity:0.78;"
         width="160" height="80" viewBox="0 0 160 80">
      <g stroke="${COLORS.ironGall}" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- water suggestion -->
        <path d="M2,66 q 8 -4 16 0 q 8 4 16 0 q 8 -4 16 0 q 8 4 16 0 q 8 -4 16 0 q 8 4 16 0 q 8 -4 16 0 q 8 4 16 0"
              stroke="${COLORS.sepia}" opacity="0.5" stroke-width="0.8" />
        <!-- serpent body humps -->
        <path d="M14,58 q 14 -22 28 0 q 14 22 28 0 q 14 -22 28 0" stroke="${COLORS.ironGall}" stroke-width="1.4" />
        <!-- head -->
        <path d="M98,58 q 10 -2 14 -10 q -4 -2 -6 -6 q 4 0 8 2 q 4 -4 12 -2 q 4 4 0 8 q -4 4 -10 4 q -4 6 -10 8 z"
              fill="${COLORS.ironGall}" />
        <!-- eye -->
        <circle cx="118" cy="46" r="0.9" fill="${COLORS.parchmentLight}" />
        <!-- tail flick -->
        <path d="M14,58 q -8 -2 -10 -10 q 4 -2 8 4" />
      </g>
      <text x="80" y="78" font-family="'IM Fell English', serif" font-style="italic"
            font-size="9" fill="${COLORS.sepia}" text-anchor="middle">
        — Hic sunt dracones —
      </text>
    </svg>
  `;
}

function scaleBar() {
  return `
    <svg style="position:fixed; left:34px; bottom:80px; pointer-events:none;"
         width="220" height="40" viewBox="0 0 220 40">
      <g stroke="${COLORS.ironGall}" stroke-width="1" fill="${COLORS.ironGall}" stroke-linecap="square">
        <line x1="10" y1="22" x2="190" y2="22" />
        <!-- Tick marks at 0, 5, 10, 15, 20 (60 px per 10 hexes) -->
        <line x1="10"  y1="16" x2="10"  y2="28" />
        <line x1="55"  y1="18" x2="55"  y2="26" opacity="0.7" />
        <line x1="100" y1="14" x2="100" y2="30" />
        <line x1="145" y1="18" x2="145" y2="26" opacity="0.7" />
        <line x1="190" y1="14" x2="190" y2="30" />
        <!-- Alternating filled segments for the bar -->
        <rect x="10"  y="20" width="45" height="4" fill="${COLORS.ironGall}" />
        <rect x="100" y="20" width="45" height="4" fill="${COLORS.ironGall}" />
        <rect x="55"  y="20" width="45" height="4" fill="none" stroke="${COLORS.ironGall}" stroke-width="0.6" />
        <rect x="145" y="20" width="45" height="4" fill="none" stroke="${COLORS.ironGall}" stroke-width="0.6" />
      </g>
      <g font-family="'IM Fell English', serif" font-style="italic" font-size="9" fill="${COLORS.sepia}">
        <text x="10"  y="40" text-anchor="middle">0</text>
        <text x="100" y="40" text-anchor="middle">10</text>
        <text x="190" y="40" text-anchor="middle">20</text>
        <text x="100" y="12" text-anchor="middle">hexes</text>
      </g>
    </svg>
  `;
}

function waxSeal() {
  // Bottom-right corner; hidden initially, scale-stamps in via JS class toggle.
  return `
    <svg id="wax-seal"
         style="position:fixed; right:54px; bottom:80px; pointer-events:none;
                opacity:0; transform-origin: center; will-change: transform, opacity;"
         width="92" height="92" viewBox="-50 -50 100 100">
      <defs>
        <radialGradient id="waxGrad" cx="-12" cy="-12" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stop-color="#f08049" />
          <stop offset="0.45" stop-color="#c2400c" />
          <stop offset="0.85" stop-color="#7b1f04" />
          <stop offset="1"    stop-color="#420f02" />
        </radialGradient>
        <radialGradient id="waxHi" cx="-18" cy="-18" r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ffd6b0" stop-opacity="0.6" />
          <stop offset="1" stop-color="#ffd6b0" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- splatter drips -->
      <path d="M-38,-10 q -10 4 -8 14 q 6 -2 8 -12 z" fill="#7b1f04" opacity="0.7"/>
      <path d="M32,-30 q 8 -4 14 2 q -4 6 -14 4 z" fill="#7b1f04" opacity="0.7"/>
      <circle r="40" fill="url(#waxGrad)" />
      <circle r="40" fill="url(#waxHi)" />
      <circle r="40" fill="none" stroke="#420f02" stroke-width="1.2" opacity="0.6"/>
      <!-- inner ridge -->
      <circle r="30" fill="none" stroke="#8c2a08" stroke-width="1.4" opacity="0.7" />
      <!-- monogram: stylized H L (Hexagonalis / Labyrinthus) -->
      <g fill="#3a0f02" font-family="'IM Fell English SC', serif" text-anchor="middle">
        <text y="-2" font-size="16" letter-spacing="2">H · L</text>
        <text y="14" font-size="6" letter-spacing="2.4">FOLIO</text>
      </g>
    </svg>
  `;
}

export function stampWaxSeal() {
  const el = document.getElementById('wax-seal');
  if (!el) return;
  el.style.animation = 'none';
  // force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  void el.getBoundingClientRect().width;
  el.style.animation = 'sealStamp 700ms cubic-bezier(.2,.7,.2,1) forwards';
  el.style.opacity = '1';
}

export function hideWaxSeal() {
  const el = document.getElementById('wax-seal');
  if (!el) return;
  el.style.animation = 'none';
  el.style.opacity = '0';
  el.style.transform = 'scale(2.6) rotate(-12deg)';
}
