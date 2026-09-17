/* DRAFT C · The Chronicle */
import {
	loadPeople, esc, fold, medallion, settleImages, reveal,
	bindSlash, readState, writeState, bindProfiles, plural, reduceMotion,
	href,
	pixelSnap,
} from './people-core.js';

const $ = s => document.querySelector(s);
const DEFAULTS = { q: '', order: 'desc' };
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];

const { meta, people } = await loadPeople();
const byKey = new Map(people.map(p => [p.key, p]));
const state = readState(DEFAULTS);

/* ---- shape the chronicle: year -> conference -> people ------------------- */
const years = [];
for (let y = meta.first_year; y <= meta.last_year; y++) years.push(y);
const chron = new Map(years.map(y => [y, { confs: new Map(), other: [], all: new Set() }]));
for (const p of people) {
	const covered = new Set();
	for (const c of p.confs) {
		const Y = chron.get(+c.y);
		if (!Y) continue;
		if (!Y.confs.has(c.t)) Y.confs.set(c.t, []);
		Y.confs.get(c.t).push(p);
		Y.all.add(p);
		covered.add(+c.y);
	}
	for (const y of p.years) if (!covered.has(y) && chron.has(y)) { chron.get(y).other.push(p); chron.get(y).all.add(p); }
}
const undated = people.filter(p => !p.years.length);
const bySort = (a, b) => a.sort.localeCompare(b.sort);

// spelled out in English only; other languages keep the figure the server printed
$('[data-fig="years"]').textContent = document.documentElement.lang.startsWith('en') ? (WORDS[years.length] ?? years.length) : years.length;
$('[data-fig="count"]').textContent = meta.count;

/* ---- histogram ------------------------------------------------------------ */
const hist = $('[data-hist]');
const maxY = Math.max(...years.map(y => chron.get(y).all.size));
hist.innerHTML = years.map((y, i) => {
	const n = chron.get(y).all.size;
	return `<button class="chr-hist__bar" type="button" data-year="${y}" style="--v:${(n / maxY).toFixed(3)};--i:${i}" aria-label="${y}: ${plural(n, 'person', 'people')}">
		<i></i><b>${n}</b><span>${y}</span></button>`;
}).join('');
hist.addEventListener('click', e => {
	const b = e.target.closest('[data-year]');
	if (b) goTo(b.dataset.year);
});
requestAnimationFrame(() => requestAnimationFrame(() => hist.parentElement.classList.add('is-in')));

function goTo(y) {
	const el = document.getElementById(`y-${y}`);
	if (!el) return;
	el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
	history.replaceState(null, '', `${location.pathname}${location.search}#y-${y}`);
}

/* ---- toolbar -------------------------------------------------------------- */
const q = $('[data-q]');
q.value = state.q;
bindSlash(q);
pixelSnap(document.querySelector('.people-toolbar'));
let debounce;
q.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { state.q = q.value.trim(); render(); }, 120); });
document.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => { state.order = b.dataset.order; render(); }));

/* ---- render --------------------------------------------------------------- */
const root = $('[data-chronicle]');
const dial = $('[data-dial]');
const undatedEl = $('[data-undated]');
bindProfiles(root, byKey);
bindProfiles(undatedEl, byKey);

function mark(text, needle) {
	if (!needle) return esc(text);
	const f = fold(text);
	const at = f.indexOf(needle);
	if (at < 0 || f.length !== text.length) return esc(text);
	return `${esc(text.slice(0, at))}<mark>${esc(text.slice(at, at + needle.length))}</mark>${esc(text.slice(at + needle.length))}`;
}

function person(p, y, needle) {
	const first = p.years[0] === y && p.years.length > 1;
	const sub = p.aff || p.country || (p.years.length > 1 ? `Also ${p.years.filter(x => x !== y).slice(-3).join(', ')}` : '');
	return `<li><a href="${href(p)}" data-person="${esc(p.key)}">
		${medallion(p, 44, { fill: .5 })}
		<span><span class="si-name chr-person__name">${mark(p.name, needle)}${first ? '<span class="chr-first" title="First year in the archive">first</span>' : ''}</span>
		${sub ? `<span class="chr-person__sub">${mark(sub, needle)}</span>` : ''}</span>
	</a></li>`;
}

