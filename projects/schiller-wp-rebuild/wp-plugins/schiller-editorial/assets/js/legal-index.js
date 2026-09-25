/* schiller-editorial — the legal index follows the reader (Legal · "The Code").
 * Enhancement only: without it the index is a list of plain links to the clauses. It marks
 * the clause being read with aria-current, which the stylesheet draws as a brass rule. */
(() => {
	const links = [...document.querySelectorAll('.si-legal__index a[href^="#k-"]')];
	if (!links.length || !('IntersectionObserver' in window)) return;
	const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
	const seen = new Set();
	const mark = () => {
		const first = links.find((a) => seen.has(a.getAttribute('href').slice(1)));
		links.forEach((a) => a.toggleAttribute('aria-current', a === first));
		if (first) first.scrollIntoView({ block: 'nearest' });
	};
	const io = new IntersectionObserver((entries) => {
		entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
		mark();
	}, { rootMargin: '-20% 0px -60% 0px' });
	byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();
