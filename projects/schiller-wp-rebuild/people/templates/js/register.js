/* DRAFT A · The Register */
import {
	loadPeople, esc, fold, splitSort, yearSpan, medallion, settleImages, reveal,
	bindSlash, readState, writeState, bindProfiles, plural, reduceMotion,
	href,
	pixelSnap,
} from './people-core.js';
import { enhanceSelect } from './si-select.js';

const $ = s => document.querySelector(s);
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DEFAULTS = { q: '', sort: 'az', country: '' };

const { meta, people } = await loadPeople();
const byKey = new Map(people.map(p => [p.key, p]));
const state = readState(DEFAULTS);
const maxN = Math.max(...people.map(p => p.n));

/* letter bucket: Latin letters as themselves; any other script's initial
   gathers under that script's section (Cyrillic here), '#' for the rest. */
const bucket = p => LATIN.includes(p.letter) ? p.letter : /\p{Script=Cyrillic}/u.test(p.letter) ? 'А–Я' : '#';
const BUCKETS = [...LATIN, 'А–Я', '#'];

/* ---- banner: figures + cameo stack --------------------------------------- */
$('[data-fig="count"]').textContent = meta.count;
$('[data-fig="countries"]').textContent = meta.countries;
$('[data-fig="span"]').textContent = `${meta.first_year}–${String(meta.last_year).slice(2)}`;
{
	const stack = $('[data-stack]');
	// prefer portraits with a known focal point; fall back to any portrait; none → no stack
	const withPhoto = people.filter(p => p.photo).sort((a, b) => (b.photo.fs ? 1 : 0) - (a.photo.fs ? 1 : 0) || b.n - a.n);
	const faces = withPhoto.slice(0, 7);
	if (!faces.length) stack.hidden = true;
	else stack.innerHTML = faces.map((p, i) => medallion(p, 58, { eager: true, fill: .5 }).replace('style="', `style="--i:${i};`)).join('')
		+ `<span class="reg-stack__more">and ${meta.count - faces.length} more</span>`;
	requestAnimationFrame(() => requestAnimationFrame(() => stack.classList.add('is-in')));
	settleImages(stack);
}

