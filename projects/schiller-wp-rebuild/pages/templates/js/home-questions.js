/* home-questions.js — Home, draft B "The Cross-Examination".
 * Six questions a doubtful reader asks, in the order they ask them. The rail on
 * the left is the thread: it keeps all six in view and marks the one being
 * answered. Every answer is the archive's own evidence, sourced. */
import { esc, nf, fmtDate, reveal, getJSON, draftStrip, nextWeekly, fmtLocal, localZone, leadTime, GRADE, voiceItem, medallion, tooltip, spy, reduceMotion } from './pages-core.js';

const DRAFTS = [['A', 'home-record.html', 'The Record'], ['B', 'home-questions.html', 'The Cross-Examination'], ['C', 'home-corridor.html', 'The Corridor']];
const [R, voices, now, facts] = await Promise.all([getJSON('record.json'), getJSON('voices.json'), getJSON('now.json'), getJSON('facts.json')]);
const rec = R.record;
const main = document.getElementById('main');
const tip = tooltip();
const by = l => rec.find(r => r.label.startsWith(l));

const Q = [
	['who', 'Who are you, exactly?'],
	['right', 'What have you actually got right?'],
	['says', 'Says who?'],
	['listen', 'Does anyone in power listen?'],
	['now', 'What are you doing now?'],
	['me', 'And what could I do?'],
];

/* ---- Q1 chart: articles published per year ------------------------------ */
function yearBars() {
	const ys = now.counts.years, max = Math.max(...ys.map(y => y[1]));
	const W = 640, H = 160, pad = 22, bw = (W - pad) / ys.length;
	const bars = ys.map(([y, n], i) => {
		const h = Math.max(2, (n / max) * (H - 34)), x = pad + i * bw + 1;
		return `<g class="hq-bar" data-tip="<b>${y}</b><span>${nf(n)} articles${y === '2026' ? ' (to 20 August)' : ''}</span>">
			<rect class="hit" x="${x - 1}" y="0" width="${bw}" height="${H}"></rect>
			<path d="M${x},${H - 18} v-${h - 4} q0,-4 4,-4 h${bw - 10} q4,0 4,4 v${h - 4} z"></path>
			${i % 2 === 0 || i === ys.length - 1 ? `<text x="${x + (bw - 2) / 2}" y="${H - 4}">${y.slice(2)}</text>` : ''}</g>`;
	}).join('');
	const top = ys.reduce((a, b) => b[1] > a[1] ? b : a);
	return `<figure class="hq-chart"><figcaption><b>Articles published per year</b><span>${nf(now.counts.articles)} in all, 2012 to August 2026 · peak ${top[0]}: ${nf(top[1])}</span></figcaption>
		<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of articles per year, 2012 to 2026">${`<line class="base" x1="${pad}" x2="${W}" y1="${H - 18}" y2="${H - 18}"></line>`}${bars}</svg>
		<details class="hq-table"><summary>Show as a table</summary><table><tbody>${ys.map(([y, n]) => `<tr><th>${y}</th><td>${nf(n)}</td></tr>`).join('')}</tbody></table></details></figure>`;
}

