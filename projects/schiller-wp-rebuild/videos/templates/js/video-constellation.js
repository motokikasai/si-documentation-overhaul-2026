/* video-constellation.js — draft D, "the Constellation".
 * The relations the archive never showed. The broadcast at the centre; around
 * it every person, place, series episode, language, week-mate, topic-mate and
 * kindred broadcast the record can PROVE — and every line carries the reason it
 * exists, printed. Nothing is inferred beyond what the payload's `how` fields
 * say. The same relations are also given as a plain list (and are the whole
 * page with JavaScript off, in WordPress, where the list is server-rendered).
 */
import {
	loadVideo, esc, fmtDate, fmtShort, hms, human, plural, LANG, kindLabel, titleHTML,
	facadeHTML, mountTape, personEvidence, ctaHTML, recordHTML, bodyHTML,
	reveal, settleImages, draftStrip, fail, wantedTime, weekday, watchURL, thumb, reduceMotion,
} from './video-core.js';

/* The sectors of the sky, clockwise from twelve o'clock. */
const SECTORS = [
	{ key: 'people', label: 'People', ring: 1 },
	{ key: 'series', label: 'Series', ring: 2 },
	{ key: 'lang', label: 'Languages', ring: 1 },
	{ key: 'week', label: 'The same fortnight', ring: 3 },
	{ key: 'topic', label: 'Same topic', ring: 3 },
	{ key: 'words', label: 'Same words', ring: 3 },
	{ key: 'places', label: 'Places', ring: 2 },
];
const W = 1000, H = 800, CX = W / 2, CY = H / 2;
const RING = { 1: 175, 2: 255, 3: 325 };
const clip = (s, n = 34) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
const strip = t => t.replace(/^(Webcast|Video|Live)\s*[:–—-]\s*/i, '');

const main = document.getElementById('main');
try {
	const rec = await loadVideo();
	document.title = `${rec.title} — Schiller Institute`;
	const nodes = relations(rec);
	main.innerHTML = render(rec, nodes);
	main.removeAttribute('aria-busy');
	mount(rec, nodes);
} catch (err) { fail(main, err); }
draftStrip('video-constellation.html');

/** Every relation the payload proves, each with its reason in words. */
function relations(rec) {
	const n = [];
	for (const p of rec.people) n.push({
		s: 'people', label: p.name, url: p.url, w: 1 + Math.min(4, p.at.length), person: p,
		why: p.role === 'host' ? `Host of ${rec.series?.label || 'the series'}` : personEvidence(p).replace(/^./, c => c.toUpperCase()),
		detail: p.at.length ? `Said at ${p.at.slice(0, 8).map(hms).join(', ')}` : '',
	});
	if (rec.series) {
		const s = rec.series;
		if (s.prev) n.push({ s: 'series', label: `No. ${s.ep - 1} · ${strip(s.prev.title)}`, url: `/videos/${s.prev.slug}/`, yt: s.prev.yt, w: 3, why: `The episode before — ${fmtDate(s.prev.date)}` });
		n.push({ s: 'series', label: `${s.label}`, url: `/videos/?series=${s.slug}`, w: 4, why: `Episode ${s.ep} of ${s.of}, ${fmtShort(s.first)} – ${fmtShort(s.last)}`, hub: true });
		if (s.next) n.push({ s: 'series', label: `No. ${s.ep + 1} · ${strip(s.next.title)}`, url: `/videos/${s.next.slug}/`, yt: s.next.yt, w: 3, why: `The episode after — ${fmtDate(s.next.date)}` });
	}
	for (const t of rec.translations) n.push({ s: 'lang', label: `${LANG[t.lang]} · ${t.title}`, url: t.url, yt: t.yt, w: 4, why: `The same broadcast in ${LANG[t.lang]} — one WPML translation group`, lang: t.lang });
	for (const w of rec.sameLangWeek.filter(w => ![rec.series?.prev?.slug, rec.series?.next?.slug].some(sl => sl && w.url.includes(sl))).slice(0, 6)) n.push({
		s: 'week', label: w.title, url: w.url, yt: w.yt, w: Math.max(1, 4 - Math.abs(w.dd) / 2),
		why: `${w.type_label}, ${w.dd === 0 ? 'the same day' : `${Math.abs(w.dd)} day${Math.abs(w.dd) === 1 ? '' : 's'} ${w.dd < 0 ? 'before' : 'after'}`}`,
	});
	for (const k of rec.topic_near.slice(0, 6)) n.push({ s: 'topic', label: k.title, url: `/videos/${k.slug}/`, yt: k.yt, w: 2,
		why: `Also filed under ${k.shared.map(x => rec.topics.find(t => t.slug === x)?.label || x).join(', ')} — ${fmtDate(k.date)}` });
	for (const k of (rec.kin || []).slice(0, 6)) n.push({ s: 'words', label: k.title, url: `/videos/${k.slug}/`, yt: k.yt, w: 1 + k.terms.length,
		why: `Shares ${k.terms.length} of this broadcast’s distinctive words: ${k.terms.join(', ')} — ${fmtDate(k.date)}` });
	for (const p of rec.places.slice(0, 7)) n.push({ s: 'places', label: p.name, w: 1 + Math.min(4, p.n / 4), url: p.at?.length && rec.yt ? watchURL(rec.yt, p.at[0]) : null, seek: p.at?.[0],
		why: `Named ${plural(p.n, 'time')}${p.at?.length ? `, first at ${hms(p.at[0])}` : ' in the text'}` });
	return n;
}