/* ---- toolbar -------------------------------------------------------------- */
const q = $('[data-q]');
const countrySel = $('[data-country]');
const counts = new Map();
for (const p of people) if (p.country) counts.set(p.country, (counts.get(p.country) || 0) + 1);
countrySel.insertAdjacentHTML('beforeend', [...counts].sort((a, b) => a[0].localeCompare(b[0]))
	.map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`).join(''));

q.value = state.q;
countrySel.value = state.country;
enhanceSelect(countrySel);
bindSlash(q);
pixelSnap(document.querySelector('.people-toolbar'));

q.addEventListener('input', () => { state.q = q.value.trim(); update(); });
countrySel.addEventListener('change', () => { state.country = countrySel.value; update(); });
document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
	state.sort = b.dataset.sort; update(true);
}));

/* ---- render -------------------------------------------------------------- */
const list = $('[data-register]');
const alpha = $('[data-alpha]');
bindProfiles(list, byKey);

function highlight(text, needle) {
	if (!needle) return esc(text);
	// fold char-by-char so indices map back to the original string
	let folded = '', map = [];
	for (let i = 0; i < text.length; i++) {
		const f = fold(text[i]);
		for (const ch of f) { folded += ch; map.push(i); }
	}
	const at = folded.indexOf(needle);
	if (at < 0) return esc(text);
	const s = map[at], e = map[at + needle.length - 1] + 1;
	return `${esc(text.slice(0, s))}<mark>${esc(text.slice(s, e))}</mark>${esc(text.slice(e))}`;
}

function row(p, needle, ranked) {
	const { surname, given } = splitSort(p.sort);
	const desc = [p.aff || (p.confs[0] ? p.confs[0].t : ''), p.country].filter(Boolean).join(' · ');
	const yrs = p.years.length ? yearSpan(p.years) : '';
	const right = ranked
		? `<span class="reg-years"><b>${p.n}</b>× <span class="reg-bar" style="--w:${Math.round(p.n / maxN * 100)}"></span></span>`
		: `<span class="reg-years si-tabular">${[yrs, p.n > 1 ? `<b>${p.n}</b>×` : ''].filter(Boolean).join(' · ')}</span>`;
	return `<li class="reg-row"><a href="${href(p)}" data-person="${esc(p.key)}">
		<span class="reg-name"><span class="reg-surname">${highlight(surname, needle)}</span>${given ? `, <span class="reg-given">${highlight(given, needle)}</span>` : ''}</span>
		<span class="reg-leader" aria-hidden="true"></span>
		${right}
		<span class="reg-desc">${highlight(desc, needle)}</span>
	</a></li>`;
}

function update(sortChanged = false) {
	writeState(state, DEFAULTS);
	document.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
	const needle = fold(state.q);
	const shown = people.filter(p => (!needle || p.hay.includes(needle)) && (!state.country || p.country === state.country));

	$('[data-count]').innerHTML = shown.length === people.length
		? `<b>${people.length}</b> people`
		: `<b>${shown.length}</b> of ${people.length}`;

	list.removeAttribute('aria-busy');
	if (!shown.length) {
		list.innerHTML = `<div class="si-empty"><p>No one in the register matches “${esc(state.q)}”${state.country ? ` in ${esc(state.country)}` : ''}.</p><p><button class="ct-button" type="button" data-reset>Clear the search</button></p></div>`;
		list.querySelector('[data-reset]').onclick = () => { q.value = ''; countrySel.value = ''; state.q = ''; state.country = ''; update(); q.focus(); };
		alpha.hidden = true;
		return;
	}

	if (state.sort === 'az') {
		const groups = new Map(BUCKETS.map(b => [b, []]));
		for (const p of shown) groups.get(bucket(p)).push(p);
		list.innerHTML = [...groups].filter(([, g]) => g.length).map(([b, g]) => `
			<section class="reg-letter" id="letter-${encodeURIComponent(b)}" aria-labelledby="lh-${encodeURIComponent(b)}">
				<div class="reg-letter__head"><h2 class="reg-letter__glyph" id="lh-${encodeURIComponent(b)}"${b.length > 1 ? ' data-wide' : ''}>${b}<small>${plural(g.length, 'name', 'names')}</small></h2></div>
				<ul class="reg-rows">${g.map(p => row(p, needle)).join('')}</ul>
			</section>`).join('');
		alpha.hidden = false;
		alpha.innerHTML = BUCKETS.map(b => groups.get(b).length
			? `<a href="#letter-${encodeURIComponent(b)}" aria-label="${b}, ${plural(groups.get(b).length, 'name', 'names')}">${b}</a>`
			: `<span aria-hidden="true">${b}</span>`).join('');
		spy();
	} else {
		const ranked = [...shown].sort(state.sort === 'heard'
			? (a, b) => b.n - a.n || a.sort.localeCompare(b.sort)
			: (a, b) => (b.years.at(-1) ?? 0) - (a.years.at(-1) ?? 0) || b.n - a.n);
		const heading = state.sort === 'heard' ? 'Most heard in the archive' : 'Most recently heard';
		list.innerHTML = `<section class="reg-letter" aria-labelledby="lh-ranked">
			<div class="reg-letter__head"><h2 class="reg-letter__glyph" id="lh-ranked">${state.sort === 'heard' ? '№' : '↓'}<small>${heading}</small></h2></div>
			<ol class="reg-rows reg-rows--ranked">${ranked.map(p => state.sort === 'heard' ? row(p, needle, true) : row(p, needle)).join('')}</ol>
		</section>`;
		alpha.hidden = true;
	}
	if (sortChanged) {
		const top = list.getBoundingClientRect().top + scrollY - 200;
		if (scrollY > top) scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
	}
}

/* ---- scroll-spy for the alphabet ----------------------------------------- */
let spyIO;
function spy() {
	spyIO?.disconnect();
	const links = new Map([...alpha.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
	const visible = new Set();
	spyIO = new IntersectionObserver(entries => {
		for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
		const first = [...links.keys()].find(id => visible.has(id));
		links.forEach((a, id) => a.setAttribute('aria-current', String(id === first)));
		const cur = links.get(first);
		if (cur && alpha.scrollWidth > alpha.clientWidth) alpha.scrollTo({ left: cur.offsetLeft - alpha.clientWidth / 2, behavior: 'smooth' });
	}, { rootMargin: '-30% 0px -60% 0px' });
	list.querySelectorAll('.reg-letter').forEach(s => spyIO.observe(s));
}

/* ---- portrait loupe ------------------------------------------------------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
	const loupe = $('[data-loupe]');
	let key = null, x = -200, y = -200, tx = x, ty = y, raf = 0;
	const tick = () => {
		x += (tx - x) * (reduceMotion ? 1 : 0.22);
		y += (ty - y) * (reduceMotion ? 1 : 0.22);
		loupe.style.setProperty('--x', `${x}px`);
		loupe.style.setProperty('--y', `${y}px`);
		raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
	};
	list.addEventListener('pointermove', e => {
		const a = e.target.closest('a[data-person]');
		const p = a && byKey.get(a.dataset.person);
		if (!p?.photo) { loupe.classList.remove('is-on'); key = null; return; }
		if (key !== p.key) {
			key = p.key;
			loupe.innerHTML = medallion(p, 132, { eager: true, fill: .46 }).replace('si-medallion"', 'si-medallion is-vivid"');
			settleImages(loupe);
			if (!loupe.classList.contains('is-on')) { x = e.clientX + 28; y = e.clientY - 150; }
		}
		loupe.classList.add('is-on');
		// sit to the right of the pointer; flip left near the viewport edge
		tx = e.clientX + (e.clientX > innerWidth - 200 ? -170 : 28);
		ty = Math.max(90, e.clientY - 150);
		if (!raf) raf = requestAnimationFrame(tick);
	});
	list.addEventListener('pointerleave', () => { loupe.classList.remove('is-on'); key = null; });
}

update();
reveal();
