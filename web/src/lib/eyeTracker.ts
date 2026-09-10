/**
 * Shared cursor-tracking engine for the penguins' eyes.
 *
 * A singleton so many `WaddleAvatar` instances can mount/unmount at any
 * time: it lazily starts one shared `requestAnimationFrame` loop the moment
 * the first eye registers, and stops it the moment the last one
 * unregisters — no leaked loops, no per-component listeners.
 *
 * Each eye is a small dot that shifts a few pixels toward the cursor,
 * lerped for a soft, non-jittery follow.
 *
 * Correctness note: the world position of an eye's rest point (cx, cy) must
 * be read through the *owning `<svg>` element's* screen CTM, not the eye's
 * own — the eye's own CTM already includes whatever translate this same
 * engine set on it last frame, which would feed the transform back into
 * its own reference frame and compound error every tick. The `<svg>`
 * root's CTM has no such loop.
 */

interface Watcher {
  el: SVGGraphicsElement;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  maxOffset: number;
}

let watchers: Watcher[] = [];
let rafId: number | null = null;
let mouse = { x: -9999, y: -9999 };
let inside = false;
let reduced = false;
let listenersAttached = false;

export function calculateGazeOffset(
  pointerX: number,
  pointerY: number,
  originX: number,
  originY: number,
  maxOffset: number,
  activationDistance = 150,
): { x: number; y: number } {
  const dx = pointerX - originX;
  const dy = pointerY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || maxOffset <= 0) return { x: 0, y: 0 };

  const strength = Math.min(distance / activationDistance, 1) * maxOffset;
  return {
    x: (dx / distance) * strength,
    y: (dy / distance) * strength,
  };
}

function updateReducedMotion() {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function handleMouseMove(e: MouseEvent) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  inside = true;
}

function handleMouseLeave() {
  inside = false;
}

function attachGlobalListenersOnce() {
  if (listenersAttached) return;
  listenersAttached = true;
  updateReducedMotion();
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('mouseleave', handleMouseLeave);
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', updateReducedMotion);
}

// Cleared every tick; both eyes of an avatar share one <svg>, so this avoids
// calling getScreenCTM() twice per instance per frame.
const ctmCache = new Map<SVGGraphicsElement, DOMMatrix | null>();

function toScreenPoint(el: SVGGraphicsElement, x: number, y: number): { x: number; y: number } | null {
  const svg = el.ownerSVGElement;
  if (!svg) return null;
  // Include body tilt, but never our own gaze offset.
  const parent = el.parentElement as unknown as SVGGraphicsElement;
  if (!ctmCache.has(parent)) ctmCache.set(parent, parent.getScreenCTM());
  const ctm = ctmCache.get(parent);
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const transformed = pt.matrixTransform(ctm);
  return { x: transformed.x, y: transformed.y };
}

function tick() {
  ctmCache.clear();
  for (const w of watchers) {
    let targetTx = 0;
    let targetTy = 0;
    if (inside && !reduced) {
      const pt = toScreenPoint(w.el, w.cx, w.cy);
      if (pt) {
        const offset = calculateGazeOffset(mouse.x, mouse.y, pt.x, pt.y, w.maxOffset);
        targetTx = offset.x;
        targetTy = offset.y;
      }
    }
    const lerp = 0.20;
    const dx = targetTx - w.tx;
    const dy = targetTy - w.ty;
    if (Math.abs(dx) < 0.005 && Math.abs(dy) < 0.005) {
      w.tx = targetTx;
      w.ty = targetTy;
    } else {
      w.tx += dx * lerp;
      w.ty += dy * lerp;
    }
    w.el.setAttribute('transform', `translate(${w.tx.toFixed(2)} ${w.ty.toFixed(2)})`);
  }
  rafId = watchers.length > 0 ? requestAnimationFrame(tick) : null;
}

/**
 * Registers one eye `<circle>` for cursor tracking. `cx`/`cy` must match the
 * circle's own `cx`/`cy` attributes (its rest position) — the transform this
 * engine sets is a small *additional* translate layered on top via the
 * `transform` attribute, not a replacement for the base position.
 * `maxOffset` caps how far it may drift. Returns an unregister function —
 * always call it on unmount / when tracking turns off, or the eye is left
 * with a stale transform.
 */
export function registerEye(el: SVGGraphicsElement, cx: number, cy: number, maxOffset: number): () => void {
  attachGlobalListenersOnce();
  const watcher: Watcher = { el, cx, cy, tx: 0, ty: 0, maxOffset };
  watchers.push(watcher);
  if (rafId === null) {
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    watchers = watchers.filter((w) => w !== watcher);
    el.removeAttribute('transform');
  };
}
