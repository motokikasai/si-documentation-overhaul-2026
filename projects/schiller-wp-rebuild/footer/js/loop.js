/* loop.js — the drive shared by the two carousels.
 *
 * A footer animation is off-screen for almost the whole visit, so the rules for
 * when NOT to run it matter more than the animation. It is paused when:
 *
 *   · the reader is pointing at it or has tabbed into it — the explicit ask:
 *     "stops on hover" — and a moving link is a link you cannot click;
 *   · it is outside the viewport (IntersectionObserver), which is most of the time;
 *   · the tab is hidden (visibilitychange), so a background tab costs nothing;
 *   · `prefers-reduced-motion: reduce`, where it never starts at all and the
 *     step runs once so the layout is still composed, just still.
 *
 * `step(dt, t)` receives seconds since the last frame — never a frame count — so
 * speeds are in degrees or pixels per second and a dropped frame does not slow
 * the motion down. dt is clamped: returning to a tab after a minute must not
 * teleport the carousel.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createLoop(el, step, { hoverPauses = true } = {}) {
	let raf = 0;
	let last = 0;
	const held = new Set();          // every reason we are currently paused

	const running = () => raf !== 0;

	function frame(now) {
		const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
		last = now;
		step(dt, now / 1000);
		raf = requestAnimationFrame(frame);
	}

	function start() {
		if (running() || held.size || reduceMotion.matches) return;
		last = 0;
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		cancelAnimationFrame(raf);
		raf = 0;
	}

	const hold = (reason, on) => { on ? held.add(reason) : held.delete(reason); on ? stop() : start(); };

	if (hoverPauses) {
		el.addEventListener('pointerenter', () => hold('pointer', true));
		el.addEventListener('pointerleave', () => hold('pointer', false));
		el.addEventListener('focusin', () => hold('focus', true));
		el.addEventListener('focusout', () => hold('focus', false));
	}

	// touch has no hover: a tap holds it still long enough to read and press
	el.addEventListener('touchstart', () => hold('touch', true), { passive: true });
	el.addEventListener('touchend', () => setTimeout(() => hold('touch', false), 2500), { passive: true });

	document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));

	if ('IntersectionObserver' in window) {
		new IntersectionObserver(
			([e]) => hold('offscreen', !e.isIntersecting),
			{ rootMargin: '120px' }
		).observe(el);
		hold('offscreen', true);     // assume off-screen until the observer says otherwise
	}

	reduceMotion.addEventListener('change', () => (reduceMotion.matches ? stop() : start()));

	step(0, 0);                      // compose once, so a still page is still laid out
	start();
	return { start, stop, hold };
}

/** Fetch every portrait the moment the carousel is first seen.
 *
 * A carousel and `loading="lazy"` disagree: lazy is right while the footer is
 * far below the fold, but once it is on screen the faces that rotate or slide
 * in later are still unloaded, and they arrive visibly late. So: lazy until the
 * component is near the viewport, then eager for the whole cast at once, which
 * is a handful of thumbnails and only ever paid for by a reader who got here.
 */
export function eagerWhenSeen(el) {
	const load = () => el.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
	if (!('IntersectionObserver' in window)) return load();
	const io = new IntersectionObserver(([e]) => {
		if (!e.isIntersecting) return;
		io.disconnect();
		load();
	}, { rootMargin: '400px' });
	io.observe(el);
}
