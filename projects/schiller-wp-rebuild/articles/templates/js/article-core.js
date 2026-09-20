/* article-core.js — shared behaviour for the three single-article drafts.
 *
 * WordPress ships this file as-is (assets/articles/js/article-core.js) and the
 * -wp modules import from it, so it must contain nothing prototype-only: the
 * payload loader lives next door in article-load.js, which does not ship.
 *
 * The helpers here are deliberately a small local copy rather than an import
 * from ../../people/templates/js/people-core.js: the two draft series must
 * stay independently editable. When they are ported, esc/reveal/settleImages
 * belong in one si-core.js the whole child theme shares.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---- formatting ---------------------------------------------------------- */
export const LANG_NAME = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ru: 'Русский', it: 'Italiano', 'zh-hans': '中文' };

export function fmtDate(iso, lang) {
	const l = lang === 'en' || !lang ? 'en-GB' : lang;
	return new Intl.DateTimeFormat(l, { day: 'numeric', month: 'long', year: 'numeric' })
		.format(new Date(String(iso).slice(0, 10) + 'T12:00:00'));
}
export function fmtShort(iso, lang) {
	const l = lang === 'en' || !lang ? 'en-GB' : lang;
	return new Intl.DateTimeFormat(l, { day: '2-digit', month: 'short', year: 'numeric' })
		.format(new Date(String(iso).slice(0, 10) + 'T12:00:00'));
}
/** "12 min read" — the one derived number the page shows. 220 wpm, the rate
 *  the build script used, so the figure never disagrees with the payload. */
export const readTime = (m, lang) => lang === 'de' ? `${m} Min. Lesezeit` : `${m} min read`;

/* ---- the dateline -------------------------------------------------------- */
/** Date first, then only what the record actually holds — no empty slots and
 *  no invented author. `written_by` is the reviewed byline edge; where the
 *  review did not accept one, the line simply has no byline. */
export function datelineHTML(a, { tags = true } = {}) {
	const bits = [`<span class="ar-date">${esc(fmtDate(a.d, a.l))}</span>`];
	if (a.byline) {
		const who = a.byline.people
			.map(p => p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name))
			.join(' · ');
		bits.push(`<span class="ar-byline">${a.l === 'de' ? 'von' : 'by'} ${who}</span>`);
	}
	bits.push(`<span>${esc(readTime(a.m, a.l))}</span>`);
	if (a.translations.length) {
		bits.push(a.translations
			.map(t => `<a class="ar-tag" href="${esc(t.u)}" hreflang="${esc(t.l)}">${esc(t.label)}</a>`)
			.join(' '));
	}
	let html = `<div class="ar-dateline">${bits.join('<span class="sep" aria-hidden="true">|</span>')}</div>`;
	if (tags && a.tp.length) {
		html += `<div class="ar-tags">${a.tp
			.map(t => `<a class="ar-tag" href="/topic/${esc(t.slug)}/">${esc(t.label)}</a>`).join('')}</div>`;
	}
	return html;
}

/* ---- the record, at the foot ---------------------------------------------
 * Every row is a field WordPress already holds — the publish date, the
 * modified date (printed only when it differs), the language and translation
 * group from WPML, and the reviewed taxonomy terms. Nothing here is typed by
 * anyone for this block, and a row with nothing behind it is not printed.
 * The permalink is not among them: the reader is already on it. */