/* ---- Q2 chart: said → followed, on one time axis (a dumbbell) ------------ */
const PAIRS = [
	{ r: by('The October 1987'), said: '1987-05' },
	{ r: by('German reunification'), said: '1988-10-12' },
	{ r: by('The 2007'), said: '2007-07-25' },
	{ r: by('An International Development Bank'), said: '1975' },
	{ r: by('The Eurasian Land-Bridge'), said: '1991', to: by('China adopts') },
];
function dumbbell() {
	const Y0 = 1970, Y1 = 2020, W = 720, L = 190, row = 46;
	const X = d => { const [y, m = 6] = String(d).split('-').map(Number); return L + ((y + (m - 1) / 12) - Y0) / (Y1 - Y0) * (W - L - 20); };
	const H = PAIRS.length * row + 34;
	const ticks = [1970, 1980, 1990, 2000, 2010, 2020].map(y => `<g class="tick"><line x1="${X(y + '-01')}" x2="${X(y + '-01')}" y1="6" y2="${H - 24}"></line><text x="${X(y + '-01')}" y="${H - 8}">${y}</text></g>`).join('');
	const rows = PAIRS.map((p, i) => {
		const f = (p.to || p.r).followed, lt = leadTime(p.said, f.date), y = 24 + i * row;
		const a = X(p.said), b = X(f.date);
		const t = `<b>${esc(p.r.label)}</b><span>Said ${esc(p.said.length > 4 ? fmtDate(p.said.length === 7 ? p.said + '-15' : p.said, p.said.length === 7 ? 'month' : 'long') : p.said)} → ${esc(fmtDate(f.date))}: ${esc(f.event)}</span>`;
		return `<g class="hq-pair" data-tip="${esc(t)}" data-i="${i}">
			<rect class="hit" x="0" y="${y - row / 2}" width="${W}" height="${row}"></rect>
			<text class="lbl" x="0" y="${y + 4}">${esc(p.r.label.replace(/^The /, ''))}</text>
			<line class="gap" x1="${a}" x2="${b}" y1="${y}" y2="${y}"></line>
			<circle class="said" cx="${a}" cy="${y}" r="5.5"></circle>
			<circle class="then" cx="${b}" cy="${y}" r="5.5"></circle>
			<text class="lead" x="${b + 12}" y="${y + 4}">${lt.n} ${lt.unit}</text></g>`;
	}).join('');
	return `<figure class="hq-chart hq-chart--wide"><figcaption><b>From what was said to what followed</b><span><i class="k-said"></i>said <i class="k-then"></i>followed · hover a row for the event</span></figcaption>
		<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Time between five statements and the events that followed">${ticks}${rows}</svg></figure>`;
}

/* ---- Q5 grid: 167 consecutive weeks, and the empty square for this Friday --- */
function weeks() {
	const n = now.counts.ipc_weeks, last = new Date(now.counts.ipc_asof + 'T12:00:00');
	const cells = Array.from({ length: n }, (_, i) => {
		const d = new Date(last.getTime() - (n - 1 - i) * 7 * 864e5);
		return `<span class="hq-wk" data-tip="<b>Week ${i + 1}</b><span>≈ ${fmtDate(d.toISOString().slice(0, 10), 'short')} (counted back from week ${n})</span>"></span>`;
	}).join('');
	return `<div class="hq-weeks" role="img" aria-label="${n} consecutive weekly meetings, then an empty square for the next one">${cells}<a class="hq-wk hq-wk--next" href="join-week.html" data-tip="<b>Week ${n + 1} and on</b><span>This Friday. Your seat.</span>"><span class="si-visually-hidden">Join the next meeting</span></a></div>`;
}

const fri = nextWeekly(5, 11, 0);
const reported = rec.filter(r => r.grade === 'reported');

