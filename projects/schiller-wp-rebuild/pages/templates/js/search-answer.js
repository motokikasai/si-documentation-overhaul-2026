/* search-answer.js — Search, draft C "The Answer First".
 * The best match of each kind is set out first as a row of answer cards —
 * the person, the conference, the video, the article — because a query like
 * "Krafft Ehricke" is usually looking for one of each. The full list follows,
 * narrowed by a two-handled year range. */
import { esc, nf, fmtDate, mount, medallion, UPLOADS } from './pages-core.js';
import { search, mark, index, KINDS } from './search-core.js';

const q = new URLSearchParams(location.search).get('q') || 'Krafft Ehricke';
const [R, I] = await Promise.all([search(q), index()]);
const TL = Object.fromEntries(I.topics.map(t => [t.slug, t.label]));
const top = [['person', R.people[0]], ['conference', R.conferences[0]], ['video', R.videos[0]], ['article', R.articles[0]]].filter(([, r]) => r);
const ys = R.articles.map(a => +a.d.slice(0, 4));
const y0 = ys.length ? Math.min(...ys) : 2012, y1 = ys.length ? Math.max(...ys) : 2026;

function card([k, r]) {
	const head = `<p class="sc-kind">${KINDS[k]}</p>`;
	if (k === 'person') return `<a class="sc-card sc-card--p" href="${esc(r.u)}">${head}${r.photo ? medallion({ photo: r.photo, fx: 50, fy: 30 }, 72) : `<span class="si-medallion si-medallion--monogram" style="--size:72px" data-initials="${esc(r.t.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}"></span>`}<h2>${mark(esc(r.t), q)}</h2><p>${esc(r.role || '')}</p><small>${r.n} in the archive</small></a>`;
	if (k === 'conference') return `<a class="sc-card" href="${esc(r.u)}">${head}<p class="sc-date">${esc(fmtDate(r.d, 'month'))}</p><h2>${mark(esc(r.t), q)}</h2><p>${esc(r.where || '')}</p>${r.v ? `<small>${r.v} videos</small>` : ''}</a>`;
	if (k === 'video') return `<a class="sc-card sc-card--v" href="${esc(r.u)}">${head}<span class="sc-play" aria-hidden="true"></span><h2>${mark(esc(r.t), q)}</h2>${r.d ? `<small>${esc(fmtDate(r.d))}</small>` : ''}</a>`;
	return `<a class="sc-card sc-card--a" href="${esc(r.u)}">${head}${r.g ? `<img src="${UPLOADS}${esc(r.g)}" alt="" loading="lazy">` : ''}<h2>${mark(esc(r.t), q)}</h2><small>${esc(fmtDate(r.d))}</small></a>`;
}

mount(`
<div class="ct-container sc-wrap">
	<form class="sc-form" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" value="${esc(q)}" aria-label="Search"></label><button class="ct-button">Search</button></form>
	<p class="sc-try">Try: <a href="?q=Krafft+Ehricke">Krafft Ehricke</a> · <a href="?q=Oasis+Plan">Oasis Plan</a> · <a href="?q=Beethoven">Beethoven</a> · <a href="?q=Cheminade">Cheminade</a></p>
	${top.length ? `<section class="sc-best" aria-label="Best matches"><h1 class="sc-h">Best match for <em>${esc(q)}</em></h1><div class="sc-cards">${top.map(card).join('')}</div></section>` : `<p class="si-empty">Nothing found for “${esc(q)}”.</p>`}
	${R.articles.length ? `
	<section class="sc-rest">
		<header class="sc-rest__head">
			<h2>${nf(R.articles.length)} articles</h2>
			<div class="sc-range" style="--a:0;--b:1"><span class="sc-y0">${y0}</span><div class="sc-track"><i></i><input type="range" min="${y0}" max="${y1}" value="${y0}" aria-label="From year"><input type="range" min="${y0}" max="${y1}" value="${y1}" aria-label="To year"></div><span class="sc-y1">${y1}</span></div>
			<div class="si-segmented" role="group" aria-label="Order"><button type="button" data-o="rel" aria-pressed="true">Best first</button><button type="button" data-o="new" aria-pressed="false">Newest</button></div>
		</header>
		<ol class="sc-list"></ol>
	</section>` : ''}
</div>`, 'Search', 'search-answer.html');

const list = document.querySelector('.sc-list');
if (list) {
	const [a, b] = document.querySelectorAll('.sc-track input'), range = document.querySelector('.sc-range');
	let order = 'rel';
	const draw = () => {
		let lo = +a.value, hi = +b.value; if (lo > hi) [lo, hi] = [hi, lo];
		range.style.setProperty('--a', (lo - y0) / Math.max(1, y1 - y0)); range.style.setProperty('--b', (hi - y0) / Math.max(1, y1 - y0));
		document.querySelector('.sc-y0').textContent = lo; document.querySelector('.sc-y1').textContent = hi;
		let rs = R.articles.filter(r => +r.d.slice(0, 4) >= lo && +r.d.slice(0, 4) <= hi);
		if (order === 'new') rs = rs.slice().sort((x, y) => y.d.localeCompare(x.d));
		document.querySelector('.sc-rest__head h2').textContent = `${nf(rs.length)} articles`;
		list.innerHTML = rs.slice(0, 25).map(r => `<li><a href="${esc(r.u)}"><time>${esc(fmtDate(r.d, 'short'))}</time><div><h3>${mark(esc(r.t), q)}</h3>${r.x ? `<p>${mark(esc(r.x.slice(0, 150)), q)}…</p>` : ''}${r.tp?.length ? `<p class="sc-tp">${r.tp.map(t => esc(TL[t])).join(' · ')}</p>` : ''}</div></a></li>`).join('');
	};
	[a, b].forEach(i => i.addEventListener('input', draw));
	document.querySelector('.sc-rest .si-segmented').addEventListener('click', e => { const bt = e.target.closest('button'); if (!bt) return; order = bt.dataset.o; e.currentTarget.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === bt))); draw(); });
	draw();
}
