/* page-pavilion-wp.js — the Pavilion, inside WordPress.
 *
 * Everything is already on the page (template-parts/pages/pavilion.php renders
 * the band, the sections and the ribbon on the server). This module only marks,
 * in the ribbon, the section being read, and keeps that link in view when the
 * ribbon is wider than the screen. With JavaScript off the ribbon still links
 * to every section.
 */
const bar = document.querySelector('[data-si-chapters]');
if (bar && 'IntersectionObserver' in window) {
	const links = [...bar.querySelectorAll('a[href^="#"]')];
	const heads = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
	const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let current = null;

	const mark = () => {
		/* the last heading above a line a quarter of the way down the screen */
		const line = innerHeight * 0.28;
		let best = heads[0];
		for (const h of heads) if (h.getBoundingClientRect().top <= line) best = h;
		if (best === current) return;
		current = best;
		for (const a of links) {
			const on = a.hash === '#' + best.id;
			if (on) {
				a.setAttribute('aria-current', 'location');
				a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm ? 'auto' : 'smooth' });
			} else {
				a.removeAttribute('aria-current');
			}
		}
	};

	let queued = false;
	addEventListener('scroll', () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => { queued = false; mark(); });
	}, { passive: true });
	mark();
}
