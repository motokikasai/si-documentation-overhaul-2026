/* home-record.js — Home, draft A "The Record".
 * One brass thread leaves the hero and runs down the page's left margin. It
 * passes every entry of the record, then every section, and ends at the reader.
 * The thread grows with the reader's scroll; its bead marks where they are. */
import { esc, nf, fmtDate, reveal, getJSON, draftStrip, nextWeekly, fmtLocal, localZone, leadTime, GRADE, voiceItem, UPLOADS } from './pages-core.js';

const DRAFTS = [['A', 'home-record.html', 'The Record'], ['B', 'home-questions.html', 'The Cross-Examination'], ['C', 'home-corridor.html', 'The Corridor']];
const [R, voices, now, facts] = await Promise.all([getJSON('record.json'), getJSON('voices.json'), getJSON('now.json'), getJSON('facts.json')]);
const rec = R.record;
const main = document.getElementById('main');

const KIND = { forecast: 'Forecast', proposal: 'Proposal', founding: 'Founding', outcome: 'Outcome', publication: 'Publication', now: 'Now' };
const GROUP = k => ({ forecast: 'forecast', proposal: 'proposal' }[k] || 'outcome');
const own = rec.filter(r => r.grade === 'own').length;
const held = rec.filter(r => r.primary.held).length;

function entry(r, i) {
	const lt = r.nolead ? null : leadTime(r.said_date, r.followed?.date);
	const c = r.cite;
	return `<li class="hr-entry si-reveal" data-group="${GROUP(r.kind)}" style="--i:${i % 3}">
	<span class="hr-year" aria-hidden="true">${r.year}</span>
	<span class="hr-node" aria-hidden="true"></span>
	<article class="hr-card">
		<p class="hr-kind"><span>${KIND[r.kind]}</span><span class="hr-year-inline">${r.year}</span></p>
		<h3>${esc(r.label)}</h3>
		<p class="hr-said"><span class="hr-tag">Said</span><span>${esc(r.said)}</span></p>
		${r.followed ? `<p class="hr-then"><span class="hr-tag">Then</span><span><time datetime="${r.followed.date}">${esc(fmtDate(r.followed.date))}</time> ${esc(r.followed.event)}${lt ? ` <span class="hr-lead">${lt.n} ${lt.unit} later</span>` : ''}</span></p>` : ''}
		<details class="hr-ev">
			<summary><span class="hm-grade" data-g="${r.grade}">${GRADE[r.grade].label}</span><span class="hr-ev__open">Check the source</span></summary>
			<blockquote>“${esc(c.quote)}”</blockquote>
			<p class="si-source">${r.reporter ? esc(r.reporter) + ' · ' : ''}<a href="${esc(c.url)}">${esc(c.title)}</a>, ${esc(fmtDate(c.date))}${c.author ? ` · ${esc(c.author)}` : ''}</p>
			<p class="hm-primary">Primary document · <b>${esc(r.primary.what)}</b> — ${r.primary.held ? `<a class="si-link" href="${esc(r.primary.url)}">online here</a>` : `<span class="is-missing">not yet in the online archive</span>`}</p>
		</details>
	</article>
</li>`;
}

const fri = nextWeekly(5, 11, 0);
/* only what the Institute itself would hold: not other people's speeches or posts */
const missing = rec.filter(r => !r.primary.held && ['forecast', 'proposal', 'founding'].includes(r.kind));

