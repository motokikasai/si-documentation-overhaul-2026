/* pages-core.js — shared behaviour for the Page template and Tier-1 page drafts.
 *
 * Two halves. The top half (esc, dates, reveal, tabs, contents, spy) is what a
 * WordPress port would ship. Everything below the PROTO line — the payload
 * loader, the review strip, the composed example page — is prototype-only.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const UPLOADS = 'https://schillerinstitute.com/wp-content/uploads/';
export const nf = n => Number(n).toLocaleString('en-GB');

export function fmtDate(iso, style = 'long') {
	const s = String(iso);
	if (/^\d{4}$/.test(s)) return s;
	const o = style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' }
		: style === 'month' ? { month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
	return new Intl.DateTimeFormat('en-GB', o).format(new Date(s.slice(0, 10) + 'T12:00:00'));
}

/* ---- reveal: content is visible without JS; with JS it settles in -------- */
export function reveal(root = document) {
	const els = root.querySelectorAll('.si-reveal:not(.is-in)');
	if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
	const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
	els.forEach(e => io.observe(e));
}

/* ---- legacy prose: tabs, lazy media ------------------------------------- */
/** The importer writes Vanguard [tabs] as stacked <details>. That reads fine with
 *  no JS; with JS it becomes a real tablist (arrow keys, one pane shown). */
export function enhanceProse(root) {
	root.querySelectorAll('img').forEach(i => { i.loading = 'lazy'; i.decoding = 'async'; });
	twoClick(root);
	root.querySelectorAll('.si-tabs').forEach((box, n) => {
		const panes = [...box.querySelectorAll(':scope > .si-tab')];
		if (panes.length < 2) return;
		const list = document.createElement('div');
		list.className = 'si-tabs__list'; list.setAttribute('role', 'tablist');
		panes.forEach((p, i) => {
			const b = document.createElement('button');
			b.type = 'button'; b.role = 'tab'; b.id = `tab-${n}-${i}`;
			b.textContent = p.querySelector('summary')?.textContent.trim() || `Tab ${i + 1}`;
			b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
			b.tabIndex = i === 0 ? 0 : -1;
			p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
			b.addEventListener('click', () => select(i));
			b.addEventListener('keydown', e => {
				const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return;
				e.preventDefault(); select((i + k + panes.length) % panes.length); list.children[(i + k + panes.length) % panes.length].focus();
			});
			list.appendChild(b);
		});
		function select(i) {
			panes.forEach((p, j) => { p.open = j === i; p.hidden = j !== i; list.children[j].setAttribute('aria-selected', String(j === i)); list.children[j].tabIndex = j === i ? 0 : -1; });
		}
		box.prepend(list); box.classList.add('is-tabs'); select(0);
	});
}

/** Two-click video, everywhere (house rule): a legacy page body may hold a raw
 *  YouTube iframe. Nothing is requested from YouTube until the reader presses
 *  play, and then only from youtube-nocookie. In WordPress this is a
 *  render_block / the_content filter, so the iframe never reaches the HTML. */
export function twoClick(root) {
	root.querySelectorAll('iframe[src*="youtube"]').forEach(f => {
		const id = (f.src.match(/embed\/([\w-]{11})/) || [])[1];
		if (!id) return;
		const box = document.createElement('div');
		box.className = 'si-embed';
		box.innerHTML = `<button type="button" class="si-embed__play" aria-label="Play video (loads from YouTube)">
			<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M26 21 L45 32 L26 43 Z" fill="currentColor"/></svg>
			<span>Play video</span><small>Loads from YouTube (no-cookie) when pressed</small></button>`;
		box.querySelector('button').addEventListener('click', () => {
			box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Video"></iframe>`;
		});
		(f.closest('.wp-block-embed, figure') || f).replaceWith(box);
	});
}

