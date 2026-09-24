/* donate-facts.js — Donate, draft A "The Plain Facts".
 * Wikipedia's fundraising tests found that plain, checkable facts outperform
 * emotional appeals. So: four facts, each verifiable on this site, then one
 * form, monthly first. No urgency devices, no countdowns, no guilt. */
import { esc, nf, fmtDate, getJSON, mount } from './pages-core.js';
import { giftForm, wireGift } from './donate-shared.js';

const [facts, now] = await Promise.all([getJSON('facts.json'), getJSON('now.json')]);
const L = now.counts.languages_articles;

const FACTS = [
	['No state money', 'The Institute receives no state funding and no money from large commercial backers. Members and donors pay for all of it.', `<span class="df-de">„${esc(facts.funding_de.quote)}“</span> — <a href="${esc(facts.funding_de.url)}">${esc(facts.funding_de.title)}</a> (German; English is our translation)`],
	[`${now.counts.ipc_weeks} Fridays`, `The International Peace Coalition has met every week for ${now.counts.ipc_weeks} weeks without a break. Anyone may attend, free.`, `<a href="${esc(now.ipc.cite.url)}">${esc(now.ipc.cite.title)}</a>, ${esc(fmtDate(now.ipc.cite.date))}`],
	[`${nf(now.counts.articles + now.counts.videos)} works, no paywall`, `${nf(now.counts.articles)} articles and ${nf(now.counts.videos)} recorded videos are open to everyone, in English, German, Russian and Chinese.`, `Archive of 8 September 2026 · English ${nf(L.en)} · Deutsch ${nf(L.de)} · Русский ${nf(L.ru)}`],
	['One registered association', 'In Germany the Institute is a registered association, Vereinsregister AG Hannover Nr. 5204, with published postal address and contact.', `<a href="${esc(facts.register_de.url)}">Impressum</a>`],
];

mount(`
<div class="ct-container df-wrap">
	<section class="df-facts">
		<p class="si-eyebrow si-eyebrow--ruled">Support the Institute</p>
		<h1 class="df-title">Four facts, <em>then the ask.</em></h1>
		<ol class="df-list">${FACTS.map(([h, p, s], i) => `
			<li class="si-reveal" style="--i:${i}"><span class="df-n">${i + 1}</span><div><h2>${esc(h)}</h2><p>${esc(p)}</p><p class="si-source">${s}</p></div></li>`).join('')}
		</ol>
	</section>
	<aside class="df-ask">
		<div class="df-card">
			<p class="df-ask__lead">If the work is worth something to you, keep it going.</p>
			${giftForm({ id: 'df', cta: 'Continue to secure checkout' })}
		</div>
		<div class="df-trust">
			<p><b>Where the money goes.</b> <span class="pg-ph-inline">link to the published annual accounts — to be supplied</span></p>
			<p><b>Tax receipts.</b> <span class="pg-ph-inline">deductibility by country — to be confirmed by the Institute</span></p>
			<p><b>In Germany by PayPal or transfer:</b> the <a href="/de/mitglied-werden/">Jetzt Spenden</a> page remains, with PayPal and QR code.</p>
		</div>
	</aside>
</div>`, 'Donate', 'donate-facts.html');

wireGift(document.getElementById('df'));
