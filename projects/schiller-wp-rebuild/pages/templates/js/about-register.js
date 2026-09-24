/* about-register.js — About, draft C "The Register".
 * The institution set out like a public register entry: fields a sceptical
 * reader checks before trusting anyone, each field with its source. Where the
 * archive does not hold the fact, the field says so as a placeholder instead
 * of inventing it. */
import { esc, nf, fmtDate, getJSON, mount, medallion } from './pages-core.js';

const [facts, now, V] = await Promise.all([getJSON('facts.json'), getJSON('now.json'), getJSON('voices.json')]);
const hzl = V.voices.find(v => v.key === 'helga-zepp-larouche');
const src = c => `<a href="${esc(c.url)}">${esc(c.title)}</a>${c.date ? ', ' + esc(fmtDate(c.date, 'short')) : ''}`;
const ph = t => `<span class="pg-ph-inline">${esc(t)}</span>`;

const ROWS = [
	['Name', `The Schiller Institute<br><span class="ar-alt">Schiller-Institut, Vereinigung für Staatskunst e.V.</span>`, src(facts.impressum_de)],
	['Founded', `1984, on the initiative of Helga Zepp-LaRouche`, src(facts.founding)],
	['Founding document', `Declaration of the Inalienable Rights of Man, adopted 24 November 1984 by over 1,500 citizens from more than fifty countries`, src(facts.declaration)],
	['Legal form (Germany)', `Eingetragener Verein (registered association)<br><span class="ar-mono">Vereinsregister 31.07.1985 · AG Hannover · Nr. 5204</span>`, src(facts.register_de)],
	['Postal address (Germany)', `Postfach 140163, D-65208 Wiesbaden`, src(facts.impressum_de)],
	['Other national institutes', ph('list of national institutes, their legal form and address — to be supplied'), ''],
	['Founder and President', `<span class="ar-person">${medallion(hzl, 40)}<a href="${esc(hzl.url)}">${esc(hzl.name)}</a></span>`, 'People register (sourced title)'],
	['Funding', `No state funding and no large commercial backers: financed exclusively by membership fees and donations.<br><span class="ar-alt">„${esc(facts.funding_de.quote)}“</span>`, src(facts.funding_de) + ' · English is our translation'],
	['Published record', `${nf(now.counts.articles)} articles since ${now.counts.first_year} · ${nf(now.counts.videos)} videos · ${nf(now.counts.conferences_listed)} conferences listed · ${nf(now.counts.people)} people`, '2026-09-08 archive'],
	['Languages', `English ${nf(now.counts.languages_articles.en)} · Deutsch ${nf(now.counts.languages_articles.de)} · Русский ${nf(now.counts.languages_articles.ru)} articles`, '2026-09-08 archive'],
	['Weekly activity', `International Peace Coalition: ${now.counts.ipc_weeks} consecutive weekly meetings, by ${esc(fmtDate(now.counts.ipc_asof))}`, src(now.ipc.cite)],
	['Contact', `<a href="mailto:questions@schillerinstitute.org">questions@schillerinstitute.org</a> · <a href="mailto:si@schiller-institut.de">si@schiller-institut.de</a> (Germany)`, src(facts.questions_email)],
	['Annual report', ph('link to the latest annual / financial report, if published'), ''],
];

mount(`
<div class="ct-container ar-wrap">
	<header class="ar-head">
		<div>
			<p class="si-eyebrow si-eyebrow--ruled">About · the register</p>
			<h1 class="ar-title">Who we are, <em>on the record</em></h1>
			<p class="ar-lead">The facts you would look up before trusting an organisation, in one place, each with its source. Where we have not yet published a fact, the field says so.</p>
		</div>
		<div class="ar-seal" aria-hidden="true"><span>SI</span><small>1984</small></div>
	</header>
	<dl class="ar-sheet">${ROWS.map(([k, v, s], i) => `
		<div class="ar-row si-reveal" style="--i:${i % 4}"><dt><span class="ar-no">${String(i + 1).padStart(2, '0')}</span>${esc(k)}</dt><dd><div class="ar-v">${v}</div>${s ? `<div class="ar-s">${s}</div>` : ''}</dd></div>`).join('')}
	</dl>
	<aside class="ar-note si-reveal">
		<p><b>Found an error in this register?</b> Tell us and we will correct it, with the date of the correction shown here.</p>
		<a class="si-btn-ghost" href="contact-desk.html">Report a correction</a>
		<span class="pg-ph-inline">downloadable fact sheet (PDF)</span>
	</aside>
</div>`, 'About', 'about-register.html');
