/* donate-purpose.js — Donate, draft B "What It Keeps Going".
 * Outcome-framed giving: the reader picks the part of the work a gift keeps
 * going, each shown with its real, current numbers, and the button names it.
 * "Where most needed" is the default, so choosing is never a gate. */
import { esc, nf, fmtDate, getJSON, mount } from './pages-core.js';
import { giftForm, wireGift } from './donate-shared.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const firstConf = now.conferences.at(-1);
const PARTS = [
	{ id: 'all', t: 'Wherever it is most needed', n: '', d: 'The Institute decides; the most useful gift.', cta: 'Support the Institute' },
	{ id: 'ipc', t: 'The Friday coalition', n: `${now.counts.ipc_weeks} weeks`, d: 'The open weekly meeting of the International Peace Coalition, and its reports.', cta: 'Keep the Fridays going' },
	{ id: 'archive', t: 'The open archive', n: nf(now.counts.articles + now.counts.videos), d: `${nf(now.counts.articles)} articles and ${nf(now.counts.videos)} videos, free to all, in four languages.`, cta: 'Keep the archive open' },
	{ id: 'choruses', t: 'The choruses', n: '5 regions', d: 'Community choruses in New York, Boston, Houston, Virginia and on the West Coast, at the Verdi pitch.', cta: 'Keep the choruses singing' },
	{ id: 'conf', t: 'The conferences', n: `${now.counts.conferences_listed} listed`, d: `International conferences, with speakers from many nations — most recently ${esc(now.conferences[0].location || '')}, ${esc(fmtDate(now.conferences[0].start, 'month'))}.`, cta: 'Help convene the next one' },
];

mount(`
<div class="ct-container dp-wrap">
	<header class="dp-head">
		<p class="si-eyebrow si-eyebrow--ruled">Support the Institute</p>
		<h1 class="dp-title">What would you like to keep going?</h1>
	</header>
	<div class="dp-grid">
		<fieldset class="dp-parts"><legend class="si-visually-hidden">Choose a purpose</legend>
			${PARTS.map((p, i) => `<label class="dp-part${i === 0 ? ' dp-part--all' : ''}"><input type="radio" name="purpose" value="${p.id}"${i === 0 ? ' checked' : ''}>
				<span class="dp-card"><span class="dp-n">${esc(p.n)}</span><b>${esc(p.t)}</b><span class="dp-d">${p.d}</span><i class="dp-tick" aria-hidden="true"></i></span></label>`).join('')}
		</fieldset>
		<aside class="dp-ask">
			<p class="hm-kicker">Your gift</p>
			<p class="dp-for" aria-live="polite"></p>
			${giftForm({ id: 'dp', cta: 'Support the Institute' })}
			<p class="dp-honest">Earmarked gifts go to the purpose chosen. <span class="pg-ph-inline">earmarking policy — to be confirmed</span></p>
		</aside>
	</div>
	<p class="si-source dp-src">Numbers from the archive of 8 September 2026; the Friday count from <a href="${esc(now.ipc.cite.url)}">${esc(now.ipc.cite.title)}</a>; choruses from <a href="${esc(facts.choruses.url)}">${esc(facts.choruses.title)}</a>.</p>
</div>`, 'Donate', 'donate-purpose.html');

const form = document.getElementById('dp');
const go = form.querySelector('.dg-go'), label = document.querySelector('.dp-for');
function sync() {
	const p = PARTS.find(x => x.id === document.querySelector('input[name=purpose]:checked').value);
	go.textContent = p.cta; label.textContent = p.id === 'all' ? 'Where it is most needed' : p.t;
}
document.querySelector('.dp-parts').addEventListener('change', sync);
wireGift(form); sync();