/** Deterministic layout: each non-empty sector gets an arc proportional to its
 *  size (with a floor), nodes spread evenly inside it on the sector's ring,
 *  alternately pushed in and out so neighbouring labels do not collide. */
function layout(nodes) {
	const present = SECTORS.filter(s => nodes.some(n => n.s === s.key));
	// faces and names need more room than a dot; every sector keeps a gap
	const weight = s => Math.max(1.6, nodes.filter(n => n.s === s.key).length * (s.key === 'people' ? 1.9 : 1));
	const GAP = present.length > 1 ? 0.16 : 0;
	const total = present.reduce((a, s) => a + weight(s), 0);
	const free = Math.PI * 2 - GAP * present.length;
	let a0 = -Math.PI / 2 - (weight(present[0] || { key: '' }) / total) * free / 2;
	const arcs = [];
	for (const s of present) {
		const span = weight(s) / total * free;
		const list = nodes.filter(n => n.s === s.key);
		list.forEach((n, i) => {
			const a = a0 + span * (i + 0.5) / list.length;
			const r = RING[s.ring] + (list.length > 2 ? (i % 2 ? 26 : -16) : 0);
			n.x = CX + Math.cos(a) * r * 1.14;
			n.y = CY + Math.sin(a) * r * 0.97;
			n.a = a;
		});
		arcs.push({ ...s, a0, a1: a0 + span });
		a0 += span + GAP;
	}
	return arcs;
}

