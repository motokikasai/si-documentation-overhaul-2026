/* DRAFT B · The Gallery */
import {
	loadPeople, esc, fold, yearSpan, descriptor, medallion, plate, settleImages, reveal,
	bindSlash, readState, writeState, bindProfiles, transition, plural, reduceMotion,
	href,
	pixelSnap,
} from './people-core.js';
import { enhanceSelect } from './si-select.js';

const $ = s => document.querySelector(s);
const PAGE = 48;
const DEFAULTS = { q: '', country: '', sort: 'az', show: 'all' };

const { meta, people } = await loadPeople();
people.forEach((p, i) => { p.idx = i; });
const byKey = new Map(people.map(p => [p.key, p]));
const state = readState(DEFAULTS);

$('[data-fig="count"]').textContent = meta.count;
$('[data-fig="countries"]').textContent = meta.countries;

/* ---- banner drift --------------------------------------------------------- */
{
	const faces = people.filter(p => p.photo && p.photo.fs);
	const half = Math.ceil(faces.length / 2);
	const rows = [faces.slice(0, half), faces.slice(half)];
	document.querySelectorAll('[data-drift]').forEach((row, r) => {
		const set = rows[r].map(p => medallion(p, 92, { fill: .5 })).join('');
		row.innerHTML = set + set;          // doubled for a seamless -50% loop
	});
	// the banner is decorative: never let its 260 images compete with content
	document.querySelectorAll('.gal-drift img').forEach(img => { img.loading = 'lazy'; img.fetchPriority = 'low'; });
}

