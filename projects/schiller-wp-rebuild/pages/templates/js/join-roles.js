/* join-roles.js — Join, draft C "Your Part".
 * Start from who the reader is. The roles are the Institute's own words — the
 * contact page's call to "Scientist, Engineer, Researcher, Philosopher, Singer,
 * Actor or Painter" — plus the student the youth conference was for. Each role
 * opens a three-step path made only of pages that exist. */
import { esc, nf, fmtDate, getJSON, mount, reduceMotion } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const T = Object.fromEntries(now.topics.map(t => [t.slug, t]));
const topic = s => ({ t: `${T[s].label}`, u: `/topic/${s}/`, n: `${nf(T[s].n)} articles` });
const friday = { t: 'Sit in on the Friday coalition', u: 'join-week.html', n: `${now.counts.ipc_weeks} weeks running` };
const write = { t: 'Tell us what you work on', u: 'contact-letter.html', n: 'A person reads it' };
const ROLES = [
	{ k: 'Scientist', g: 'sci', path: [{ t: 'Science', u: '/science/', n: 'The science page' }, topic('science-space'), write] },
	{ k: 'Engineer', g: 'sci', path: [topic('great-projects'), topic('energy-environment'), write] },
	{ k: 'Researcher', g: 'sci', path: [topic('physical-economy'), { t: 'Search the archive', u: 'search-concordance.html', n: `${nf(now.counts.articles)} articles since ${now.counts.first_year}` }, write] },
	{ k: 'Philosopher', g: 'hum', path: [{ t: 'Who is Schiller?', u: '/who-is-schiller/', n: 'The 1984 founding film, as text' }, topic('history-method'), write] },
	{ k: 'Singer', g: 'art', path: [{ t: 'Find a chorus', u: facts.sing.url, n: '“Everyone can sing”' }, { t: 'Daily Beethoven — Sparks of Joy', u: '/daily-beethoven-sparks-of-joy/', n: `${facts.daily_beethoven_videos} episodes` }, topic('classical-culture')] },
	{ k: 'Actor', g: 'art', path: [{ t: 'Shakespeare in Exile', u: '/shakespeare-in-exile/', n: 'Page' }, topic('classical-culture'), write] },
	{ k: 'Painter', g: 'art', path: [{ t: 'Leonore — Art, Science and Statecraft', u: '/leonore-magazine-art-science-and-statecraft/', n: 'The magazine' }, topic('classical-culture'), write] },
	{ k: 'Student', g: 'young', path: [{ t: 'Young People of the World, Unite!', u: facts.youth.url, n: `${fmtDate(facts.youth.date, 'month')} · 37 nations` }, { t: 'The International LaRouche Youth Movement', u: '/the-international-larouche-youth-movement/', n: 'Page' }, friday] },
];

mount(`
<div class="ct-container jr-wrap">
	<header class="jr-head">
		<p class="si-eyebrow si-eyebrow--ruled">Join</p>
		<h1 class="jr-title">I am a <span class="jr-slot" aria-hidden="true"></span><span class="si-visually-hidden jr-slot-sr">${ROLES.map(r => r.k.toLowerCase()).join(', ')} — choose your field below</span></h1>
		<p class="jr-lead">“${esc(facts.contact_call.quote)} — in whichever field you have gathered expertise…” <span class="si-source">— <a href="${esc(facts.contact_call.url)}">${esc(facts.contact_call.title)}</a></span></p>
	</header>
	<div class="jr-roles" role="radiogroup" aria-label="Your field">${ROLES.map((r, i) => `<button class="jr-role" role="radio" aria-checked="false" data-i="${i}" data-g="${r.g}">${esc(r.k)}</button>`).join('')}</div>
	<section class="jr-path" hidden>
		<ol>${[0, 1, 2].map(i => `<li class="jr-step" style="--i:${i}"><span class="jr-n">${i + 1}</span><a href="#"><b></b><small></small></a></li>`).join('')}</ol>
		<div class="jr-then">
			<p><b>Then, whoever you are:</b></p>
			<form class="hm-signup" onsubmit="event.preventDefault()"><label class="si-visually-hidden" for="jr-mail">Email</label><input id="jr-mail" type="email" placeholder="you@example.org" autocomplete="email"><button class="ct-button">Keep me in the loop</button></form>
			<p class="hm-fine">The newsletter, with your field noted so invitations fit. <span class="pg-ph-inline">NationBuilder tag = role</span></p>
		</div>
	</section>
	<p class="jr-hint">Choose the word that fits you best.</p>
</div>`, 'Join', 'join-roles.html');

const slot = document.querySelector('.jr-slot'), path = document.querySelector('.jr-path'), hint = document.querySelector('.jr-hint');
const btns = [...document.querySelectorAll('.jr-role')];
function choose(i) {
	const r = ROLES[i];
	stopTyping();
	btns.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)));
	slot.textContent = r.k.toLowerCase() + '.';
	document.querySelector('.jr-slot-sr').textContent = `${r.k.toLowerCase()}. Your path:`;
	slot.classList.remove('is-in'); void slot.offsetWidth; slot.classList.add('is-in');
	path.querySelectorAll('.jr-step').forEach((li, k) => {
		const s = r.path[k]; const a = li.querySelector('a');
		a.href = s.u; a.querySelector('b').textContent = s.t; a.querySelector('small').textContent = s.n;
		li.classList.remove('is-in'); void li.offsetWidth; li.classList.add('is-in');
	});
	path.hidden = false; hint.hidden = true;
}
btns.forEach((b, i) => b.addEventListener('click', () => choose(i)));

/* Until the reader picks, the headline types a role, holds it, rubs it out and
   types the next one. Slow on purpose: the word is meant to be read, not
   watched. The span is aria-hidden and a static list carries the same words for
   a screen reader, so nothing is announced letter by letter. */
/* No punctuation while the words cycle: the sentence is in the READER's voice,
   so "I am a scientist?" would read as someone unsure of their own trade. The
   caret already says this word is being filled in. The full stop arrives only
   when they choose one, and the sentence becomes theirs. */
const TYPE = 95, ERASE = 45, HOLD = 3600, GAP = 500;
let timer = null, typing = true;
function stopTyping() { typing = false; clearTimeout(timer); slot.classList.remove('is-typing'); }
function cycle(i = 0, n = 0, erasing = false) {
	if (!typing) return;
	const word = ROLES[i].k.toLowerCase();
	slot.textContent = erasing ? word.slice(0, n) : word.slice(0, n);
	if (!erasing && n === word.length) timer = setTimeout(() => cycle(i, n, true), HOLD);
	else if (erasing && n === 0) timer = setTimeout(() => cycle((i + 1) % ROLES.length, 0, false), GAP);
	else timer = setTimeout(() => cycle(i, n + (erasing ? -1 : 1), erasing), erasing ? ERASE : TYPE);
}
if (reduceMotion) { slot.textContent = ROLES[0].k.toLowerCase(); typing = false; }
else { slot.classList.add('is-typing'); cycle(); }
