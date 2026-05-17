// Triptych unfold: single panel → three panels with paper-fold animation.
// Uses Web Animations API so we can await `.finished` before starting solvers.

const UNFOLD_MS = 1200;
const FOLDBACK_MS = 800;

function isVertical() {
  return window.matchMedia('(max-width: 1100px)').matches;
}

// Configure initial transform on side panels before unfold.
function setHiddenSide(panel, side) {
  if (isVertical()) {
    // For vertical: left becomes "above center", right becomes "below center"
    if (side === 'left') {
      panel.style.transformOrigin = 'center bottom';
      panel.style.transform = 'rotateX(90deg)';
    } else {
      panel.style.transformOrigin = 'center top';
      panel.style.transform = 'rotateX(-90deg)';
    }
  } else {
    if (side === 'left') {
      panel.style.transformOrigin = 'right center';
      panel.style.transform = 'rotateY(-90deg)';
    } else {
      panel.style.transformOrigin = 'left center';
      panel.style.transform = 'rotateY(90deg)';
    }
  }
  panel.style.opacity = '0';
  panel.style.filter = 'brightness(0.7) saturate(0.7)';
}

function clearTransform(panel) {
  panel.style.transform = '';
  panel.style.opacity = '';
  panel.style.filter = '';
  panel.style.transformOrigin = '';
}

// Animate panels out from behind the center. Returns a promise that
// resolves when the unfold completes. `prepareSidePanels` is called after the
// panels become display-visible but before the animation runs — it's where
// you should render the maze walls into the side panel canvases so the
// reveal shows real content, not blanks.
export async function unfoldTriptych(stage, panels, prepareSidePanels) {
  const { left, center, right } = panels;
  // Cancel any lingering animations from a prior fold-back.
  for (const el of [left, center, right]) {
    for (const a of el.getAnimations()) a.cancel();
  }
  stage.dataset.mode = 'triptych';

  // After display:flex/inline kicks in, prepare side panels' contents.
  // Wait one frame for layout to settle.
  await raf();
  if (prepareSidePanels) prepareSidePanels();

  setHiddenSide(left, 'left');
  setHiddenSide(right, 'right');

  await raf(); // ensure initial transform is committed before animating

  const axis = isVertical() ? 'X' : 'Y';
  const leftStart  = axis === 'Y' ? 'rotateY(-90deg)' : 'rotateX(90deg)';
  const rightStart = axis === 'Y' ? 'rotateY(90deg)'  : 'rotateX(-90deg)';
  const end = 'rotate(0)';

  const easing = 'cubic-bezier(.2, .75, .25, 1)';
  const dropShadow = '0 6px 18px rgba(40, 25, 8, 0.35), 0 24px 60px rgba(20, 12, 4, 0.45)';
  const dropShadowMid = '0 18px 40px rgba(40, 25, 8, 0.55), 0 48px 110px rgba(20, 12, 4, 0.6)';

  const animLeft = left.animate(
    [
      { transform: leftStart,  opacity: 0, filter: 'brightness(0.7) saturate(0.7)', boxShadow: dropShadow },
      { transform: 'rotate(-32deg) ' + (axis === 'Y' ? '' : ''), opacity: 0.65, filter: 'brightness(0.9)', boxShadow: dropShadowMid, offset: 0.55 },
      { transform: end, opacity: 1, filter: 'brightness(1) saturate(1)', boxShadow: dropShadow },
    ].map(k => axisifyTransform(k, axis, 'left')),
    { duration: UNFOLD_MS, easing, fill: 'forwards' }
  );
  const animRight = right.animate(
    [
      { transform: rightStart, opacity: 0, filter: 'brightness(0.7) saturate(0.7)', boxShadow: dropShadow },
      { transform: 'rotate(32deg)',  opacity: 0.65, filter: 'brightness(0.9)', boxShadow: dropShadowMid, offset: 0.55 },
      { transform: end, opacity: 1, filter: 'brightness(1) saturate(1)', boxShadow: dropShadow },
    ].map(k => axisifyTransform(k, axis, 'right')),
    { duration: UNFOLD_MS, easing, fill: 'forwards' }
  );

  // Center panel gets a subtle shadow swell while sides unfold.
  const animCenter = center.animate(
    [
      { transform: 'rotate(0)', boxShadow: dropShadow },
      { transform: 'rotate(0) translateZ(8px)', boxShadow: dropShadowMid, offset: 0.55 },
      { transform: 'rotate(0)', boxShadow: dropShadow },
    ],
    { duration: UNFOLD_MS, easing, fill: 'forwards' }
  );

  await Promise.all([animLeft.finished, animRight.finished, animCenter.finished]);
  // commit final styles (clear inline transforms so CSS hover/etc. work)
  clearTransform(left);
  clearTransform(right);
  center.style.transform = '';
  center.style.boxShadow = '';
}

export async function foldTriptychBack(stage, panels) {
  const { left, center, right } = panels;
  // Cancel prior unfold animations so fill:forwards doesn't fight us.
  for (const el of [left, center, right]) {
    for (const a of el.getAnimations()) a.cancel();
  }
  const axis = isVertical() ? 'X' : 'Y';
  const easing = 'cubic-bezier(.4, .0, .7, .3)';

  const leftEnd  = axis === 'Y' ? 'rotateY(-90deg)' : 'rotateX(90deg)';
  const rightEnd = axis === 'Y' ? 'rotateY(90deg)'  : 'rotateX(-90deg)';

  // origins must match unfold
  if (axis === 'Y') {
    left.style.transformOrigin  = 'right center';
    right.style.transformOrigin = 'left center';
  } else {
    left.style.transformOrigin  = 'center bottom';
    right.style.transformOrigin = 'center top';
  }

  const animLeft = left.animate(
    [
      { transform: 'rotate(0)', opacity: 1, filter: 'brightness(1)' },
      { transform: leftEnd,  opacity: 0, filter: 'brightness(0.6)' },
    ],
    { duration: FOLDBACK_MS, easing, fill: 'forwards' }
  );
  const animRight = right.animate(
    [
      { transform: 'rotate(0)', opacity: 1, filter: 'brightness(1)' },
      { transform: rightEnd, opacity: 0, filter: 'brightness(0.6)' },
    ],
    { duration: FOLDBACK_MS, easing, fill: 'forwards' }
  );

  await Promise.all([animLeft.finished, animRight.finished]);
  stage.dataset.mode = 'single';
  clearTransform(left);
  clearTransform(right);
}

// Helper: take the keyframe set and substitute the correct axis where
// generic 'rotate()' is used for the mid keyframe.
function axisifyTransform(keyframe, axis, side) {
  if (typeof keyframe.transform !== 'string') return keyframe;
  let t = keyframe.transform;
  // Replace bare rotate( with rotateY( or rotateX( for mid keyframes
  if (/rotate\(/.test(t) && !/rotate[XY]\(/.test(t)) {
    t = t.replace(/rotate\(/g, `rotate${axis}(`);
  }
  return { ...keyframe, transform: t };
}

function raf() {
  return new Promise(r => requestAnimationFrame(() => r()));
}