function skySVG(rec, nodes) {
	const arcs = layout(nodes);
	const edges = nodes.map((n, i) => {
		const mx = (CX + n.x) / 2 + Math.cos(n.a + Math.PI / 2) * 18, my = (CY + n.y) / 2 + Math.sin(n.a + Math.PI / 2) * 18;
		return `<path class="cn-edge" data-n="${i}" data-s="${n.s}" d="M${CX} ${CY} Q${mx.toFixed(1)} ${my.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}" style="stroke-width:${(0.6 + n.w * 0.45).toFixed(2)}"/>`;
	}).join('');
	const sectorLabels = arcs.map(s => {
		const a = (s.a0 + s.a1) / 2, r = 372;
		const x = CX + Math.cos(a) * r * 1.14, y = CY + Math.sin(a) * r * 0.97;
		return `<text class="cn-sector" data-s="${s.key}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${Math.cos(a) > 0.25 ? 'start' : Math.cos(a) < -0.25 ? 'end' : 'middle'}">${esc(s.label.toUpperCase())}</text>`;
	}).join('');
	// pass 1: where each label wants to be
	for (const n of nodes) {
		const right = Math.cos(n.a) >= 0, rr = n.hub ? 9 : n.s === 'people' ? 17 : 5 + Math.min(4, n.w);
		const pole = Math.abs(Math.cos(n.a)) < 0.42, up = Math.sin(n.a) < 0;
		n.rr = rr; n.pole = pole;
		n.text = clip(n.label, pole ? 22 : n.s === 'people' || n.s === 'places' ? 30 : 32);
		n.lx = pole ? n.x : n.x + (right ? rr + 7 : -rr - 7);
		n.ly = pole ? (up ? n.y - rr - 7 : n.y + rr + 15) : n.y + 4;
		n.anchor = pole ? 'middle' : right ? 'start' : 'end';
	}
	// pass 2: greedy collision — a label that overlaps one already placed moves
	// away from the centre line in 15px steps (never more than six)
	const size = n => (n.s === 'people' ? 7.6 : 6.9) * n.text.length;
	const box = n => { const w = size(n); const x0 = n.anchor === 'start' ? n.lx : n.anchor === 'end' ? n.lx - w : n.lx - w / 2; return [x0 - 2, n.ly - 15, x0 + w + 2, n.ly + 5]; };
	const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
	// the dots themselves (and the centre medallion) are obstacles too
	const placed = [[CX - 66, CY - 66, CX + 66, CY + 66], ...nodes.map(n => [n.x - n.rr, n.y - n.rr, n.x + n.rr, n.y + n.rr])];
	for (const n of [...nodes].sort((a, b) => Math.abs(a.ly - CY) - Math.abs(b.ly - CY))) {
		const dir = n.ly < CY ? -1 : 1;
		for (let k = 0; k < 8 && placed.some(b => hit(box(n), b)); k++) n.ly += dir * 9;
		placed.push(box(n));
	}
	const nodeEls = nodes.map((n, i) => {
		const right = Math.cos(n.a) >= 0;
		const rr = n.hub ? 9 : n.s === 'people' ? 17 : 5 + Math.min(4, n.w);
		const img = n.s === 'people' && n.person.photo
			? `<clipPath id="cp${i}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${rr}"/></clipPath>
				<image class="cn-face" href="../../people/${esc(n.person.photo.src)}" x="${(n.x - rr * 1.6).toFixed(1)}" y="${(n.y - rr * 1.15).toFixed(1)}" width="${rr * 3.2}" height="${rr * 3.2 * n.person.photo.h / n.person.photo.w}" clip-path="url(#cp${i})" preserveAspectRatio="xMidYMin slice"/>`
			: '';
		const initials = n.s === 'people' && !n.person.photo ? `<text class="cn-init" x="${n.x.toFixed(1)}" y="${(n.y + 4).toFixed(1)}" text-anchor="middle">${esc(n.label.split(/\s+/).filter(w => /^\p{Lu}/u.test(w)).map(w => w[0]).slice(0, 2).join(''))}</text>` : '';
		// near the poles a label sits above (top) or below (bottom) its dot; elsewhere beside it
		return `<a class="cn-node" data-n="${i}" data-s="${n.s}" href="${esc(n.url || '#')}"${n.seek != null ? ` data-seek="${n.seek}"` : ''} aria-label="${esc(n.label)} — ${esc(n.why)}">
			<circle class="cn-dot${n.hub ? ' is-hub' : ''}" cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${rr}"/>${img}${initials}
			<text class="cn-label" x="${n.lx.toFixed(1)}" y="${n.ly.toFixed(1)}" text-anchor="${n.anchor}">${esc(n.text)}</text>
		</a>`;
	}).join('');
	return `<svg class="cn-sky" viewBox="0 0 ${W} ${H}" role="group" aria-label="Everything this broadcast is connected to">
		<g class="cn-rings" aria-hidden="true">${[1, 2, 3].map(k => `<ellipse cx="${CX}" cy="${CY}" rx="${RING[k] * 1.14}" ry="${RING[k] * 0.97}"/>`).join('')}</g>
		<g class="cn-edges" aria-hidden="true">${edges}</g>
		${sectorLabels}
		<g class="cn-nodes">${nodeEls}</g>
		<g class="cn-centre" aria-hidden="true">
			<clipPath id="cp-c"><circle cx="${CX}" cy="${CY}" r="58"/></clipPath>
			<circle class="cn-centre__ring" cx="${CX}" cy="${CY}" r="64"/>
			${rec.yt ? `<image href="${thumb(rec.yt, 'mqdefault')}" x="${CX - 104}" y="${CY - 58}" width="208" height="117" clip-path="url(#cp-c)" preserveAspectRatio="xMidYMid slice" class="cn-centre__img"/>` : `<circle cx="${CX}" cy="${CY}" r="58" class="cn-centre__field"/>`}
		</g>
	</svg>`;
}

function listHTML(nodes) {
	return SECTORS.filter(s => nodes.some(n => n.s === s.key)).map(s => `
		<section class="cn-list__sec" data-s="${s.key}"><h3 class="si-vid-h3">${esc(s.label)} <span class="si-tabular">${nodes.filter(n => n.s === s.key).length}</span></h3>
		<ul role="list">${nodes.map((n, i) => n.s === s.key ? `<li data-n="${i}">
			${n.url ? `<a href="${esc(n.url)}"${n.seek != null ? ` data-seek="${n.seek}"` : ''}>${esc(n.label)}</a>` : `<span>${esc(n.label)}</span>`}
			<span class="cn-why">${esc(n.why)}</span></li>` : '').join('')}</ul></section>`).join('');
}