/* ---- principal voices ---------------------------------------------------- */
{
	const list = $('[data-principal]');
	const principal = people.filter(p => p.photo && p.n >= 6).sort((a, b) => b.n - a.n).slice(0, 12);
	list.innerHTML = principal.map((p, i) => `
		<li class="si-reveal" style="--i:${i}">
			<a class="gal-plate" href="${href(p)}" data-person="${esc(p.key)}">
				<span style="position:relative;display:block">${plate(p, { ar: 0.8, fill: 0.26, eager: i < 4 })}<span class="gal-plate__rank" aria-hidden="true">${i + 1}</span></span>
				<span class="si-name gal-plate__name">${esc(p.name)}</span>
				<span class="si-meta gal-plate__meta">${plural(p.n, 'appearance', 'appearances')} · ${yearSpan(p.years)}</span>
				${p.aff ? `<span class="gal-plate__aff">${esc(p.aff)}</span>` : ''}
			</a>
		</li>`).join('');
	bindProfiles(list, byKey);

	const [prev, next] = document.querySelectorAll('[data-scroll-ctrl] button');
	const step = dir => list.scrollBy({ left: dir * list.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
	prev.onclick = () => step(-1);
	next.onclick = () => step(1);
	const sync = () => {
		prev.disabled = list.scrollLeft < 4;
		next.disabled = list.scrollLeft + list.clientWidth > list.scrollWidth - 4;
	};
	list.addEventListener('scroll', sync, { passive: true });
	addEventListener('resize', sync);
	sync();
}

/* ---- filters --------------------------------------------------------------- */
const decades = [...new Set(people.flatMap(p => p.years.map(y => Math.floor(y / 10) * 10)))].sort((a, b) => b - a);
const CHIPS = [
	['all', 'Everyone', () => true],
	['portrait', 'With portrait', p => !!p.photo],
	['returning', 'Heard more than once', p => p.n > 1],
	...decades.map(d => [`${d}s`, `The ${d}s`, p => p.years.some(y => y >= d && y < d + 10)]),
];
const chipsEl = $('[data-chips]');
chipsEl.innerHTML = CHIPS.map(([id, label, test]) =>
	`<button class="si-chip" type="button" data-show="${id}" aria-pressed="false">${label} <span class="si-chip__count">${people.filter(test).length}</span></button>`).join('');
chipsEl.addEventListener('click', e => {
	const b = e.target.closest('[data-show]');
	if (!b) return;
	state.show = b.dataset.show;
	apply();
});

const q = $('[data-q]');
const countrySel = $('[data-country]');
const sortSel = $('[data-sort]');
const counts = new Map();
for (const p of people) if (p.country) counts.set(p.country, (counts.get(p.country) || 0) + 1);
countrySel.insertAdjacentHTML('beforeend', [...counts].sort((a, b) => a[0].localeCompare(b[0]))
	.map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`).join(''));
q.value = state.q; countrySel.value = state.country; sortSel.value = state.sort;
enhanceSelect(countrySel);
enhanceSelect(sortSel);
bindSlash(q);
pixelSnap(document.querySelector('.people-toolbar'));

let debounce;
q.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { state.q = q.value.trim(); apply(); }, 120); });
countrySel.addEventListener('change', () => { state.country = countrySel.value; apply(); });
sortSel.addEventListener('change', () => { state.sort = sortSel.value; apply(); });

/* ---- the grid, paged ------------------------------------------------------ */
const grid = $('[data-grid]');
const more = $('[data-more]');
const sentinel = $('[data-sentinel]');
bindProfiles(grid, byKey);
let list = [], rendered = 0, needle = '';

function card(p, i) {
	const hl = s => {
		if (!needle) return esc(s);
		const at = fold(s).indexOf(needle);   // fold keeps length for Latin/Cyrillic names
		return at < 0 || fold(s).length !== s.length ? esc(s)
			: `${esc(s.slice(0, at))}<mark>${esc(s.slice(at, at + needle.length))}</mark>${esc(s.slice(at + needle.length))}`;
	};
	const foot = [p.years.length ? `<span>${yearSpan(p.years)}</span>` : '', p.n > 1 ? `<span class="gal-card__heard">${p.n}×</span>` : ''].filter(Boolean).join('<span aria-hidden="true">·</span>');
	// only the first screenful gets a transition name: that is what the eye tracks
	const vt = i < 24 ? ` style="view-transition-name:vt-${p.idx};--i:${i % PAGE}"` : ` style="--i:${i % PAGE}"`;
	return `<li class="gal-card si-reveal"${vt}><a href="${href(p)}" data-person="${esc(p.key)}">
		${medallion(p, 104)}
		<span class="si-name gal-card__name">${hl(p.name)}</span>
		<span class="gal-card__desc">${hl(descriptor(p, { year: false }))}</span>
		<span class="gal-card__foot">${foot}</span>
	</a></li>`;
}

function renderMore(n = PAGE) {
	const next = list.slice(rendered, rendered + n);
	grid.querySelectorAll('.gal-card--ghost').forEach(g => g.remove());
	grid.insertAdjacentHTML('beforeend', next.map((p, k) => card(p, rendered + k)).join(''));
	rendered += next.length;
	const remaining = list.length - rendered;
	more.hidden = remaining <= 0;
	$('[data-shown]').textContent = `Showing ${rendered} of ${list.length}`;
	if (remaining > 0) {
		// ghosts hold the space the next page will fill, so the sentinel does not jump
		grid.insertAdjacentHTML('beforeend', Array.from({ length: Math.min(4, remaining) }, () =>
			`<li class="gal-card gal-card--ghost" aria-hidden="true"><div><span class="si-skeleton"></span><span class="si-skeleton" style="width:60%;height:14px"></span><span class="si-skeleton" style="width:44%;height:12px"></span></div></li>`).join(''));
	}
	settleImages(grid);
	reveal(grid);
	// an observer only fires on change: if the sentinel is still near, keep filling
	requestAnimationFrame(() => {
		if (rendered < list.length && sentinel.getBoundingClientRect().top < innerHeight + 600) renderMore();
	});
}

function apply() {
	writeState(state, DEFAULTS);
	chipsEl.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.show === state.show)));
	needle = fold(state.q);
	const test = (CHIPS.find(c => c[0] === state.show) || CHIPS[0])[2];
	list = people.filter(p => test(p) && (!needle || p.hay.includes(needle)) && (!state.country || p.country === state.country));
	if (state.sort === 'heard') list.sort((a, b) => b.n - a.n || a.sort.localeCompare(b.sort));
	if (state.sort === 'recent') list.sort((a, b) => (b.years.at(-1) ?? 0) - (a.years.at(-1) ?? 0) || b.n - a.n);

	$('[data-count]').innerHTML = list.length === people.length ? `<b>${people.length}</b> people` : `<b>${list.length}</b> of ${people.length}`;

	transition(() => {
		document.querySelector('[data-grid-baseline]')?.remove();   // WordPress's no-JS list
		grid.hidden = false;
		grid.removeAttribute('aria-busy');
		rendered = 0;
		grid.innerHTML = '';
		if (!list.length) {
			grid.innerHTML = `<li class="si-empty" style="grid-column:1/-1"><p>No one matches these filters.</p><p><button class="ct-button" type="button" data-reset>Show everyone</button></p></li>`;
			grid.querySelector('[data-reset]').onclick = () => {
				Object.assign(state, DEFAULTS); q.value = ''; countrySel.value = ''; sortSel.value = 'az'; apply();
			};
			more.hidden = true;
			return;
		}
		renderMore();
		// in a view transition the new cards are already in view: show them at once
		if (document.startViewTransition && !reduceMotion) grid.querySelectorAll('.si-reveal').forEach(el => el.classList.add('is-in'));
	});
}

$('[data-show-all]').onclick = () => renderMore(list.length);
new IntersectionObserver(entries => {
	if (entries[0].isIntersecting && rendered < list.length) renderMore();
}, { rootMargin: '600px 0px' }).observe(sentinel);

apply();
reveal();
settleImages();
