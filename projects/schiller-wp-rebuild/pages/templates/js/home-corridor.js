/* home-corridor.js — Home, draft C "The Corridor".
 * The hero ends on a globe laced with development corridors. Below it, three
 * lines keep running: Development, Peace, Culture. Each station is a dated,
 * sourced milestone; the lines draw as the reader travels and converge on the
 * reader's stop — a departure board of real, recurring ways to take part. */
import { esc, nf, fmtDate, reveal, getJSON, draftStrip, nextWeekly, fmtLocal, localZone, reduceMotion } from './pages-core.js';

const DRAFTS = [['A', 'home-record.html', 'The Record'], ['B', 'home-questions.html', 'The Cross-Examination'], ['C', 'home-corridor.html', 'The Corridor']];
const [R, now, facts] = await Promise.all([getJSON('record.json'), getJSON('now.json'), getJSON('facts.json')]);
const by = l => R.record.find(r => r.label.startsWith(l)).cite;
const main = document.getElementById('main');

const LINES = [
	{ id: 'dev', name: 'Development line', blurb: 'From a plan for a reunified Europe to corridors on every continent.', stations: [
		{ y: 1989, t: 'The Productive Triangle', c: facts.triangle, who: 'Helga Zepp-LaRouche, Stockholm, 2017' },
		{ y: 1991, t: 'The Eurasian Land-Bridge', c: by('The Eurasian Land-Bridge') },
		{ y: 1996, t: 'Beijing puts the New Silk Road on the map', c: facts.beijing_1996 },
		{ y: 2013, t: 'China adopts the Silk Road Economic Belt', c: by('China adopts') },
		{ y: 2014, t: 'The New Silk Road becomes the World Land-Bridge', c: by('The World Land-Bridge') },
		{ y: 2025, t: 'The Oasis Plan, for Southwest Asia', c: null, link: facts.oasis_page, note: `${facts.campaign_counts['oasis-plan']} articles in the campaign` },
	] },
	{ id: 'peace', name: 'Peace line', blurb: 'From a declaration of rights to a meeting that has not missed a Friday.', stations: [
		{ y: 1984, t: 'The Declaration of the Inalienable Rights of Man', c: facts.declaration },
		{ y: 1988, t: 'Berlin: “early steps toward the reunification of Germany”', c: by('German reunification') },
		{ y: 2020, t: 'The Committee for the Coincidence of Opposites', c: facts.coincidence, note: `${facts.campaign_counts['coincidence-of-opposites']} articles in the campaign` },
		{ y: 2026, t: `The International Peace Coalition, week ${now.counts.ipc_weeks}`, c: now.ipc.cite, note: `${facts.campaign_counts['international-peace-coalition']} reports so far` },
	] },
	{ id: 'culture', name: 'Culture line', blurb: 'From a film about Schiller to choruses in five regions and a youth assembly of 37 nations.', stations: [
		{ y: 1984, t: 'A film on the life of Friedrich Schiller', c: facts.schiller_film },
		{ y: 2014, t: 'The New York City chorus sings for the first time', c: facts.nyc_chorus },
		{ y: 2014, t: 'Choruses spread, at the Verdi pitch', c: facts.choruses },
		{ y: 2020, t: 'Daily Beethoven — Sparks of Joy', c: null, link: { title: 'Daily Beethoven — Sparks of Joy', url: '/daily-beethoven-sparks-of-joy/' }, note: `${facts.daily_beethoven_videos} episodes in the video archive` },
		{ y: 2025, t: 'Young people of the world, unite', c: facts.youth },
	] },
];

function station(s, line, i) {
	const src = s.c ? `<p class="hc-q">“${esc(s.c.quote)}”</p><p class="si-source">${s.who ? esc(s.who) + ' · ' : ''}<a href="${esc(s.c.url)}">${esc(s.c.title)}</a>${s.c.date ? ', ' + esc(fmtDate(s.c.date)) : ''}</p>`
		: `<p class="si-source"><a href="${esc(s.link.url)}">${esc(s.link.title)}</a></p>`;
	return `<li class="hc-stop si-reveal" data-line="${line.id}" style="--i:${i % 2}">
		<span class="hc-dot" aria-hidden="true"></span>
		<p class="hc-when">${s.y}</p>
		<div class="hc-card"><h3>${esc(s.t)}</h3>${src}${s.note ? `<p class="hc-note">${esc(s.note)}</p>` : ''}</div>
	</li>`;
}

