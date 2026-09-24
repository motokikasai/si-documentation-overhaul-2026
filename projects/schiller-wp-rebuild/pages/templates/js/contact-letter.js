/* contact-letter.js — Contact, draft A "The Letter".
 * The form is a letter the reader completes. Their reason for writing sets who
 * reads it; the margin says so, so nobody writes into a void. Sending seals it. */
import { esc, getJSON, mount } from './pages-core.js';

const facts = await getJSON('facts.json');
const today = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
const REASONS = [
	['take part', 'I would like to take part in your work', 'Organising desk', null],
	['question', 'I have a question for a conference or webcast', 'The moderators, live', facts.questions_email],
	['sing', 'I would like to sing in a chorus', 'Chorus coordinators', null],
	['press', 'I am a journalist', 'Press desk', null],
	['document', 'I have a document or a correction for the archive', 'Archive editors', null],
	['other', 'I have something else to say', 'The general inbox', facts.questions_email],
];

mount(`
<div class="cl-desk ct-container">
	<header class="cl-intro">
		<p class="si-eyebrow si-eyebrow--ruled">Contact</p>
		<h1 class="cl-title">Write to us</h1>
		<p class="cl-lead">Every letter is read by a person. Fill in the blanks — the letter writes itself around them.</p>
	</header>
	<div class="cl-grid">
		<form class="cl-letter" onsubmit="return false" novalidate>
			<div class="cl-letterhead"><img src="../../brand/assets/lockup/lockup-light@2x.png" alt="" width="560" height="150"><span>${esc(today)}</span></div>
			<p class="cl-to">To the Schiller Institute,</p>
			<p>My name is <label class="cl-f"><span class="si-visually-hidden">Your name</span><input name="name" autocomplete="name" placeholder="your name" required size="16"></label>, and I write from <label class="cl-f"><span class="si-visually-hidden">City and country</span><input name="where" autocomplete="address-level2" placeholder="city, country" size="16"></label>.</p>
			<p>I am writing because <label class="cl-f cl-f--select"><span class="si-visually-hidden">Reason</span><select name="reason">${REASONS.map(([v, t]) => `<option value="${v}">${esc(t.replace(/^I /, 'I ').replace(/^./, c => c.toLowerCase()))}</option>`).join('')}</select></label>.</p>
			<label class="cl-body"><span class="si-visually-hidden">Your message</span><textarea name="msg" rows="6" placeholder="Say what you would like to say."></textarea></label>
			<p>You can reach me at <label class="cl-f"><span class="si-visually-hidden">Email</span><input name="email" type="email" autocomplete="email" placeholder="you@example.org" required size="22"></label>.</p>
			<p class="cl-sign">With best wishes,<br><span class="cl-sig" aria-live="polite">—</span></p>
			<label class="cl-consent"><input type="checkbox" required><span>I agree that my details are used to answer this letter (<a href="legal-letterhead.html">privacy</a>).</span></label>
			<div class="cl-send"><button class="ct-button" type="submit">Seal and send</button><span class="pg-ph-inline">NationBuilder / mail relay</span></div>
			<div class="cl-seal" aria-hidden="true"><span>SI</span></div>
		</form>
		<aside class="cl-margin" aria-live="polite">
			<p class="hm-kicker">Who reads it</p>
			<p class="cl-who"></p>
			<p class="cl-route"></p>
			<hr class="si-rule">
			<p class="hm-kicker">In Germany</p>
			<p class="cl-addr">Schiller-Institut e.V.<br>Postfach 140163<br>D-65208 Wiesbaden<br><a href="mailto:si@schiller-institut.de">si@schiller-institut.de</a></p>
			<p class="si-source">From the <a href="${esc(facts.impressum_de.url)}">Impressum</a></p>
		</aside>
	</div>
</div>`, 'Contact', 'contact-letter.html');

const f = document.querySelector('.cl-letter');
const who = document.querySelector('.cl-who'), route = document.querySelector('.cl-route'), sig = document.querySelector('.cl-sig');
function update() {
	const r = REASONS.find(x => x[0] === f.reason.value);
	who.textContent = r[2];
	route.innerHTML = r[3] ? `Delivered to <a href="mailto:questions@schillerinstitute.org">questions@schillerinstitute.org</a> <span class="si-source">(<a href="${esc(r[3].url)}">where that address is published</a>)</span>` : `<span class="pg-ph-inline">routing address for “${esc(r[2])}” — to be supplied</span>`;
	sig.textContent = f.name.value.trim() || '—';
}
f.addEventListener('input', update); f.addEventListener('change', update); update();
/* the inline fields grow with what is typed, so the sentence stays a sentence */
f.querySelectorAll('.cl-f input').forEach(i => i.addEventListener('input', () => { i.size = Math.max(i.placeholder.length, i.value.length + 1); }));
f.addEventListener('submit', () => {
	if (!f.checkValidity()) { f.reportValidity(); return; }
	f.classList.add('is-sealed');
	f.querySelector('.cl-send').innerHTML = '<p class="cl-thanks">Sealed. (Prototype: nothing was sent.)</p>';
});