main.innerHTML = `
<div class="ct-container hq-wrap">
	<nav class="hq-rail" aria-label="The six questions">
		<p class="hm-kicker">Six questions</p>
		<ol>${Q.map(([id, q], i) => `<li><a href="#q-${id}"><span>${i + 1}</span>${esc(q)}</a></li>`).join('')}</ol>
	</nav>
	<div class="hq-body">
		<header class="hq-intro">
			<p class="hm-kicker">You have questions</p>
			<h2 class="hm-h2">Before you join anything, <em>ask us what you would ask anyone.</em></h2>
			<p class="hm-lead">Six questions, answered from our own archive. Each answer shows where it comes from, so you can check it yourself.</p>
		</header>

		<section class="hq-q si-reveal" id="q-who">
			<p class="hq-ask"><span>1</span>“Who are you, exactly?”</p>
			<div class="hq-a">
				<p class="hq-answer">${esc(facts.founding.quote)}.</p>
				<p class="si-source"><a href="${esc(facts.founding.url)}">${esc(facts.founding.title)}</a>, ${esc(fmtDate(facts.founding.date))}</p>
				<dl class="si-p-facts hq-facts">
					<div><dt>founded</dt><dd>${now.counts.founded}</dd></div>
					<div><dt>articles in the archive since 2012</dt><dd>${nf(now.counts.articles)}</dd></div>
					<div><dt>people on record in the archive</dt><dd>${nf(now.counts.people)}</dd></div>
					<div><dt>recorded videos</dt><dd>${nf(now.counts.videos)}</dd></div>
				</dl>
				${yearBars()}
				<p class="hq-langs">In English ${nf(now.counts.languages_articles.en)} · Deutsch ${nf(now.counts.languages_articles.de)} · Русский ${nf(now.counts.languages_articles.ru)} · 中文 ${nf(now.counts.languages_articles.zh || now.counts.languages_articles['zh-hans'] || 0)}</p>
			</div>
		</section>

		<section class="hq-q si-reveal" id="q-right">
			<p class="hq-ask"><span>2</span>“What have you actually got right?”</p>
			<div class="hq-a">
				<p class="hq-answer">Five statements with a date on them, and the events that followed. The shortest gap is months; the longest, decades.</p>
				${dumbbell()}
				<div class="hq-said-detail" aria-live="polite"></div>
				<p class="hq-caveat"><b>What this chart does not show:</b> anything that did not come to pass. The archive keeps no systematic list of misses, and we will not pretend that it does. <a class="si-link" href="home-record.html">The full record, with every source</a>.</p>
			</div>
		</section>

		<section class="hq-q si-reveal" id="q-says">
			<p class="hq-ask"><span>3</span>“Says who?”</p>
			<div class="hq-a">
				<p class="hq-answer">Mostly, we do — and we say so. Every entry in our record is marked with whose account it is.</p>
				<ul class="hq-grades">
					<li><span class="hm-grade" data-g="own">${GRADE.own.label}</span><b>${rec.filter(r => r.grade === 'own').length}</b><p>${GRADE.own.note}</p></li>
					<li><span class="hm-grade" data-g="reported">${GRADE.reported.label}</span><b>${reported.length}</b><p>${reported.map(r => esc(r.reporter.replace(/\s*[—,]\s*as reported in this archive/, ''))).join('; ')}.</p></li>
					<li><span class="hm-grade hq-g-primary">Primary document online</span><b>${rec.filter(r => r.primary.held).length}</b><p>The rest are still to be scanned. <a class="si-link" href="home-record.html#hr-h-complete">Help us find them.</a></p></li>
				</ul>
				${reported.map(r => `<blockquote class="hq-reported">“${esc(r.cite.quote)}”<cite>${esc(r.reporter)} · <a href="${esc(r.cite.url)}">${esc(r.cite.title)}</a>, ${esc(fmtDate(r.cite.date))}</cite></blockquote>`).join('')}
			</div>
		</section>

		<section class="hq-q si-reveal" id="q-listen">
			<p class="hq-ask"><span>4</span>“Does anyone in power listen?”</p>
			<div class="hq-a">
				<p class="hq-answer">Judge by who has taken the platform. A roll call, with the office each held:</p>
				<ol class="hq-roll">${voices.voices.slice(0, 16).map(v => `<li><a href="${esc(v.url)}">${medallion(v, 44)}<span class="hq-roll__t">${esc(v.title)}</span><b>${esc(v.name)}</b><small>${v.n}×</small></a></li>`).join('')}</ol>
				<p class="hq-more"><a class="si-link si-arrow" href="../../people/templates/people-register.html">All ${nf(now.counts.people)} speakers</a></p>
			</div>
		</section>

		<section class="hq-q si-reveal" id="q-now">
			<p class="hq-ask"><span>5</span>“What are you doing now?”</p>
			<div class="hq-a">
				<p class="hq-answer">Meeting every Friday for peace — ${now.counts.ipc_weeks} weeks without a break, by ${esc(fmtDate(now.counts.ipc_asof))}.</p>
				${weeks()}
				<p class="si-source">One square per weekly meeting of the International Peace Coalition · <a href="${esc(now.ipc.cite.url)}">${esc(now.ipc.cite.title)}</a></p>
				<ul class="hq-latest">${now.latest.slice(0, 3).map(a => `<li><a href="${esc(a.u)}"><time>${esc(fmtDate(a.d))}</time>${esc(a.t)}</a></li>`).join('')}</ul>
			</div>
		</section>

		<section class="hq-q si-reveal" id="q-me">
			<p class="hq-ask"><span>6</span>“And what could I do?”</p>
			<div class="hq-a">
				<p class="hq-answer">That depends on what you have to give. Pick one.</p>
				<div class="hq-give">
					<article><p class="hq-give__k">Time</p><h3>An hour on Friday</h3><p>${fri ? `Next: <b>${esc(fmtLocal(fri))}</b> your time (${esc(localZone())}).` : 'Fridays, 11:00 ET.'}</p><a class="si-link si-arrow" href="join-week.html">Get the Zoom link</a></article>
					<article><p class="hq-give__k">Talent</p><h3>Your field</h3><p>“${esc(facts.contact_call.quote)}” — we want to hear from you.</p><a class="si-link si-arrow" href="contact-switchboard.html">Write to us</a></article>
					<article><p class="hq-give__k">Voice</p><h3>Sing</h3><p>“${esc(facts.sing.quote)}”</p><a class="si-link si-arrow" href="${esc(facts.sing.url)}">Find a chorus</a></article>
					<article><p class="hq-give__k">Means</p><h3>Membership</h3><p>No state funding, no large commercial backers — members and donors carry the work.</p><a class="si-link si-arrow" href="donate-facts.html">Become a member</a></article>
				</div>
				<div class="hq-mail">
					<p><b>Or simply read along.</b> The week’s ideas and invitations, by email.</p>
					<form class="hm-signup" onsubmit="event.preventDefault()"><label class="si-visually-hidden" for="hq-mail">Email</label><input id="hq-mail" type="email" placeholder="you@example.org" autocomplete="email"><button class="ct-button">Sign up</button></form>
					<p class="hm-fine">Double opt-in. <span class="pg-ph-inline">NationBuilder form</span></p>
				</div>
			</div>
		</section>

		<section class="hq-last si-reveal">
			<p class="hq-ask hq-ask--last">“I’m still not convinced.”</p>
			<p class="hq-answer">Good. ${nf(now.counts.articles)} articles are open to you — search them.</p>
			<form class="hq-search" action="search-concordance.html" role="search"><label class="si-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input name="q" type="search" placeholder="Oasis Plan, Beethoven, Krafft Ehricke…" aria-label="Search the archive"></label><button class="ct-button">Search</button></form>
		</section>
	</div>
</div>`;
main.removeAttribute('aria-busy');

