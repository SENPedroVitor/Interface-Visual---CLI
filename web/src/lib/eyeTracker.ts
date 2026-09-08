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
  el: SVGCircleElement;
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
const ctmCache = new Map<SVGSVGElement, DOMMatrix | null>();

function toScreenPoint(el: SVGCircleElement, x: number, y: number): { x: number; y: number } | null {
  const svg = el.ownerSVGElement;
  if (!svg) return null;
  if (!ctmCache.has(svg)) ctmCache.set(svg, svg.getScreenCTM());
  const ctm = ctmCache.get(svg);
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
        const dx = mouse.x - pt.x;
        const dy = mouse.y - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = Math.min(dist / 150, 1) * w.maxOffset;
        targetTx = (dx / dist) * f;
        targetTy = (dy / dist) * f;
      }
    }
    w.tx += (targetTx - w.tx) * 0.1;
    w.ty += (targetTy - w.ty) * 0.1;
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
export function registerEye(el: SVGCircleElement, cx: number, cy: number, maxOffset: number): () => void {
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