/** Headings → ids + a contents list. Only real h2/h3 with text count. */
export function headingsOf(root, sel = 'h2, h3') {
	const out = [], seen = new Set();
	root.querySelectorAll(sel).forEach(h => {
		if (h.closest('.si-tab, .si-cta, .si-info-box, .alm-item, .si-legacy-list')) return;
		const t = h.textContent.replace(/\s+/g, ' ').trim();
		if (!t || t.length > 140) return;
		let id = h.id || t.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'section';
		while (seen.has(id)) id += '-2';
		seen.add(id); h.id = id;
		out.push({ id, text: t, level: +h.tagName[1], el: h });
	});
	return out;
}

/** Scroll-spy: marks the link of the section being read. */
export function spy(items, links, onChange) {
	if (!items.length || !('IntersectionObserver' in window)) return;
	let current = null;
	const io = new IntersectionObserver(() => {
		const y = innerHeight * 0.28;
		let best = items[0];
		for (const it of items) if (it.el.getBoundingClientRect().top - y <= 0) best = it;
		if (best !== current) {
			current = best;
			links.forEach(a => a.toggleAttribute('aria-current', a.hash === '#' + best.id));
			onChange?.(best);
		}
	}, { threshold: [0, 1], rootMargin: '0px 0px -60% 0px' });
	items.forEach(it => io.observe(it.el));
	addEventListener('scroll', () => io.takeRecords(), { passive: true });
}

export const readMinutes = words => Math.max(1, Math.round(words / 220));

/* ==========================================================================
   PROTO — below this line nothing ships.
   ========================================================================== */
const DATA = new URL('../../data/', import.meta.url);
export const getJSON = name => fetch(new URL(name, DATA)).then(r => { if (!r.ok) throw new Error(name); return r.json(); });

/** The review strip: cross-links a family's three drafts, optional picker, optional
 *  Visitor/Editor switch (editor view outlines every pattern with its name). */
export function draftStrip({ family, drafts, current, picker, view = false }) {
	const nav = document.createElement('nav');
	nav.className = 'draft-strip';
	nav.setAttribute('aria-label', `${family} drafts (prototype)`);
	const q = new URLSearchParams(location.search);
	const keep = q.get('p') ? '?p=' + encodeURIComponent(q.get('p')) : '';
	nav.innerHTML = `<span><span class="draft-family">${esc(family)}</span></span>` + drafts.map(([k, href, title]) =>
		`<a href="${href}${keep}" title="${esc(title)}"${href === current ? ' aria-current="page"' : ''}>${k}</a>`).join('') +
		`<a href="../index.html" title="All page drafts">≡</a>`;
	if (picker) {
		const sel = document.createElement('select');
		sel.className = 'draft-pick'; sel.setAttribute('aria-label', picker.label || 'Showcase');
		sel.innerHTML = picker.options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
		sel.value = picker.value;
		sel.addEventListener('change', () => picker.onChange(sel.value));
		nav.appendChild(sel);
	}
	if (view) {
		const v = document.createElement('div');
		v.className = 'draft-view';
		v.innerHTML = `<button type="button" data-v="visitor">Visitor</button><button type="button" data-v="editor">Editor</button>`;
		const set = m => { document.documentElement.dataset.view = m; v.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === m))); };
		v.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.v); });
		set(q.get('view') || 'visitor');
		nav.appendChild(v);
	}
	document.body.appendChild(nav);
}

/* ---- the composed example: a page an editor builds from the pattern kit --- */
/** Every word below is either a pattern's own label or a verified fact from
 *  data/facts.json — the editor's content, not the designer's. */