const fri = nextWeekly(5, 11, 0);
const BOARD = [
	{ when: 'FRI 11:00 ET', local: fri ? fmtLocal(fri, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' your time' : '', dest: 'International Peace Coalition', via: 'Zoom', line: 'peace', act: 'Get the link' },
	{ when: 'WEEKLY', dest: 'The newsletter — ideas, webcasts, invitations', via: 'Email', line: 'dev', act: 'Sign up', form: true },
	{ when: 'REHEARSALS', dest: 'Community choruses — New York · Boston · Houston · Virginia · West Coast', via: 'In person', line: 'culture', act: 'Find yours', href: facts.sing.url },
	{ when: 'ANY DAY', dest: 'Membership', via: 'Online', line: 'dev', act: 'Join', href: 'donate-membership.html' },
	{ when: 'NEXT', dest: 'International conference', via: 'TBA', line: 'peace', act: 'Notify me', ph: 'date and place from the next si_conference record' },
];

main.innerHTML = `
<section class="hc-intro ct-container">
	<p class="hm-kicker">Where the corridors lead</p>
	<h2 class="hm-h2">The lines on the globe were drawn decades ago. <em>Follow them here.</em></h2>
	<p class="hm-lead">Three lines — development, peace and culture — each stop a date and a source. They meet at one station: yours.</p>
	<ul class="hc-legend">${LINES.map(l => `<li data-line="${l.id}"><a href="#hc-${l.id}"><i></i>${l.name}<span>${l.stations.length} stops</span></a></li>`).join('')}</ul>
</section>

<div class="hc-map ct-container">
	<svg class="hc-track" aria-hidden="true"></svg>
	${LINES.map(l => `
	<section class="hc-line" id="hc-${l.id}" data-line="${l.id}" aria-labelledby="hc-h-${l.id}">
		<header class="hc-board-sign si-reveal"><span class="hc-pill">${l.name}</span><h2 id="hc-h-${l.id}">${esc(l.blurb)}</h2></header>
		<ol class="hc-stops">${l.stations.map((s, i) => station(s, l, i)).join('')}</ol>
	</section>`).join('')}
	<section class="hc-terminus" aria-labelledby="hc-h-you">
		<span class="hc-you" aria-hidden="true">You</span>
		<p class="hm-kicker">Terminus · all lines</p>
		<h2 class="hm-h2" id="hc-h-you">Departures</h2>
		<p class="hm-lead">Every recurring way to take part, with its next time. Pick a train.</p>
		<div class="hc-board" role="table" aria-label="Ways to take part">
			<div class="hc-row hc-row--head" role="row"><span role="columnheader">When</span><span role="columnheader">Destination</span><span role="columnheader">Via</span><span role="columnheader"></span></div>
			${BOARD.map((b, i) => `<div class="hc-row" role="row" data-line="${b.line}">
				<span role="cell" class="hc-when-b"><b class="hc-flap" data-text="${esc(b.when)}">${esc(b.when)}</b>${b.local ? `<small>${esc(b.local)}</small>` : ''}</span>
				<span role="cell" class="hc-dest"><i></i>${esc(b.dest)}${b.ph ? ` <span class="pg-ph-inline">${esc(b.ph)}</span>` : ''}</span>
				<span role="cell" class="hc-via">${esc(b.via)}</span>
				<span role="cell">${b.href ? `<a class="hc-go" href="${esc(b.href)}">${esc(b.act)}</a>` : `<button class="hc-go" type="button" aria-expanded="false" aria-controls="hc-f-${i}">${esc(b.act)}</button>`}</span>
				${b.href ? '' : `<form class="hc-form hm-signup" id="hc-f-${i}" hidden onsubmit="event.preventDefault()"><label class="si-visually-hidden" for="hc-m-${i}">Email</label><input id="hc-m-${i}" type="email" placeholder="you@example.org" autocomplete="email"><button class="ct-button">${esc(b.act)}</button><p class="hm-fine">Double opt-in. <span class="pg-ph-inline">NationBuilder</span></p></form>`}
			</div>`).join('')}
		</div>
		${fri ? `<p class="hc-tz">Times shown in ${esc(localZone())}.</p>` : ''}
	</section>
</div>`;
main.removeAttribute('aria-busy');

/* rows open their own small form */
main.querySelectorAll('button.hc-go').forEach(b => b.addEventListener('click', () => {
	const f = document.getElementById(b.getAttribute('aria-controls'));
	const open = b.getAttribute('aria-expanded') !== 'true';
	b.setAttribute('aria-expanded', String(open)); f.hidden = !open;
	if (open) f.querySelector('input').focus();
}));

/* ---- the track: three parallel lines, bold on their own stretch, converging at You ---- */
const map = main.querySelector('.hc-map');
const svg = map.querySelector('.hc-track');
const XS = { dev: 14, peace: 30, culture: 46 };
function draw() {
	const m = map.getBoundingClientRect();
	const H = map.scrollHeight;
	const you = main.querySelector('.hc-you').getBoundingClientRect();
	const yT = you.top - m.top + you.height / 2, xT = 30;
	svg.setAttribute('viewBox', `0 0 60 ${H}`); svg.style.height = H + 'px';
	let out = '';
	for (const l of LINES) {
		const sec = main.querySelector(`#hc-${l.id}`).getBoundingClientRect();
		const a = sec.top - m.top, b = sec.bottom - m.top, x = XS[l.id];
		const d = `M${x},0 V${yT - 90} C${x},${yT - 30} ${xT},${yT - 50} ${xT},${yT}`;
		out += `<path class="hc-rail hc-rail--${l.id}" d="${d}"></path>`;
		out += `<path class="hc-run hc-run--${l.id}" d="M${x},${a + 10} V${b - 10}" pathLength="1"></path>`;
		main.querySelectorAll(`.hc-stop[data-line="${l.id}"] .hc-dot`).forEach(dot => {
			const r = dot.getBoundingClientRect();
			out += `<circle class="hc-st hc-st--${l.id}" cx="${x}" cy="${r.top - m.top + r.height / 2}" r="6"></circle>`;
		});
	}
	svg.innerHTML = out;
	progress();
}
function progress() {
	const vh = innerHeight * .6;
	svg.querySelectorAll('.hc-run').forEach(p => {
		const box = p.getBoundingClientRect();
		const t = reduceMotion ? 1 : Math.min(1, Math.max(0, (vh - box.top) / Math.max(1, box.height)));
		p.style.strokeDashoffset = String(1 - t);
	});
	svg.querySelectorAll('.hc-st').forEach(c => c.classList.toggle('is-reached', c.getBoundingClientRect().top < vh));
}
addEventListener('scroll', progress, { passive: true });
addEventListener('resize', draw);
new ResizeObserver(draw).observe(map);
document.fonts?.ready.then(draw);
draw();

/* split-flap: the WHEN column riffles once when the board arrives */
const board = main.querySelector('.hc-board');
if (!reduceMotion && 'IntersectionObserver' in window) {
	const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:';
	new IntersectionObserver((es, io) => {
		if (!es[0].isIntersecting) return; io.disconnect();
		board.querySelectorAll('.hc-flap').forEach((el, r) => {
			const final = el.dataset.text; let k = 0;
			const iv = setInterval(() => {
				k++;
				el.textContent = [...final].map((c, i) => c === ' ' || k > i * 1.5 + 6 + r * 2 ? c : CH[(Math.random() * CH.length) | 0]).join('');
				if (k > final.length * 1.5 + 8 + r * 2) { el.textContent = final; clearInterval(iv); }
			}, 45);
		});
	}, { threshold: .5 }).observe(board);
}

/* the legend jumps to a line */
reveal(main);
draftStrip({ family: 'Home', drafts: DRAFTS, current: 'home-corridor.html' });
