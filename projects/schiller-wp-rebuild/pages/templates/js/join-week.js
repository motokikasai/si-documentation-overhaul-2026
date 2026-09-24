/* join-week.js — Join, draft B "The Week".
 * The movement as a week, drawn in the READER's time zone. Only one slot in the
 * archive is fixed and documented — the Friday coalition, 11:00 ET — so only
 * that one is pinned to the grid. Everything that recurs but moves (the weekly
 * live dialogue, rehearsals) floats above the grid, honestly unpinned. */
import { esc, nf, fmtDate, getJSON, mount, nextWeekly, localZone } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const ZONES = [Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/New_York', 'America/Los_Angeles', 'Europe/Berlin', 'Europe/Paris', 'Africa/Lagos', 'Asia/Kolkata', 'Asia/Shanghai', 'Australia/Sydney'].filter((z, i, a) => a.indexOf(z) === i);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const H0 = 0, H1 = 24;

function place(tz) {
	const fri = nextWeekly(5, 11, 0);                     // the real instant
	const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fri).map(x => [x.type, x.value]));
	return { day: DAYS.indexOf(p.weekday), h: +p.hour + +p.minute / 60, label: new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(fri), date: fri };
}

mount(`
<div class="ct-container jw-wrap">
	<header class="jw-head">
		<div>
			<p class="si-eyebrow si-eyebrow--ruled">Join</p>
			<h1 class="jw-title">Your week, <em>with the movement in it</em></h1>
			<p class="jw-lead">What happens every week, placed in your own time.</p>
		</div>
		<label class="jw-tz"><span>Time zone</span><select>${ZONES.map(z => `<option value="${esc(z)}">${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></label>
	</header>

	<div class="jw-floating">
		<p class="hm-kicker">Every week, day announced each week</p>
		<ul>
			<li><b>Live dialogue with Helga Zepp-LaRouche</b><span>Questions welcome · the newsletter carries the day and hour</span></li>
			<li><b>The newsletter</b><span>Ideas, webcasts and invitations · by email</span></li>
			<li><b>Chorus rehearsals</b><span>New York · Boston · Houston · Virginia · West Coast <span class="pg-ph-inline">rehearsal times per city</span></span></li>
		</ul>
	</div>

	<div class="jw-cal" role="grid" aria-label="This week">
		<div class="jw-hours" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<span style="--h:${i * 3}">${String(i * 3).padStart(2, '0')}:00</span>`).join('')}</div>
		${DAYS.map((d, i) => `<div class="jw-day" role="row" data-d="${i}"><p class="jw-dname" role="columnheader">${d}</p><div class="jw-col"></div></div>`).join('')}
		<div class="jw-now" aria-hidden="true"></div>
	</div>

	<section class="jw-slot" aria-live="polite">
		<div class="jw-slot__main">
			<p class="hm-kicker">Fixed · every Friday</p>
			<h2>International Peace Coalition</h2>
			<p class="jw-when"></p>
			<p>${now.counts.ipc_weeks} consecutive weekly meetings by ${esc(fmtDate(now.counts.ipc_asof))}. On Zoom.</p>
			<p class="si-source">“${esc(facts.ipc_page.quote)}” — <a href="${esc(facts.ipc_page.url)}">${esc(facts.ipc_page.title)}</a></p>
		</div>
		<form class="jw-form" onsubmit="event.preventDefault(); this.innerHTML='<p class=jw-done>The link is on its way. (Prototype: nothing was sent.)</p>'">
			<label for="jw-mail">Send me the Zoom link</label>
			<div class="hm-signup"><input id="jw-mail" type="email" placeholder="you@example.org" autocomplete="email" required><button class="ct-button">Send</button></div>
			<p class="hm-fine"><a href="#" class="jw-ics">Add to my calendar (.ics)</a> · <span class="pg-ph-inline">NationBuilder event</span></p>
		</form>
	</section>
</div>`, 'Join', 'join-week.html');

const sel = document.querySelector('.jw-tz select');
function draw() {
	const tz = sel.value, s = place(tz);
	document.querySelectorAll('.jw-ev').forEach(e => e.remove());
	const col = document.querySelector(`.jw-day[data-d="${s.day}"] .jw-col`);
	const ev = document.createElement('button');
	ev.className = 'jw-ev'; ev.type = 'button';
	ev.style.setProperty('--h', s.h); ev.style.setProperty('--len', 1.5);
	ev.innerHTML = `<b>${esc(s.label.split(' ').at(-1))}</b><span>Peace Coalition</span>`;
	ev.addEventListener('click', () => document.querySelector('.jw-slot').scrollIntoView({ behavior: 'smooth', block: 'center' }));
	col.appendChild(ev);
	document.querySelector('.jw-when').innerHTML = `<b>${esc(s.label)}</b> in ${esc(tz.replace(/_/g, ' '))} · 11:00 in New York`;
	/* the "now" line, so the reader sees how far off Friday is */
	const n = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
	const nowEl = document.querySelector('.jw-now');
	nowEl.style.setProperty('--d', DAYS.indexOf(n.weekday)); nowEl.style.setProperty('--h', +n.hour + +n.minute / 60);
}
sel.addEventListener('change', draw); draw();

/* a real .ics for the next Friday, built in the page — no server needed */
document.querySelector('.jw-ics').addEventListener('click', e => {
	e.preventDefault();
	const t = nextWeekly(5, 11, 0), f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Schiller Institute//Join//EN', 'BEGIN:VEVENT', `UID:ipc-${f(t)}@schillerinstitute.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(t)}`, `DTEND:${f(new Date(t.getTime() + 90 * 60000))}`, 'RRULE:FREQ=WEEKLY;BYDAY=FR', 'SUMMARY:International Peace Coalition (Zoom)', 'DESCRIPTION:Weekly meeting of the International Peace Coalition. The Zoom link is sent by email.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
	const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'international-peace-coalition.ics' });
	a.click(); URL.revokeObjectURL(a.href);
});
