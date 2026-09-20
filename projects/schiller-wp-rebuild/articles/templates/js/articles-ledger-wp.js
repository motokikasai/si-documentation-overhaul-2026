/* articles-ledger-wp.js — the Ledger, inside WordPress.
 *
 * The whole index is already in the document (template-parts/articles/ledger.php
 * prints every article, month by month), so there is no payload to fetch and
 * nothing to render. This module only:
 *
 *   filters   search / topic / year, by hiding rows and the months that empty
 *             out. The haystack was folded in PHP into data-q, so a search over
 *             2,463 rows is a substring test and needs no index;
 *   the loupe raises whichever line is under the pointer, built from the row's
 *             own data attributes — no second request;
 *   keyboard  "/" reaches the search field, ↑/↓ walk the index;
 *   the URL    carries the filters, so a view can be sent to a colleague.
 *
 * With JavaScript off the toolbar and the loupe are not shown (.si-js-only) and
 * the index itself is untouched.
 */
import { fold, esc, reduceMotion } from './articles-core.js';

const bar = document.querySelector('[data-bar]');
const list = document.querySelector('[data-list]');
const loupe = document.querySelector('[data-loupe]');
if (bar && list) {
	const rows = [...list.querySelectorAll('.lg-row')];
	const months = [...list.querySelectorAll('[data-month]')];
	const countEl = bar.querySelector('[data-count]');
	const total = Number(countEl?.dataset.total || rows.length);
	const input = bar.querySelector('[data-q]');
	const hint = loupe?.innerHTML || '';

	const state = Object.fromEntries(new URLSearchParams(location.search));
	const get = k => state[k] || '';

	/* ---- filtering -------------------------------------------------------- */
	function apply() {
		const terms = fold(get('q')).split(/\s+/).filter(Boolean);
		const topic = get('topic');
		const year = get('year');
		let shown = 0;
		for (const row of rows) {
			const ok = (!year || row.dataset.y === year)
				&& (!topic || row.dataset.tp.split(' ').includes(topic))
				&& (!terms.length || terms.every(t => row.dataset.q.includes(t)));
			row.hidden = !ok;
			if (ok) shown++;
		}
		for (const month of months) {
			month.hidden = !month.querySelector('.lg-row:not([hidden])');
		}
		if (countEl) {
			countEl.innerHTML = shown === total
				? `<b>${total.toLocaleString()}</b> ${countEl.dataset.word || 'articles'}`
				: `<b>${shown.toLocaleString()}</b> of ${total.toLocaleString()}`;
		}
		const dirty = !!(get('q') || topic || year);
		bar.querySelector('[data-reset]').hidden = !dirty;
		const url = new URLSearchParams();
		for (const k of ['q', 'topic', 'year']) if (get(k)) url.set(k, get(k));
		history.replaceState(null, '', location.pathname + (url.toString() ? '?' + url : ''));
	}

	let timer;
	input?.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => { state.q = input.value; apply(); }, 140);
	});
	bar.addEventListener('change', e => {
		const select = e.target.closest('[data-set]');
		if (!select) return;
		state[select.dataset.set] = select.value;
		apply();
	});
	bar.querySelector('[data-reset]')?.addEventListener('click', () => {
		state.q = state.topic = state.year = '';
		if (input) input.value = '';
		for (const s of bar.querySelectorAll('[data-set]')) s.value = '';
		apply();
	});
	addEventListener('keydown', e => {
		if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
			e.preventDefault();
			input?.focus();
			input?.select();
		}
	});
	// restore whatever the URL asked for
	if (input && get('q')) input.value = get('q');
	for (const s of bar.querySelectorAll('[data-set]')) {
		if (get(s.dataset.set)) s.value = get(s.dataset.set);
	}
	apply();

	/* ---- the loupe -------------------------------------------------------- */
	let live = null;
	function raise(row) {
		if (!loupe || row === live) return;
		live = row;
		list.querySelector('.lg-row.is-live')?.classList.remove('is-live');
		row.classList.add('is-live');
		const link = row.querySelector('a');
		const topics = row.querySelector('.tp')?.textContent.trim();
		loupe.innerHTML = `
			${row.dataset.g
				? `<span class="arc-thumb"><img src="${esc(row.dataset.g)}" alt="" loading="lazy" decoding="async"></span>`
				: '<span class="arc-thumb" aria-hidden="true"></span>'}
			<h2>${esc(link.querySelector('.t').textContent)}</h2>
			<hr class="si-rule si-rule--brass">
			<p class="meta">
				<span>${esc(row.dataset.d || '')}</span>
				${row.dataset.b ? `<span>· ${esc(row.dataset.b)}</span>` : ''}
				<span>· ${esc(row.querySelector('.m').textContent)}</span>
			</p>
			${row.dataset.x ? `<p>${esc(row.dataset.x)}</p>` : ''}
			${topics ? `<p class="meta"><span>${esc(topics)}</span></p>` : ''}`;
		const img = loupe.querySelector('img');
		if (img) img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
	}

	let frame;
	list.addEventListener('pointerover', e => {
		const row = e.target.closest('.lg-row');
		if (!row || row.hidden) return;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => raise(row));
	});
	list.addEventListener('focusin', e => {
		const row = e.target.closest('.lg-row');
		if (row) raise(row);
	});
	list.addEventListener('keydown', e => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		const links = rows.filter(r => !r.hidden).map(r => r.querySelector('a'));
		const i = links.indexOf(document.activeElement);
		if (i < 0) return;
		const next = links[i + (e.key === 'ArrowDown' ? 1 : -1)];
		if (next) { e.preventDefault(); next.focus({ preventScroll: reduceMotion }); }
	});
}