/* tooltips for every chart mark; pairs also write their detail under the chart */
main.addEventListener('pointerover', e => { const g = e.target.closest('[data-tip]'); if (g) g.classList.add('is-hot'); });
main.addEventListener('pointermove', e => { const g = e.target.closest('[data-tip]'); g ? tip.show(g.dataset.tip, e.clientX, e.clientY) : tip.hide(); });
main.addEventListener('pointerout', e => { const g = e.target.closest('[data-tip]'); if (g) g.classList.remove('is-hot'); tip.hide(); });
const detail = main.querySelector('.hq-said-detail');
main.querySelectorAll('.hq-pair').forEach(g => g.addEventListener('pointerenter', () => {
	const p = PAIRS[+g.dataset.i];
	detail.innerHTML = `<blockquote>“${esc(p.r.cite.quote)}”</blockquote><p class="si-source"><span class="hm-grade" data-g="${p.r.grade}">${GRADE[p.r.grade].label}</span> · <a href="${esc(p.r.cite.url)}">${esc(p.r.cite.title)}</a>, ${esc(fmtDate(p.r.cite.date))}</p>`;
}));
main.querySelector('.hq-pair')?.dispatchEvent(new Event('pointerenter'));

/* the rail: which question is being answered */
const items = Q.map(([id]) => ({ id: 'q-' + id, el: document.getElementById('q-' + id) }));
spy(items, [...main.querySelectorAll('.hq-rail a')]);

/* weeks fill in once, in order, when they come into view */
const grid = main.querySelector('.hq-weeks');
if (!reduceMotion && 'IntersectionObserver' in window) {
	grid.classList.add('is-waiting');
	new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { grid.classList.remove('is-waiting'); grid.classList.add('is-filling'); io.disconnect(); } }, { threshold: .4 }).observe(grid);
}

reveal(main);
draftStrip({ family: 'Home', drafts: DRAFTS, current: 'home-questions.html' });
