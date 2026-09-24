/* donate-membership.js — Donate, draft C "Membership".
 * Membership as the frame: belonging, not a transaction. The one membership the
 * archive documents (Germany: €120 a year minimum, Ibykus twice a year) is set
 * out exactly; other countries are placeholders. A membership card fills in
 * with the reader's name as they type — the thing they are joining, made visible. */
import { esc, getJSON, mount } from './pages-core.js';
import { giftForm, wireGift } from './donate-shared.js';

const facts = await getJSON('facts.json');
const year = new Date().getFullYear();

mount(`
<div class="ct-container dm-wrap">
	<header class="dm-head">
		<p class="si-eyebrow si-eyebrow--ruled">Membership</p>
		<h1 class="dm-title">Become a member of the <em>Schiller Institute</em></h1>
		<p class="dm-lead">Members carry the Institute: no state funding, no large commercial backers, only members and donors.</p>
	</header>

	<div class="dm-grid">
		<section class="dm-join">
			<div class="dm-card-stage" aria-hidden="true">
				<div class="dm-card">
					<div class="dm-card__ring"><span>SI</span></div>
					<p class="dm-card__org">The Schiller Institute</p>
					<p class="dm-card__name">Your name</p>
					<p class="dm-card__meta"><span>Member since ${year}</span><span class="dm-card__where">—</span></p>
				</div>
			</div>
			<form class="dm-form" onsubmit="event.preventDefault()">
				<label><span>Name</span><input name="n" autocomplete="name" placeholder="Your name"></label>
				<label><span>Country</span><select name="c"><option value="">Choose…</option><option value="de">Germany</option><option value="us">United States</option><option value="fr">France</option><option value="other">Another country</option></select></label>
				<div class="dm-terms" aria-live="polite"></div>
				<button class="ct-button">Continue</button>
			</form>
		</section>

		<aside class="dm-side">
			<article class="dm-tier">
				<p class="hm-kicker">In Germany, today</p>
				<p class="dm-price">€120 <span>a year, at least</span></p>
				<ul><li>Two issues a year of <i>Ibykus</i>, the magazine of poetry, science and statecraft</li><li>The amount is a guide: members may give what they choose</li></ul>
				<p class="si-source">„${esc(facts.membership_de.quote)} Ibykus-Magazin“ — <a href="${esc(facts.membership_de.url)}">${esc(facts.membership_de.title)}</a></p>
			</article>
			<article class="dm-tier dm-tier--gift">
				<p class="hm-kicker">Not ready to join?</p>
				${giftForm({ id: 'dm', cta: 'Give instead' })}
			</article>
		</aside>
	</div>
</div>`, 'Donate', 'donate-membership.html');

const f = document.querySelector('.dm-form');
const nameEl = document.querySelector('.dm-card__name'), whereEl = document.querySelector('.dm-card__where'), terms = document.querySelector('.dm-terms');
const TERMS = {
	de: '<b>€120 a year minimum</b>, with two issues of Ibykus. <span class="si-source">(As published on the German membership page.)</span>',
	us: '<span class="pg-ph-inline">US membership terms — to be supplied</span>',
	fr: '<span class="pg-ph-inline">French membership terms — to be supplied</span>',
	other: '<span class="pg-ph-inline">membership terms for other countries — to be supplied</span>',
};
f.addEventListener('input', () => {
	nameEl.textContent = f.n.value.trim() || 'Your name';
	document.querySelector('.dm-card').classList.toggle('is-named', !!f.n.value.trim());
	whereEl.textContent = f.c.selectedOptions[0]?.value ? f.c.selectedOptions[0].text : '—';
	terms.innerHTML = TERMS[f.c.value] || '';
});
wireGift(document.getElementById('dm'));

/* the card tilts toward the pointer — a small reward, off for reduced motion */
const card = document.querySelector('.dm-card');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
	const stage = document.querySelector('.dm-card-stage');
	stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`; });
	stage.addEventListener('pointerleave', () => { card.style.transform = ''; });
}
