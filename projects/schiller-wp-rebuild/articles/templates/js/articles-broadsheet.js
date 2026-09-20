/* articles-broadsheet.js — COLLECTION DRAFT C, "The Broadsheet".
 *
 * The page sets ONE month as a front page and lets you walk the archive
 * edition by edition. Three decisions worth naming:
 *
 *  THE LEAD    the month's longest article, not its newest. Over fourteen
 *              years "newest" is arbitrary — a 7,000-word feature and a
 *              three-line notice both land on a Tuesday — and length is the
 *              only weight the data actually carries. An editor would override
 *              this; in WordPress that is a sticky post, which this reads first.
 *  THE COLUMNS the month's remaining articles, grouped by their reviewed
 *              topic. Articles with no topic are not hidden: they run in a
 *              final column headed with the month itself.
 *  THIN MONTHS 2012 published one article all year. The composition degrades
 *              in order — lead, then tier, then columns — and says how many
 *              articles the edition actually holds rather than padding it.
 */
import {
	esc, thumbHTML, settleImages, fmtDay, fmtFull, fmtMonth, n,
	LANG_LABEL, LANG_TAG,
} from './articles-core.js';
import { loadIndex } from './articles-load.js';

const main = document.getElementById('main');
const data = await loadIndex();
const TOPIC = Object.fromEntries(data.topics.map(t => [t.slug, t.label]));

const params = new URLSearchParams(location.search);
let lang = params.get('lang') || 'en';
let month = params.get('m') || '';

main.innerHTML = `
<div class="ct-container">
	<header class="bs-masthead">
		<h1><span>The International Schiller Institute</span>Articles</h1>
		<p class="bs-edition" data-edition></p>
	</header>
</div>
<div class="bs-bar"><div class="ct-container bs-bar__in">
	<button class="bs-step" type="button" data-step="-1" aria-label="Previous edition">←</button>
	<select data-months aria-label="Edition"></select>
	<button class="bs-step" type="button" data-step="1" aria-label="Next edition">→</button>
	<select data-lang aria-label="Language">
		${data.langs.map(l => `<option value="${esc(l.slug)}"${l.slug === lang ? ' selected' : ''}>${esc(LANG_LABEL[l.slug] || l.slug)} (${n(l.n)})</option>`).join('')}
	</select>
	<button class="bs-latest" type="button" data-latest hidden>Back to the latest edition</button>
</div></div>
<div class="ct-container bs" data-page></div>
<div class="ct-container bs-issues">
	<h2>Back issues</h2>
	<ul class="bs-years" data-issues></ul>
	<p class="arc-note" data-note></p>
</div>`;

const page = main.querySelector('[data-page]');
const monthSel = main.querySelector('[data-months]');
const edition = main.querySelector('[data-edition]');
const issues = main.querySelector('[data-issues]');

/* ---- editions -------------------------------------------------------------- */
let months = [], byMonth = new Map();

function index() {
	byMonth = new Map();
	for (const it of data.items) {
		if (it.l !== lang) continue;
		(byMonth.get(it.mo) || byMonth.set(it.mo, []).get(it.mo)).push(it);
	}
	months = [...byMonth.keys()].sort();
	if (!months.includes(month)) month = months[months.length - 1];
	monthSel.innerHTML = [...months].reverse().map(m =>
		`<option value="${m}"${m === month ? ' selected' : ''}>${esc(fmtMonth(m, lang))} — ${n(byMonth.get(m).length)}</option>`).join('');
}