export function composedPage(facts) {
	const ipc = facts.ipc_latest;
	return {
		id: 'composed', title: 'International Peace Coalition', url: '/international-peace-coalition/',
		composed: true, parent: null, children: [], featured: null, words: 180,
		eyebrow: 'Campaign',
		standfirst: facts.ipc_page.quote,
		html: `
<div class="si-p si-p-facts-wrap" data-pattern="Facts">
	<dl class="si-p-facts">
		<div><dt>consecutive weekly meetings, by ${esc(fmtDate('2026-08-14'))}</dt><dd>167</dd></div>
		<div><dt>every Friday, on Zoom</dt><dd>11:00 <small>ET</small></dd></div>
		<div><dt>articles in the campaign so far</dt><dd>${nf(facts.campaign_counts['international-peace-coalition'])}</dd></div>
	</dl>
</div>
<figure class="si-p si-p-quote" data-pattern="Quote">
	<blockquote>${esc(facts.ipc_report.quote)}</blockquote>
	<figcaption>From the report on week 167 · <a class="si-link" href="${esc(facts.ipc_report.url)}">${esc(facts.ipc_report.title)}</a>, ${esc(fmtDate(facts.ipc_report.date))}</figcaption>
</figure>
<h2>Reports from recent meetings</h2>
<ul class="si-p si-p-query" data-pattern="Latest from the archive" data-slot="Query: campaign = International Peace Coalition · 4 newest">
	${ipc.map(a => `<li><a href="${esc(a.u)}"><img src="${UPLOADS}${esc(a.g)}" alt="" loading="lazy"><time datetime="${a.d}">${esc(fmtDate(a.d, 'short'))}</time><strong>${esc(a.t)}</strong></a></li>`).join('')}
</ul>
<section class="si-p si-p-cta" data-pattern="Call to action">
	<h2>Join on Friday</h2>
	<p>${esc(facts.ipc_page.quote)}</p>
	<div class="si-p-actions"><a class="ct-button" href="#">Get the Zoom link</a><a class="si-link" href="/campaign/international-peace-coalition/">All ${nf(facts.campaign_counts['international-peace-coalition'])} reports</a> <span class="pg-ph-inline">NationBuilder signup</span></div>
</section>`,
	};
}

/** The showcase picker's option list: eight legacy pages + the composed one. */
export function pageOptions(legacy) {
	return [['composed', 'New page, built from patterns · Peace Coalition'],
		...legacy.pages.filter(p => p.showcase).map(p => [String(p.id), `${p.title.length > 40 ? p.title.slice(0, 38) + '…' : p.title} · ${nf(p.words)} words`])];
}
export function pickPage(legacy, facts) {
	const id = new URLSearchParams(location.search).get('p') || '45811';
	return id === 'composed' ? composedPage(facts) : legacy.pages.find(p => String(p.id) === id) || legacy.pages[0];
}
export function go(p) { const u = new URL(location.href); u.searchParams.set('p', p); location.href = u; }

/* ---- shared by the Home, Join and Contact drafts (these DO ship) ---------- */
/** The next occurrence of a weekly slot in a named time zone, as a real instant.
 *  "Friday 11:00 ET" → a Date, so it can be printed in the READER's own time. */
export function nextWeekly(weekday, hour, minute = 0, tz = 'America/New_York', from = new Date()) {
	const offset = t => {                     // minutes the zone is ahead of UTC at instant t
		const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
			.formatToParts(t).map(x => [x.type, x.value]));
		return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - t) / 60000;
	};
	for (let i = 0; i < 8; i++) {
		const d = new Date(from.getTime() + i * 864e5);
		const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
		const g = Object.fromEntries(ymd.map(x => [x.type, x.value]));
		if (g.weekday !== ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]) continue;
		let t = Date.UTC(+g.year, g.month - 1, +g.day, hour, minute);
		t -= offset(new Date(t)) * 60000;
		if (t > from.getTime() - 3600e3) return new Date(t);   // still "this" meeting within its hour
	}
	return null;
}
export const fmtLocal = (d, o = { weekday: 'long', hour: '2-digit', minute: '2-digit' }) => new Intl.DateTimeFormat(undefined, o).format(d);
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');

/** How long between a thing being said and the event that followed.
 *  Precision follows the source: "1987-05" → months, "1991" → years. */
