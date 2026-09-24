/* contact-switchboard.js — Contact, draft B "The Switchboard".
 * Route first. The reader picks why they are writing; the page answers with the
 * one right channel for that, and — only where a person must reply — a short
 * form. Channels the archive publishes are real; the rest are placeholders. */
import { esc, getJSON, mount, nextWeekly, fmtLocal } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const fri = nextWeekly(5, 11, 0);
const LINES = [
	{ id: 'join', n: '01', t: 'Take part', s: 'Meetings, organising, volunteering',
	  body: `<p>The quickest way in is the open Friday meeting of the International Peace Coalition${fri ? ` — next on <b>${esc(fmtLocal(fri))}</b> your time` : ''}.</p><a class="ct-button" href="join-week.html">Get the Zoom link</a><p class="cs-or">Or tell us what you would like to do:</p>`, form: true },
	{ id: 'live', n: '02', t: 'A question for a live event', s: 'Conferences and webcasts',
	  body: `<p>Questions sent during a conference or webcast go to the moderators:</p><p class="cs-addr"><a href="mailto:questions@schillerinstitute.org">questions@schillerinstitute.org</a></p><p class="si-source">As published in <a href="${esc(facts.questions_email.url)}">${esc(facts.questions_email.title)}</a></p>` },
	{ id: 'sing', n: '03', t: 'Sing', s: 'Community choruses',
	  body: `<p>“${esc(facts.sing.quote)}”</p><p>${esc(facts.choruses.quote.replace(/, our choruses.*$/, ''))}.</p><a class="si-btn-ghost" href="${esc(facts.sing.url)}">Find your chorus</a>` },
	{ id: 'press', n: '04', t: 'Press and media', s: 'Interviews, statements, images',
	  body: `<p class="pg-ph">Press contact — name, email and phone for the press desk <b>to be supplied</b></p>`, form: true },
	{ id: 'money', n: '05', t: 'Membership and donations', s: 'Receipts, standing orders, changes',
	  body: `<p>In Germany: <a href="mailto:si@schiller-institut.de">si@schiller-institut.de</a>, Postfach 140163, D-65208 Wiesbaden.</p><p class="si-source">From the <a href="${esc(facts.impressum_de.url)}">Impressum</a></p><p class="pg-ph-inline">US and other countries — membership office address to be supplied</p><a class="si-link si-arrow" href="donate-membership.html">About membership</a>` },
	{ id: 'archive', n: '06', t: 'The archive', s: 'A correction, a document, a permission',
	  body: `<p>Corrections are made openly. If you hold an original document we cite — a pamphlet, a recording, a transcript — we would like to scan it.</p>`, form: true },
	{ id: 'else', n: '07', t: 'Something else', s: 'Anything not above',
	  body: `<p>Write, and a person will read it.</p>`, form: true },
];

mount(`
<div class="ct-container cs-wrap">
	<header class="cs-head">
		<p class="si-eyebrow si-eyebrow--ruled">Contact</p>
		<h1 class="cs-title">What are you writing about?</h1>
		<p class="cs-lead">Choose one, and we will show you the right door — often faster than a form.</p>
	</header>
	<div class="cs-board">
		<div class="cs-lines" role="tablist" aria-label="Reason for writing">${LINES.map((l, i) => `
			<button class="cs-line" role="tab" id="cs-t-${l.id}" aria-controls="cs-p-${l.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
				<span class="cs-n">${l.n}</span><span class="cs-t">${esc(l.t)}</span><span class="cs-s">${esc(l.s)}</span><span class="cs-lamp" aria-hidden="true"></span>
			</button>`).join('')}
		</div>
		<div class="cs-panels">${LINES.map((l, i) => `
			<section class="cs-panel" role="tabpanel" id="cs-p-${l.id}" aria-labelledby="cs-t-${l.id}"${i ? ' hidden' : ''}>
				<p class="hm-kicker">Line ${l.n}</p>
				<h2>${esc(l.t)}</h2>
				<div class="cs-body">${l.body}</div>
				${l.form ? `<form class="cs-form" onsubmit="event.preventDefault(); this.innerHTML='<p class=cs-done>Received. (Prototype: nothing was sent.)</p>'">
					<label><span>Name</span><input autocomplete="name" required></label>
					<label><span>Email</span><input type="email" autocomplete="email" required></label>
					<label class="cs-wide"><span>Message</span><textarea rows="4" required></textarea></label>
					<label class="cs-wide cs-consent"><input type="checkbox" required><span>My details may be used to reply (<a href="legal-layers.html">privacy</a>).</span></label>
					<div class="cs-wide cs-send"><button class="ct-button">Send</button><span class="pg-ph-inline">routes to the “${esc(l.t)}” inbox</span></div>
				</form>` : ''}
			</section>`).join('')}
		</div>
	</div>
</div>`, 'Contact', 'contact-switchboard.html');

const tabs = [...document.querySelectorAll('.cs-line')];
function pick(i, focus) {
	tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; document.getElementById(t.getAttribute('aria-controls')).hidden = i !== j; });
	if (focus) tabs[i].focus();
	history.replaceState(null, '', '#' + LINES[i].id);
}
tabs.forEach((t, i) => {
	t.addEventListener('click', () => pick(i));
	t.addEventListener('keydown', e => { const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); pick((i + k + tabs.length) % tabs.length, true); } });
});
const h = LINES.findIndex(l => '#' + l.id === location.hash);
if (h > 0) pick(h);
