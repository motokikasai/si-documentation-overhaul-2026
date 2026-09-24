/* contact-desk.js — Contact, draft C "The Desk".
 * Answers before the form. Most messages ask something the site can answer at
 * once; those answers come first, as a searchable list. The form is small and
 * sits beside them, and the postal addresses close the page. */
import { esc, nf, getJSON, mount, nextWeekly, fmtLocal, localZone } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const fri = nextWeekly(5, 11, 0);
const QA = [
	['How do I join the Friday meeting?', `The International Peace Coalition meets on Zoom every Friday at 11:00 ET${fri ? ` — ${esc(fmtLocal(fri))} where you are (${esc(localZone())})` : ''}.`, 'join-week.html', 'Get the link'],
	['Where are the webcasts and conference videos?', `${nf(now.counts.videos)} recordings are in the video archive, by series and by conference.`, '#', 'Open the videos'],
	['I want to send a question during a live conference.', 'Send it to the moderators while the event is running.', 'mailto:questions@schillerinstitute.org', 'questions@schillerinstitute.org'],
	['How do I find an article I read years ago?', `All ${nf(now.counts.articles)} articles since ${now.counts.first_year} are searchable by word, year and subject.`, 'search-concordance.html', 'Search the archive'],
	['Is there a chorus near me?', `Choruses sing in New York, Boston, Houston, Virginia and on the West Coast. “${esc(facts.sing.quote)}”`, facts.sing.url, 'Find a chorus'],
	['Who is behind the Institute, legally?', 'In Germany: Schiller-Institut, Vereinigung für Staatskunst e.V., Vereinsregister AG Hannover Nr. 5204.', 'legal-letterhead.html', 'Impressum'],
	['How is the Institute funded?', 'By members and donors — no state funding, no large commercial backers.', 'donate-facts.html', 'Support the work'],
];

mount(`
<div class="ct-container cd-wrap">
	<header class="cd-head">
		<p class="si-eyebrow si-eyebrow--ruled">Contact</p>
		<h1 class="cd-title">How can we help?</h1>
		<label class="si-search cd-filter"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.6"/></svg><input type="search" placeholder="Type your question — e.g. chorus, video, Friday" aria-label="Filter the answers"></label>
	</header>
	<div class="cd-grid">
		<section class="cd-answers" aria-label="Answers">
			<ul>${QA.map(([q, a, href, act]) => `<li class="cd-qa"><details><summary>${esc(q)}</summary><div><p>${a}</p><a class="si-link si-arrow" href="${esc(href)}">${esc(act)}</a></div></details></li>`).join('')}</ul>
			<p class="cd-none" hidden>No ready answer for that — write to us instead.</p>
		</section>
		<aside class="cd-form-box">
			<h2>Still need us?</h2>
			<form class="cd-form" onsubmit="event.preventDefault(); this.innerHTML='<p class=cd-done>Thank you. A person will reply. (Prototype: nothing was sent.)</p>'">
				<label><span>Your email</span><input type="email" autocomplete="email" required></label>
				<label><span>About</span><select><option>Taking part</option><option>Press</option><option>Membership or a donation</option><option>The archive — a correction or a document</option><option>Something else</option></select></label>
				<label><span>Message</span><textarea rows="5" required></textarea></label>
				<label class="cd-consent"><input type="checkbox" required><span>My details may be used to reply (<a href="legal-code.html">privacy</a>).</span></label>
				<button class="ct-button">Send</button>
				<p class="pg-ph-inline">NationBuilder form / reply-time commitment to be agreed</p>
			</form>
		</aside>
	</div>
	<section class="cd-post" aria-label="By post">
		<article class="cd-card"><p class="hm-kicker">Germany</p><address>Schiller-Institut e.V.<br>Postfach 140163<br>D-65208 Wiesbaden</address><p><a href="mailto:si@schiller-institut.de">si@schiller-institut.de</a></p><p class="si-source">From the <a href="${esc(facts.impressum_de.url)}">Impressum</a></p></article>
		<article class="cd-card cd-card--ph"><p class="hm-kicker">United States</p><div class="pg-ph"><b>Address</b>US office — to be supplied</div></article>
		<article class="cd-card cd-card--ph"><p class="hm-kicker">Other countries</p><div class="pg-ph"><b>Directory</b>national institutes — to be supplied</div></article>
	</section>
</div>`, 'Contact', 'contact-desk.html');

/* the filter narrows the answers as the reader types; nothing found → the form */
const input = document.querySelector('.cd-filter input');
const items = [...document.querySelectorAll('.cd-qa')];
const none = document.querySelector('.cd-none');
input.addEventListener('input', () => {
	const w = input.value.toLowerCase().split(/\s+/).filter(x => x.length > 2);
	let shown = 0;
	items.forEach(li => {
		const ok = !w.length || w.some(x => li.textContent.toLowerCase().includes(x));
		li.hidden = !ok; if (ok) shown++;
		li.querySelector('details').open = ok && w.length > 0 && shown === 1;
	});
	none.hidden = shown > 0;
	document.querySelector('.cd-form-box').classList.toggle('is-called', shown === 0);
});
