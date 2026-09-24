/* join-ladder.js — Join, draft A "The Ladder".
 * The ladder of engagement, drawn as a ladder: five rungs by what they cost the
 * reader, lowest first. Pointing at a rung lights the rails up to it. Every
 * rung has one action and one real thing behind it. */
import { esc, nf, fmtDate, getJSON, mount, nextWeekly, fmtLocal, localZone } from './pages-core.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const fri = nextWeekly(5, 11, 0);
const lastConf = now.conferences[0];
const RUNGS = [
	{ cost: 'Two minutes', t: 'Read with us', p: 'The week’s ideas, webcasts and invitations, by email. The gentlest way in.', act: 'form' },
	{ cost: 'One hour a week', t: 'Sit in on Friday', p: `The International Peace Coalition meets on Zoom every Friday at 11:00 ET — ${now.counts.ipc_weeks} weeks without a break.${fri ? ` Next: <b>${esc(fmtLocal(fri))}</b>, ${esc(localZone())}.` : ''}`, act: ['Get the Zoom link', 'join-week.html'] },
	{ cost: 'An evening a week', t: 'Sing in a chorus', p: `“${esc(facts.sing.quote)}” New York, Boston, Houston, Virginia, the West Coast.`, act: ['Find a chorus', facts.sing.url] },
	{ cost: 'A weekend', t: 'Come to a conference', p: `The most recent: <i>${esc(lastConf.title.replace(/ — .*$/, ''))}</i>, ${esc(lastConf.location || '')}, ${esc(fmtDate(lastConf.start, 'month'))}.`, act: ['Be told of the next one', '#'], ph: 'next si_conference date' },
	{ cost: 'A life’s work', t: 'Organise', p: `Build the movement where you live. In December 2025 the youth conference drew “${esc(facts.youth.quote)}”.`, act: ['Talk to an organiser', 'contact-switchboard.html#join'] },
];

mount(`
<div class="ct-container jl-wrap">
	<header class="jl-head">
		<p class="si-eyebrow si-eyebrow--ruled">Join</p>
		<h1 class="jl-title">Start on the rung <em>that fits your week.</em></h1>
		<p class="jl-lead">Five ways in, from two minutes to a life’s work. Nobody starts at the top; everyone can climb.</p>
	</header>
	<ol class="jl-ladder" style="--lit:0">
		<li class="jl-rails" aria-hidden="true"><span></span><span></span></li>
		${RUNGS.map((r, i) => `
		<li class="jl-rung si-reveal" data-i="${i + 1}" style="--i:${i}">
			<span class="jl-bar" aria-hidden="true"></span>
			<div class="jl-card">
				<p class="jl-cost">${esc(r.cost)}</p>
				<h2>${esc(r.t)}</h2>
				<p>${r.p}</p>
				${r.act === 'form'
					? `<form class="hm-signup" onsubmit="event.preventDefault()"><label class="si-visually-hidden" for="jl-mail">Email</label><input id="jl-mail" type="email" placeholder="you@example.org" autocomplete="email"><button class="ct-button">Sign up</button></form><p class="hm-fine">Double opt-in; unsubscribe any time. <span class="pg-ph-inline">NationBuilder</span></p>`
					: `<a class="si-link si-arrow jl-act" href="${esc(r.act[1])}">${esc(r.act[0])}</a>${r.ph ? ` <span class="pg-ph-inline">${esc(r.ph)}</span>` : ''}`}
			</div>
		</li>`).reverse().join('')}
	</ol>
</div>`, 'Join', 'join-ladder.html');

/* the rails light up to the rung the reader points at (or last reached) */
const ladder = document.querySelector('.jl-ladder');
const rungs = [...document.querySelectorAll('.jl-rung')];
const light = n => { ladder.style.setProperty('--lit', n); rungs.forEach(r => r.classList.toggle('is-lit', +r.dataset.i <= n)); };
rungs.forEach(r => {
	r.addEventListener('pointerenter', () => light(+r.dataset.i));
	r.addEventListener('focusin', () => light(+r.dataset.i));
});
ladder.addEventListener('pointerleave', () => light(0));