function render() {
	writeState(state, DEFAULTS);
	document.querySelectorAll('[data-order]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.order === state.order)));
	const needle = fold(state.q);
	// a person matches on who they are; a conference title matches its own roster
	// only — otherwise "Beethoven" would pull its speakers into every year they spoke
	const hit = p => !needle || p.who.includes(needle);
	const order = state.order === 'asc' ? years : [...years].reverse();
	const shownKeys = new Set();

	const html = order.map(y => {
		const Y = chron.get(y);
		const confs = [...Y.confs].map(([t, ps]) => {
			const titleHit = needle && fold(t).includes(needle);
			const list = (titleHit ? ps : ps.filter(hit)).sort(bySort);
			return [t, list];
		}).filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
		const other = Y.other.filter(hit).sort(bySort);
		const n = new Set([...confs.flatMap(([, l]) => l), ...other]).size;
		if (!n) return '';
		confs.forEach(([, l]) => l.forEach(p => shownKeys.add(p.key)));
		other.forEach(p => shownKeys.add(p.key));
		const debuts = [...new Set([...confs.flatMap(([, l]) => l), ...other])].filter(p => p.years[0] === y).length;
		return `<section class="chr-year" id="y-${y}" aria-labelledby="yh-${y}">
			<h2 class="chr-year__num" id="yh-${y}">${y}<small><b>${plural(n, 'voice', 'voices')}</b><br>${y === meta.first_year ? 'the archive begins' : `${debuts} heard for the first time`}</small></h2>
			<div class="chr-year__body">
				${confs.map(([t, l]) => `<article class="chr-conf si-reveal">
					<h3 class="chr-conf__title">${mark(t, needle)}</h3>
					<p class="si-meta chr-conf__meta">${plural(l.length, 'speaker', 'speakers')} in the archive</p>
					<ul class="chr-people">${l.map(p => person(p, y, needle)).join('')}</ul>
				</article>`).join('')}
				${other.length ? `<article class="chr-conf chr-conf--other si-reveal">
					<h3 class="chr-conf__title">${confs.length ? `Also heard in ${y}` : `Heard in ${y}`}</h3>
					<p class="si-meta chr-conf__meta">In articles and recordings not yet tied to a conference</p>
					<ul class="chr-people">${other.map(p => person(p, y, needle)).join('')}</ul>
				</article>` : ''}
			</div>
		</section>`;
	}).join('');

	const und = undated.filter(hit).sort(bySort);
	und.forEach(p => shownKeys.add(p.key));
	$('[data-undated-wrap]').hidden = !und.length;
	undatedEl.innerHTML = und.map(p => `<a href="${href(p)}" data-person="${esc(p.key)}">${mark(p.name, needle)}</a>`).join('<span class="sep" aria-hidden="true">·</span> ');

	root.removeAttribute('aria-busy');
	root.innerHTML = html || `<div class="si-empty"><p>Nothing in the chronicle matches “${esc(state.q)}”.</p></div>`;
	$('[data-count]').innerHTML = !needle ? `<b>${people.length}</b> people` : `<b>${shownKeys.size}</b> of ${people.length}`;

	dial.innerHTML = order.map(y => `<a href="#y-${y}" data-year="${y}"${root.querySelector(`#y-${y}`) ? '' : ' class="is-empty" tabindex="-1"'}>${y}</a>`).join('');
	settleImages(root);
	reveal(root);
	spy();
}

dial.addEventListener('click', e => {
	const a = e.target.closest('[data-year]');
	if (!a) return;
	e.preventDefault();
	goTo(a.dataset.year);
});

/* ---- scroll-spy: dial + histogram follow the reader ---------------------- */
let io;
function spy() {
	io?.disconnect();
	const visible = new Set();
	io = new IntersectionObserver(entries => {
		for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
		const current = [...root.querySelectorAll('.chr-year')].find(s => visible.has(s.id))?.id.slice(2);
		document.querySelectorAll('[data-year]').forEach(el => el.setAttribute('aria-current', String(el.dataset.year === current)));
		const a = dial.querySelector(`a[data-year="${current}"]`);
		if (a && dial.scrollWidth > dial.clientWidth) dial.scrollTo({ left: a.offsetLeft - dial.clientWidth / 2, behavior: 'smooth' });
	}, { rootMargin: '-35% 0px -55% 0px' });
	root.querySelectorAll('.chr-year').forEach(s => io.observe(s));
}

render();
if (location.hash.startsWith('#y-')) requestAnimationFrame(() => goTo(location.hash.slice(3)));