export function colophonHTML(a) {
	const rows = [
		['Published', fmtDate(a.d, a.l)],
	];
	if (String(a.modified).slice(0, 10) !== String(a.d).slice(0, 10)) {
		rows.push(['Last revised', fmtDate(a.modified, a.l)]);
	}
	rows.push(['Language', LANG_NAME[a.l] || a.l]);
	if (a.tp.length) rows.push(['Topic', a.tp.map(t => t.label).join(' · ')]);
	if (a.rg.length) rows.push(['Region', a.rg.map(s => s.replace(/-/g, ' ')).join(' · ')]);
	if (a.cp.length) rows.push(['Campaign', a.cp.map(s => s.replace(/-/g, ' ')).join(' · ')]);
	if (a.translations.length) {
		rows.push(['Also in', a.translations
			.map(t => `<a href="${esc(t.u)}" hreflang="${esc(t.l)}">${esc(t.label)}</a>`).join(' · ')]);
	}
	return `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

/* ---- "continue reading": an index, never a row of cards ------------------ */
export function continueHTML(a, n = 6) {
	return `<ul class="ar-continue">${a.related.slice(0, n).map(r => `
		<li><a href="${esc(r.u)}">
			<span class="d si-tabular">${esc(fmtShort(r.d, a.l))}</span>
			<span class="t">${esc(r.t)}</span>
			<span class="m">${r.m}′</span>
		</a></li>`).join('')}</ul>`;
}

/* ---- video facade (two-click) -------------------------------------------- */
const PLAY = '<svg viewBox="0 0 22 24" aria-hidden="true"><path d="M0 0l22 12L0 24z"/></svg>';

/** Replace every <figure class="si-embed" data-yt="…"> the converter wrote
 *  with a poster + play button. Nothing is requested from YouTube until the
 *  reader clicks; then the nocookie player is inserted in place. */
export function mountEmbeds(root, label = 'Play video — loads from youtube-nocookie.com') {
	for (const fig of root.querySelectorAll('figure.si-embed[data-yt]')) {
		const id = fig.dataset.yt;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'ar-embed';
		btn.setAttribute('aria-label', label);
		btn.innerHTML =
			`<img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async">` +
			`<span class="ar-embed__play">${PLAY}</span>` +
			`<span class="ar-embed__note">${esc(label)}</span>`;
		btn.addEventListener('click', () => {
			const frame = document.createElement('iframe');
			frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
			frame.title = 'Video';
			frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
			frame.allowFullscreen = true;
			const box = document.createElement('div');
			box.className = 'ar-embed';
			box.appendChild(frame);
			fig.replaceChildren(box);
		}, { once: true });
		fig.replaceChildren(btn);
	}
}

/* ---- footnotes ------------------------------------------------------------
 * The converter has already turned the article's own markers into links to
 * #fn-N and given each note a link back to #fnref-N, so the page works with
 * JavaScript off — the browser's own anchor jump lands in the right place.
 * This only softens the jump and flashes whichever end you arrived at, which
 * is what tells a reader which of twenty notes they were sent to.
 */
export function mountFootnotes(root) {
	root.addEventListener('click', e => {
		const link = e.target.closest('.si-fn a, .si-fn-back');
		if (!link) return;
		const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
		const target = id && root.querySelector(`[id="${CSS.escape(id)}"]`);
		if (!target) return;
		e.preventDefault();
		target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
		for (const was of root.querySelectorAll('.is-flash')) was.classList.remove('is-flash');
		void target.offsetWidth;                       // restart the animation
		target.classList.add('is-flash');
		history.replaceState(null, '', '#' + id);
	});
}

/* ---- reading progress ---------------------------------------------------- */
/** A 2px hairline, and nothing else: no percentage, no counter, no badge. */
export function mountProgress(bar, article) {
	const fill = bar.querySelector('i');
	let ticking = false;
	const update = () => {
		ticking = false;
		const box = article.getBoundingClientRect();
		const total = box.height - innerHeight;
		const done = total > 0 ? Math.min(1, Math.max(0, -box.top / total)) : (box.top < 0 ? 1 : 0);
		fill.style.setProperty('--p', (done * 100).toFixed(2) + '%');
	};
	const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
	addEventListener('scroll', onScroll, { passive: true });
	addEventListener('resize', onScroll, { passive: true });
	update();
	return update;
}

/* ---- reveal on scroll (progressive: content is visible without it) ------- */
export function reveal(nodes) {
	if (reduceMotion || !('IntersectionObserver' in window)) return;
	const io = new IntersectionObserver((entries) => {
		for (const e of entries) {
			if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
		}
	}, { rootMargin: '0px 0px -8% 0px' });
	nodes.forEach((n, i) => { n.classList.add('si-reveal'); n.style.setProperty('--i', i % 8); io.observe(n); });
}