export function leadTime(said, followed) {
	if (!said || !followed) return null;
	const [sy, sm = null] = String(said).split('-').map(Number);
	const [fy, fm = null] = String(followed).split('-').map(Number);
	if (sm && fm) {
		const m = (fy - sy) * 12 + (fm - sm);
		return m < 24 ? { n: m, unit: m === 1 ? 'month' : 'months', years: m / 12 } : { n: Math.round(m / 12), unit: 'years', years: m / 12 };
	}
	const y = fy - sy;
	return y > 0 ? { n: y, unit: y === 1 ? 'year' : 'years', years: y } : null;
}
export const GRADE = {
	own: { label: 'Our own account', note: 'Published by the Institute or EIR, in this archive.' },
	reported: { label: 'Reported from a third party', note: 'Another person’s words, as reported in this archive.' },
};

/** A Jasper medallion for a voice from data/voices.json (photo path is from the
 *  project root). The image fades in on load, as components.css expects. */
export function medallion(v, size = 56) {
	return `<span class="si-medallion" style="--size:${size}px"><img class="si-medallion__img" data-focus alt="" loading="lazy" decoding="async"
		style="width:100%;height:100%;left:0;top:0;object-fit:cover;object-position:${v.fx}% ${v.fy}%" src="../../${esc(v.photo)}" onload="this.classList.add('is-loaded')"></span>`;
}
export function voiceItem(v) {
	return `<li class="hm-voice"><a href="${esc(v.url)}">${medallion(v)}<div><b>${esc(v.name)}</b><span>${esc(v.title)}</span><small>${v.n} ${v.n === 1 ? 'appearance' : 'appearances'} in the archive</small></div></a></li>`;
}
/** One tooltip element per page, positioned at the pointer. */
export function tooltip() {
	const tip = document.createElement('div'); tip.className = 'hm-tip'; tip.setAttribute('role', 'tooltip');
	document.body.appendChild(tip);
	return {
		show(html, x, y) { tip.innerHTML = html; tip.classList.add('is-on'); const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 12, x + 14) + 'px'; tip.style.top = (y + 16) + 'px'; },
		hide() { tip.classList.remove('is-on'); },
	};
}

/* PROTO — the draft families, for the review strip */
export const FAMILIES = {
	About: [['A', 'about-founding.html', 'The Founding'], ['B', 'about-lexicon.html', 'The Lexicon'], ['C', 'about-register.html', 'The Register']],
	Contact: [['A', 'contact-letter.html', 'The Letter'], ['B', 'contact-switchboard.html', 'The Switchboard'], ['C', 'contact-desk.html', 'The Desk']],
	Donate: [['A', 'donate-facts.html', 'The Plain Facts'], ['B', 'donate-purpose.html', 'What It Keeps Going'], ['C', 'donate-membership.html', 'Membership']],
	Join: [['A', 'join-ladder.html', 'The Ladder'], ['B', 'join-week.html', 'The Week'], ['C', 'join-roles.html', 'Your Part']],
	Legal: [['A', 'legal-code.html', 'The Code'], ['B', 'legal-letterhead.html', 'The Letterhead'], ['C', 'legal-layers.html', 'The Layers']],
	'404': [['A', 'notfound-suggest.html', 'Did You Mean'], ['B', 'notfound-quiet.html', 'The Quiet Page'], ['C', 'notfound-drawer.html', 'The Archive Drawer']],
	Search: [['A', 'search-catalogue.html', 'The Catalogue'], ['B', 'search-concordance.html', 'The Concordance'], ['C', 'search-answer.html', 'The Answer First']],
};
export const strip = (family, current, extra = {}) => draftStrip({ family, drafts: FAMILIES[family], current, ...extra });
/** Render once: fills <main>, clears the busy flag, runs reveal, adds the strip. */
export function mount(html, family, current, extra) {
	const main = document.getElementById('main');
	main.innerHTML = html; main.removeAttribute('aria-busy');
	reveal(main); strip(family, current, extra);
	return main;
}