/* ---- one edition ------------------------------------------------------------ */
function render() {
	const items = [...(byMonth.get(month) || [])].sort((a, b) => b.d.localeCompare(a.d));
	const i = months.indexOf(month);
	main.querySelector('[data-step="-1"]').disabled = i <= 0;
	main.querySelector('[data-step="1"]').disabled = i >= months.length - 1;
	main.querySelector('[data-latest]').hidden = i === months.length - 1;

	edition.innerHTML = `
		<span><b>${esc(fmtMonth(month, lang))}</b> edition</span>
		<span>No. ${n(i + 1)} of ${n(months.length)}</span>
		<span><b>${n(items.length)}</b> article${items.length === 1 ? '' : 's'}</span>
		<span>${esc(LANG_LABEL[lang] || lang)}</span>`;

	if (!items.length) {
		page.innerHTML = '<p class="si-empty arc-empty">No articles in this edition.</p>';
		return;
	}

	const byLength = [...items].sort((a, b) => b.w - a.w);
	const lead = byLength[0];
	const rest = items.filter(it => it !== lead);
	const tier = [...rest].sort((a, b) => b.w - a.w).slice(0, Math.min(3, rest.length));
	const columns = rest.filter(it => !tier.includes(it));

	const groups = new Map();
	for (const it of columns) {
		const key = it.tp[0] || '';
		(groups.get(key) || groups.set(key, []).get(key)).push(it);
	}
	const ordered = [...groups.entries()].sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]));

	page.innerHTML = `
	<article class="bs-lead">
		<div>
			<p class="bs-kicker">The lead — the month's longest piece</p>
			<a href="${esc(lead.u)}">
				<h2 class="t">${esc(lead.t)}</h2>
				${lead.x ? `<p class="x">${esc(lead.x)}</p>` : ''}
			</a>
			<p class="bs-meta">
				<span>${esc(fmtFull(lead.d, lead.l))}</span>
				${lead.b ? `<span>· ${esc(lead.b)}</span>` : ''}
				<span>· ${n(lead.w)} words, ${lead.m} min</span>
				${lead.tp.length ? `<span>· ${esc(TOPIC[lead.tp[0]] || lead.tp[0])}</span>` : ''}
			</p>
		</div>
		<a class="bs-plate" href="${esc(lead.u)}" tabindex="-1" aria-hidden="true">${thumbHTML(data.uploads, lead.g)}</a>
	</article>

	${tier.length ? `<div class="bs-tier">${tier.map(it => `
		<article><a href="${esc(it.u)}">
			<span class="d">${esc(fmtDay(it.d, it.l))}${it.tp.length ? ' · ' + esc(TOPIC[it.tp[0]] || it.tp[0]) : ''}</span>
			<h3 class="t">${esc(it.t)}</h3>
			${it.x ? `<p class="x">${esc(it.x)}</p>` : ''}
		</a></article>`).join('')}</div>` : ''}

	${ordered.length ? `<div class="bs-columns" style="columns:${Math.min(4, Math.max(1, Math.ceil(columns.length / 5)))} 15rem">${ordered.map(([key, list]) => `
		<section class="bs-col">
			<h3>${esc(key ? (TOPIC[key] || key) : 'Also this month')}<i>${n(list.length)}</i></h3>
			<ul>${list.map(it => `<li><a href="${esc(it.u)}">
				<span class="d">${esc(fmtDay(it.d, it.l))}</span>
				<span class="t">${esc(it.t)}</span>
			</a></li>`).join('')}</ul>
		</section>`).join('')}</div>` : ''}`;

	settleImages(page);
	const url = new URLSearchParams();
	if (month !== months[months.length - 1]) url.set('m', month);
	if (lang !== 'en') url.set('lang', lang);
	history.replaceState(null, '', location.pathname + (url.toString() ? '?' + url : ''));
	drawIssues();
}

/* ---- the back-issue grid ----------------------------------------------------
 * One cell per month of every year the archive covers, shaded by how many
 * articles that month holds. It is the same fact the Drift's rail shows,
 * drawn as a calendar rather than a histogram. */
function drawIssues() {
	const years = [...new Set(months.map(m => m.slice(0, 4)))].sort().reverse();
	const max = Math.max(...months.map(m => byMonth.get(m).length));
	issues.innerHTML = years.map(y => `
		<li class="bs-year">
			<span>${y}</span>
			<div>${Array.from({ length: 12 }, (_, k) => {
				const m = `${y}-${String(k + 1).padStart(2, '0')}`;
				const list = byMonth.get(m);
				const label = `${fmtMonth(m, lang)} — ${list ? n(list.length) + ' articles' : 'no articles'}`;
				return `<button class="bs-month" type="button" data-m="${m}"
					style="--v:${list ? Math.round(list.length / max * 85) + 15 : 0}"
					title="${esc(label)}" aria-label="${esc(label)}"
					${list ? '' : 'disabled'}${m === month ? ' aria-current="true"' : ''}>${k + 1}</button>`;
			}).join('')}</div>
		</li>`).join('');
}

/* ---- wiring ----------------------------------------------------------------- */
main.addEventListener('click', e => {
	const step = e.target.closest('[data-step]');
	if (step) {
		const i = months.indexOf(month) + Number(step.dataset.step);
		if (i >= 0 && i < months.length) { month = months[i]; monthSel.value = month; render(); }
		return;
	}
	const cell = e.target.closest('[data-m]');
	if (cell && !cell.disabled) {
		month = cell.dataset.m;
		monthSel.value = month;
		render();
		main.querySelector('.bs-masthead').scrollIntoView({ behavior: 'smooth', block: 'start' });
		return;
	}
	if (e.target.closest('[data-latest]')) {
		month = months[months.length - 1];
		monthSel.value = month;
		render();
	}
});
monthSel.addEventListener('change', () => { month = monthSel.value; render(); });
main.querySelector('[data-lang]').addEventListener('change', e => {
	lang = e.target.value;
	index();
	render();
});

index();
render();

main.querySelector('[data-note]').innerHTML = `
	Every cell is a month that published something; the shade is how much.
	The archive's own rhythm is uneven — ${n(data.years.find(y => y.y === '2021')?.n || 0)} articles in 2021
	against ${n(data.years[0].n)} in ${data.years[0].y} — and the edition is composed from
	whatever the month actually holds.`;

main.removeAttribute('aria-busy');