main.innerHTML = `
<div class="hr-thread" aria-hidden="true"><span class="hr-bead"></span></div>

<section class="hr-sec hr-open ct-container" aria-labelledby="hr-h-record">
	<p class="hm-kicker">Why believe us?</p>
	<h2 class="hm-h2" id="hr-h-record">A new paradigm is a large claim.<br><em>Here is the record behind it.</em></h2>
	<p class="hm-lead">${rec.length} dated entries, from 1971 to this summer: what was said, what followed, and where you can check it. Each one says whose account it is and whether the original document is online yet.</p>
	<div class="hr-controls">
		<div class="si-chips" role="group" aria-label="Show">
			<button class="si-chip" data-f="all" aria-pressed="true">All <span class="si-chip__count">${rec.length}</span></button>
			<button class="si-chip" data-f="forecast" aria-pressed="false">Forecasts <span class="si-chip__count">${rec.filter(r => GROUP(r.kind) === 'forecast').length}</span></button>
			<button class="si-chip" data-f="proposal" aria-pressed="false">Proposals <span class="si-chip__count">${rec.filter(r => GROUP(r.kind) === 'proposal').length}</span></button>
			<button class="si-chip" data-f="outcome" aria-pressed="false">Milestones <span class="si-chip__count">${rec.filter(r => GROUP(r.kind) === 'outcome').length}</span></button>
		</div>
		<button class="si-btn-ghost hr-openall" type="button" aria-pressed="false">Open every source</button>
	</div>
	<p class="hr-honesty"><span class="hm-grade" data-g="own">${own} our own account</span><span class="hm-grade" data-g="reported">${rec.length - own} reported from others</span><span class="hr-held">${held} of ${rec.length} with the primary document online</span></p>
</section>

<ol class="hr-spine ct-container">${rec.map(entry).join('')}</ol>

<section class="hr-sec ct-container hr-idea si-reveal" aria-labelledby="hr-h-idea">
	<span class="hr-station" aria-hidden="true"></span>
	<p class="hm-kicker">The idea behind the record</p>
	<h2 class="hm-h2" id="hr-h-idea">One measure of progress, <em>one standard for a citizen</em></h2>
	<div class="hr-quotes">
		<figure><blockquote>“…${esc(facts.method.quote)}.”</blockquote><figcaption class="si-source">The method in one sentence · <a href="${esc(facts.method.url)}">${esc(facts.method.title)}</a>, ${esc(fmtDate(facts.method.date))}</figcaption></figure>
		<figure><blockquote>“…${esc(facts.world_citizen.quote)}.”</blockquote><figcaption class="si-source">Lyndon LaRouche, Berlin, 12 October 1988 · quoted in <a href="${esc(facts.world_citizen.url)}">${esc(facts.world_citizen.title)}</a></figcaption></figure>
	</div>
</section>

<section class="hr-sec ct-container hr-table si-reveal" aria-labelledby="hr-h-table">
	<span class="hr-station" aria-hidden="true"></span>
	<p class="hm-kicker">Who comes to the table</p>
	<h2 class="hm-h2" id="hr-h-table">${nf(now.counts.people)} people on record in the archive. <em>Some of them:</em></h2>
	<p class="hm-lead">Each with the office they held and how often they appear in the archive. Titles are sourced; nobody is shown without one.</p>
	<ul class="hm-voices">${voices.voices.slice(0, 12).map(voiceItem).join('')}</ul>
	<p class="hr-more"><a class="si-link si-arrow" href="../../people/templates/people-register.html">All ${nf(now.counts.people)} people</a></p>
</section>

<section class="hr-sec ct-container hr-week si-reveal" aria-labelledby="hr-h-week">
	<span class="hr-station" aria-hidden="true"></span>
	<p class="hm-kicker">This week</p>
	<h2 class="hm-h2" id="hr-h-week">The record is still being written — <em>every Friday.</em></h2>
	<div class="hr-week__grid">
		<div class="hr-friday">
			<p class="hr-friday__n">${now.counts.ipc_weeks}<span>consecutive weeks</span></p>
			<p>The International Peace Coalition meets on Zoom every Friday at 11:00 ET.</p>
			${fri ? `<p class="hr-friday__local">Next meeting, in your time: <b>${esc(fmtLocal(fri, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</b><span>${esc(localZone())}</span></p>` : ''}
			<a class="ct-button" href="join-week.html">Get the Zoom link</a>
			<p class="si-source">Count as of ${esc(fmtDate(now.counts.ipc_asof))} · <a href="${esc(now.ipc.cite.url)}">${esc(now.ipc.cite.title)}</a></p>
		</div>
		<ul class="hr-latest">${now.latest.slice(0, 4).map(a => `<li><a href="${esc(a.u)}"><time>${esc(fmtDate(a.d))}</time><strong>${esc(a.t)}</strong></a></li>`).join('')}</ul>
	</div>
</section>

<section class="hr-sec ct-container hr-you" aria-labelledby="hr-h-you">
	<span class="hr-station hr-station--you" aria-hidden="true"><span>you</span></span>
	<p class="hm-kicker">Where the thread reaches you</p>
	<h2 class="hm-h2" id="hr-h-you">Start with what you can give. <em>Two minutes is a start.</em></h2>
	<ol class="hr-ladder">
		<li class="si-reveal" style="--i:0"><p class="hr-cost">2 minutes</p><h3>Read with us</h3><p>The week’s ideas, webcasts and invitations, by email.</p>
			<form class="hm-signup" onsubmit="event.preventDefault()"><label class="si-visually-hidden" for="hr-mail">Email</label><input id="hr-mail" type="email" placeholder="you@example.org" autocomplete="email"><button class="ct-button">Sign up</button></form>
			<p class="hm-fine">Double opt-in; unsubscribe any time. <span class="pg-ph-inline">NationBuilder form</span></p></li>
		<li class="si-reveal" style="--i:1"><p class="hr-cost">1 hour a week</p><h3>Sit in on Friday</h3><p>Join the Peace Coalition’s open meeting, in week ${now.counts.ipc_weeks + 1} or any after it.</p><a class="si-link si-arrow" href="join-week.html">Friday, 11:00 ET</a></li>
		<li class="si-reveal" style="--i:2"><p class="hr-cost">An evening a week</p><h3>Sing</h3><p>“${esc(facts.sing.quote)}” Choruses in ${['New York', 'Boston', 'Houston', 'Virginia', 'the West Coast'].join(', ')}.</p><a class="si-link si-arrow" href="${esc(facts.sing.url)}">Find a chorus</a></li>
		<li class="si-reveal" style="--i:3"><p class="hr-cost">What you can spare</p><h3>Keep it independent</h3><p>No state money, no large commercial backers: members and donors pay for all of it.</p><a class="si-link si-arrow" href="donate-facts.html">Become a member</a></li>
	</ol>
	<aside class="hr-youth si-reveal">
		<p class="hm-kicker">Under thirty?</p>
		<p>In December 2025 the youth conference drew “${esc(facts.youth.quote)}”.</p>
		<a class="si-link si-arrow" href="${esc(facts.youth.url)}">Read the report</a>
	</aside>
</section>

<section class="hr-sec ct-container hr-complete si-reveal" aria-labelledby="hr-h-complete">
	<p class="hm-kicker">Help complete the record</p>
	<h2 class="hm-h2" id="hr-h-complete">${missing.length} of our own entries above still lack their original document online.</h2>
	<p class="hm-lead">If you hold a copy of any of these — a pamphlet, a recording, a transcript — we would like to scan it and link it here.</p>
	<ul class="hr-missing">${missing.map(r => `<li><span>${r.year}</span>${esc(r.primary.what.replace(/^./, ch => ch.toUpperCase()))}</li>`).join('')}</ul>
	<a class="si-btn-ghost" href="contact-letter.html">Send us a document</a>
</section>`;
main.removeAttribute('aria-busy');

/* filters: dim what is not selected rather than removing it — the spine keeps its shape */
const spine = main.querySelector('.hr-spine');
main.querySelector('.hr-controls .si-chips').addEventListener('click', e => {
	const b = e.target.closest('.si-chip'); if (!b) return;
	main.querySelectorAll('.hr-controls .si-chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
	spine.dataset.f = b.dataset.f;
	spine.querySelectorAll('.hr-entry').forEach(li => li.classList.toggle('is-dim', b.dataset.f !== 'all' && li.dataset.group !== b.dataset.f));
});
const openAll = main.querySelector('.hr-openall');
openAll.addEventListener('click', () => {
	const on = openAll.getAttribute('aria-pressed') !== 'true';
	openAll.setAttribute('aria-pressed', String(on));
	openAll.textContent = on ? 'Close every source' : 'Open every source';
	spine.querySelectorAll('.hr-ev').forEach(d => { d.open = on; });
});

/* the thread: grows to the reader's position; ends at the "you" station */
const thread = main.querySelector('.hr-thread');
const you = main.querySelector('.hr-station--you');
function place() {
	const m = main.getBoundingClientRect(), y = you.getBoundingClientRect();
	thread.style.height = (y.top - m.top + 14) + 'px';
	const t = Math.min(1, Math.max(0, (innerHeight * 0.55 - m.top) / (y.top - m.top + 14)));
	thread.style.setProperty('--t', t.toFixed(4));
}
addEventListener('scroll', place, { passive: true });
addEventListener('resize', place);
new ResizeObserver(place).observe(main);
place();

reveal(main);
draftStrip({ family: 'Home', drafts: DRAFTS, current: 'home-record.html' });
