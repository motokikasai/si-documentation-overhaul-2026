/* search-catalogue.js — Search, draft A "The Catalogue".
 * Results sorted into drawers by kind — Articles, People, Conferences, Videos —
 * like a library catalogue. "All" shows the head of each drawer; picking a kind
 * shows the whole drawer with its facets (language, subject, year). */
import { esc, nf, fmtDate, mount, UPLOADS } from './pages-core.js';
import { search, mark, index, KINDS } from './search-core.js';

const q = new URLSearchParams(location.search).get('q') || 'Oasis Plan';
const [R, I] = await Promise.all([search(q), index()]);
const TL = Object.fromEntries(I.topics.map(t => [t.slug, t.label]));
const LANG = { en: 'English', de: 'Deutsch', ru: 'Русский', 'zh-hans': '中文', zh: '中文', fr: 'Français' };
const GROUPS = [['articles', 'Articles'], ['people', 'People'], ['conferences', 'Conferences'], ['videos', 'Videos']];
const total = GROUPS.reduce((n, [k]) => n + R[k].length, 0);
const st = { kind: 'all', lang: null, topic: null, year: null };

const row = (r) => {
	if (r.kind === 'article') return `<li class="sa-r"><a href="${esc(r.u)}">${r.g ? `<img src="${UPLOADS}${esc(r.g)}" alt="" loading="lazy">` : '<span class="sa-noimg"></span>'}<div><p class="sa-meta">${esc(fmtDate(r.d))} · ${esc(LANG[r.l] || r.l)}${r.tp?.length ? ' · ' + r.tp.map(t => esc(TL[t])).join(', ') : ''}</p><h3>${mark(esc(r.t), q)}</h3>${r.x ? `<p>${mark(esc(r.x), q)}…</p>` : ''}</div></a></li>`;
	if (r.kind === 'person') return `<li class="sa-r sa-r--p"><a href="${esc(r.u)}">${r.photo ? `<span class="si-medallion" style="--size:52px"><img class="si-medallion__img is-loaded" data-focus style="width:100%;height:100%;left:0;top:0;object-fit:cover" src="../../${esc(r.photo)}" alt=""></span>` : `<span class="si-medallion si-medallion--monogram" style="--size:52px" data-initials="${esc(r.t.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}"></span>`}<div><h3>${mark(esc(r.t), q)}</h3><p>${esc(r.role || '')}${r.n ? ` · ${r.n} in the archive` : ''}</p></div></a></li>`;
	if (r.kind === 'conference') return `<li class="sa-r sa-r--c"><a href="${esc(r.u)}"><time>${esc(fmtDate(r.d, 'month'))}</time><div><h3>${mark(esc(r.t), q)}</h3><p>${esc(r.where || '')}${r.v ? ` · ${r.v} videos` : ''}</p></div></a></li>`;
	return `<li class="sa-r sa-r--v"><a href="${esc(r.u)}"><span class="sa-play" aria-hidden="true"></span><div><p class="sa-meta">${r.d ? esc(fmtDate(r.d)) : ''}</p><h3>${mark(esc(r.t), q)}</h3></div></a></li>`;
};

function filtered(k) {
	let rs = R[k];
	if (k === 'articles') rs = rs.filter(r => (!st.lang || r.l === st.lang) && (!st.topic || r.tp?.includes(st.topic)) && (!st.year || r.d.startsWith(st.year)));
	return rs;
}
function facets() {
	if (st.kind !== 'articles') return '';
	const c = (f) => { const m = {}; R.articles.forEach(r => f(r).forEach(v => { m[v] = (m[v] || 0) + 1; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
	const chip = (key, v, label, n) => `<button class="si-chip" data-f="${key}" data-v="${esc(v)}" aria-pressed="${st[key] === v}">${esc(label)} <span class="si-chip__count">${n}</span></button>`;
	return `<div class="sa-facets">
		<div><p>Language</p><div class="si-chips">${c(r => [r.l]).map(([v, n]) => chip('lang', v, LANG[v] || v, n)).join('')}</div></div>
		<div><p>Subject</p><div class="si-chips">${c(r => r.tp || []).slice(0, 6).map(([v, n]) => chip('topic', v, TL[v], n)).join('')}</div></div>
		<div><p>Year</p><div class="si-chips">${c(r => [r.d.slice(0, 4)]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8).map(([v, n]) => chip('year', v, v, n)).join('')}</div></div>
	</div>`;
}
function body() {
	if (st.kind === 'all') return GROUPS.filter(([k]) => R[k].length).map(([k, label]) => `
		<section class="sa-group"><header><h2>${label} <span>${nf(R[k].length)}</span></h2>${R[k].length > 3 ? `<button class="si-link sa-more" data-k="${k}">All ${nf(R[k].length)} ${label.toLowerCase()} →</button>` : ''}</header>
		<ol class="sa-list">${R[k].slice(0, 3).map(row).join('')}</ol></section>`).join('') || `<p class="si-empty">Nothing found for “${esc(q)}”.</p>`;
	const rs = filtered(st.kind);
	return `${facets()}<p class="sa-count">${nf(rs.length)} ${GROUPS.find(g => g[0] === st.kind)[1].toLowerCase()}</p><ol class="sa-list">${rs.slice(0, 30).map(row).join('')}</ol>${rs.length > 30 ? `<p class="sa-count">Showing 30 of ${nf(rs.length)} <span class="pg-ph-inline">pagination</span></p>` : ''}`;
}

mount(`
<div class="ct-container sa-wrap">
	<form class="sa-form" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" value="${esc(q)}" aria-label="Search"></label><button class="ct-button">Search</button></form>
	<p class="sa-sum"><b>${nf(total)}</b> results for <b>“${esc(q)}”</b></p>
	<nav class="sa-tabs" aria-label="Kind">${[['all', 'All', total], ...GROUPS.map(([k, l]) => [k, l, R[k].length])].map(([k, l, n]) => `<button data-k="${k}" aria-pressed="${k === 'all'}"${n ? '' : ' disabled'}>${l} <span>${nf(n)}</span></button>`).join('')}</nav>
	<div class="sa-body"></div>
</div>`, 'Search', 'search-catalogue.html');

const bodyEl = document.querySelector('.sa-body');
const paint = () => { bodyEl.innerHTML = body(); document.querySelectorAll('.sa-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === st.kind))); };
document.querySelector('.sa-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { st.kind = b.dataset.k; paint(); } });
bodyEl.addEventListener('click', e => {
	const m = e.target.closest('.sa-more'); if (m) { st.kind = m.dataset.k; paint(); return; }
	const c = e.target.closest('.si-chip'); if (c) { st[c.dataset.f] = st[c.dataset.f] === c.dataset.v ? null : c.dataset.v; paint(); }
});
paint();
