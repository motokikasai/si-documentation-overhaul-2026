/* schiller-editorial — the legal index follows the reader (Legal · "The Code").
 * Enhancement only: without it the index is a list of plain links to the clauses. It marks
 * the clause being read with aria-current, which the stylesheet draws as a brass rule.
 *
 * A clause counts as "being read" when it crosses a band 20–40% down the screen. The last
 * clauses of a page can never reach that band — the page ends first — so at the bottom of the
 * page the last clause on screen is marked instead (seen 2026-09-25: clicking §16 left §15
 * marked). A scroll listener covers that case, where the observer reports no change.
 * But on a tall screen the page can also end before a clicked §15 reaches the band, and the
 * "last on screen" was then §16 (reported 2026-09-25). So a clause the reader has just picked in
 * the index wins at the bottom while it is on screen; the reader's own scrolling (wheel, touch,
 * keys) drops that pick. */
(() => {
	const links = [...document.querySelectorAll('.si-legal__index a[href^="#k-"]')];
	if (!links.length || !('IntersectionObserver' in window)) return;
	const target = (a) => document.getElementById(a.getAttribute('href').slice(1));
	const seen = new Set();
	/* Mark a link, and keep it in view inside the index column — by scrolling THAT column only.
	   link.scrollIntoView() scrolls every ancestor, the page included, and a page scroll cancels
	   the smooth scroll a click has just started: the address changed to #k-8 and the page only
	   twitched (reported 2026-09-25, after 0.5.4 began calling it on every scroll frame). So the
	   page is never scrolled here, and nothing happens unless the marked clause changes. */
	const nav = document.querySelector('.si-legal__index');
	let current = null;
	const set = (link) => {
		if (link === current) return;
		current = link;
		links.forEach((a) => a.toggleAttribute('aria-current', a === link));
		if (!link || !nav || nav.scrollHeight <= nav.clientHeight) return;
		const top = link.offsetTop - nav.offsetTop, bottom = top + link.offsetHeight;
		if (top < nav.scrollTop) nav.scrollTop = top;
		else if (bottom > nav.scrollTop + nav.clientHeight) nav.scrollTop = bottom - nav.clientHeight;
	};
	let picked = null;   // the index link the reader just clicked
	// at the bottom a click may not scroll at all (the clause is already on screen), so no
	// scroll event would follow: mark on the click too
	links.forEach((a) => a.addEventListener('click', () => { picked = a; requestAnimationFrame(mark); }));
	['wheel', 'touchmove', 'keydown'].forEach((t) => window.addEventListener(t, () => { picked = null; }, { passive: true }));
	const mark = () => {
		const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
		if (bottom) {
			const p = picked && target(picked);
			if (p) {
				const r = p.getBoundingClientRect();
				if (r.bottom > 0 && r.top < window.innerHeight) { set(picked); return; }
			}
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