function render(rec, nodes) {
	const s = rec.series, at = wantedTime();
	const counts = SECTORS.map(x => [x, nodes.filter(n => n.s === x.key).length]).filter(([, k]) => k);
	return `
	<article class="cn">
		<div class="si-wrap cn-top">
			<header class="cn-head">
				<p class="si-eyebrow si-eyebrow--ruled"><span>${esc(kindLabel(rec))}${s ? ` · No. ${s.ep}` : ''}</span></p>
				${titleHTML(rec)}
				<p class="si-vid-dateline"><span>${weekday(rec.date)}, ${fmtDate(rec.date)}</span>${rec.duration ? `<span>${human(rec.duration)}</span>` : ''}<span>${esc(LANG[rec.lang])}</span></p>
				${facadeHTML(rec, { start: at, size: 'hqdefault' })}
				<div class="cn-why-panel" aria-live="polite">
					<p class="si-vid-h3">${plural(nodes.length, 'connection')} the record can prove</p>
					<p class="cn-why-panel__body">Point at anything in the sky to see why it is there. Every line is a reason, not a recommendation.</p>
				</div>
			</header>
			<div class="cn-map">
				<div class="cn-filters si-js-only" role="group" aria-label="Show">
					${counts.map(([x, k]) => `<button type="button" class="si-chip" aria-pressed="true" data-f="${x.key}">${esc(x.label)} <span class="si-chip__count">${k}</span></button>`).join('')}
				</div>
				${nodes.length ? skySVG(rec, nodes) : ''}
			</div>
		</div>

		<section class="si-wrap si-vid-band cn-list" aria-labelledby="cn-l-h">
			<div class="si-vid-band__head"><h2 id="cn-l-h">Every connection, with its reason</h2>
			<p>The same sky as a list. People are matched against the 418 reviewed person records; “same words” is measured over the caption tracks; the fortnight and the series are counted from the publication dates.</p></div>
			<div class="cn-list__grid">${listHTML(nodes)}</div>
		</section>

		${bodyHTML(rec) ? `<section class="si-wrap si-vid-band cn-about"><div class="si-vid-band__head"><h2>As published with the video</h2></div>${bodyHTML(rec)}</section>` : ''}
		${ctaHTML(rec) ? `<section class="si-vid-night cn-cta"><div class="si-wrap">${ctaHTML(rec)}</div></section>` : ''}
		<section class="si-wrap si-vid-band cn-record"><div class="si-vid-band__head"><h2>The record</h2></div>${recordHTML(rec)}</section>
	</article>`;
}

function mount(rec, nodes) {
	mountTape(main);
	settleImages(main);
	reveal(main);
	const sky = main.querySelector('.cn-sky');
	if (!sky) return;
	const panel = main.querySelector('.cn-why-panel');
	const idle = panel.innerHTML;
	const focus = i => {
		sky.classList.toggle('is-focus', i != null);
		sky.querySelectorAll('.is-on').forEach(x => x.classList.remove('is-on'));
		main.querySelectorAll('.cn-list li.is-on').forEach(x => x.classList.remove('is-on'));
		if (i == null) { panel.innerHTML = idle; return; }
		const n = nodes[i];
		sky.querySelectorAll(`[data-n="${i}"]`).forEach(x => x.classList.add('is-on'));
		main.querySelector(`.cn-list li[data-n="${i}"]`)?.classList.add('is-on');
		panel.innerHTML = `<p class="si-vid-h3">${esc(SECTORS.find(s => s.key === n.s).label)}</p>
			<p class="cn-why-panel__title">${esc(n.label)}</p>
			<p class="cn-why-panel__body">${esc(n.why)}${n.detail ? `. ${esc(n.detail)}.` : ''}</p>
			${n.s === 'people' && n.person.at.length && rec.yt ? `<p class="cn-why-panel__at">${n.person.at.slice(0, 8).map(t => `<a class="si-vid-seek" href="${watchURL(rec.yt, t)}" data-seek="${t}">${hms(t)}</a>`).join('')}</p>` : ''}`;
	};
	let pinned = null;
	sky.querySelectorAll('.cn-node').forEach(a => {
		const i = +a.dataset.n;
		a.addEventListener('mouseenter', () => pinned == null && focus(i));
		a.addEventListener('focus', () => focus(i));
		a.addEventListener('mouseleave', () => pinned == null && focus(null));
		a.addEventListener('click', e => {
			if (a.dataset.seek != null) return;              // a place: plays this tape (mountTape)
			if (pinned !== i) { e.preventDefault(); pinned = i; focus(i); a.classList.add('is-pinned'); }
		});
	});
	document.addEventListener('keydown', e => { if (e.key === 'Escape') { pinned = null; focus(null); } });
	sky.addEventListener('click', e => { if (!e.target.closest('.cn-node')) { pinned = null; focus(null); } });

	// sector filters
	main.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
		const on = b.getAttribute('aria-pressed') !== 'true';
		b.setAttribute('aria-pressed', String(on));
		sky.querySelectorAll(`[data-s="${b.dataset.f}"]`).forEach(x => x.classList.toggle('is-off', !on));
	}));

	// the sky assembles itself once, from the centre out
	if (!reduceMotion) {
		sky.querySelectorAll('.cn-edge').forEach((p, k) => {
			const L = p.getTotalLength();
			p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
			p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 700, delay: 120 + k * 28, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
		});
		sky.querySelectorAll('.cn-node').forEach((g, k) => g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 300 + k * 28, fill: 'backwards' }));
	}
}
