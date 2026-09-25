/* schiller-editorial — the legal index follows the reader (Legal · "The Code").
 * Enhancement only: without it the index is a list of plain links to the clauses. It marks
 * the clause being read with aria-current, which the stylesheet draws as a brass rule.
 *
 * A clause counts as "being read" when it crosses a band 20–40% down the screen. The last
 * clauses of a page can never reach that band — the page ends first — so at the bottom of the
 * page the last clause on screen is marked instead (seen 2026-09-25: clicking §16 left §15
 * marked). A scroll listener covers that case, where the observer reports no change. */
(() => {
	const links = [...document.querySelectorAll('.si-legal__index a[href^="#k-"]')];
	if (!links.length || !('IntersectionObserver' in window)) return;
	const target = (a) => document.getElementById(a.getAttribute('href').slice(1));
	const seen = new Set();
	const set = (link) => {
		links.forEach((a) => a.toggleAttribute('aria-current', a === link));
		if (link) link.scrollIntoView({ block: 'nearest' });
	};
	const mark = () => {
		const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
		if (bottom) {
			const onScreen = links.filter((a) => { const t = target(a); return t && t.getBoundingClientRect().top < window.innerHeight * 0.9; });
			set(onScreen[onScreen.length - 1] || null);
			return;
		}
		set(links.find((a) => seen.has(a.getAttribute('href').slice(1))) || null);
	};
	const io = new IntersectionObserver((entries) => {
		entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
		mark();
	}, { rootMargin: '-20% 0px -60% 0px' });
	links.forEach((a) => { const t = target(a); if (t) io.observe(t); });
	let queued = false;
	window.addEventListener('scroll', () => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => { queued = false; mark(); });
	}, { passive: true });
})();
