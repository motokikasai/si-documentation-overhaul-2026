/* legal-letterhead.js — Legal, draft B "The Letterhead".
 * The Impressum is set as what it legally is — the Institute's letterhead: who
 * is responsible, where, registered how. Under it, the privacy notice as a
 * column of disclosures, one per numbered clause, closed until asked for. */
import { esc, mount, enhanceProse } from './pages-core.js';
import { legal, clauses } from './legal-shared.js';

const D = await legal();
const C = clauses(D.privacy.de).filter(c => c.n !== '0');
const intro = clauses(D.privacy.de)[0];

mount(`
<div class="ct-container lh-wrap">
	<section class="lh-sheet" aria-labelledby="lh-h-imp">
		<header class="lh-top"><img src="../../brand/assets/lockup/lockup-light@2x.png" alt="The International Schiller Institute" width="560" height="150"><p class="hm-kicker" id="lh-h-imp">Impressum</p></header>
		<div class="lh-cols">
			<div><p class="lh-k">Association</p><p class="lh-v">Schiller-Institut,<br>Vereinigung für Staatskunst e.V.</p></div>
			<div><p class="lh-k">Postal address</p><p class="lh-v">Postfach 140163<br>D-65208 Wiesbaden</p></div>
			<div><p class="lh-k">Register</p><p class="lh-v">Vereinsregister<br>31.07.1985 · AG Hannover · Nr. 5204</p></div>
			<div><p class="lh-k">Contact</p><p class="lh-v">Tel. +49 (0)611 2052065<br><a href="mailto:si@schiller-institut.de">si@schiller-institut.de</a></p></div>
			<div><p class="lh-k">Responsible for the German-language editorial content</p><p class="lh-v">Rainer Apel</p></div>
			<div><p class="lh-k">Responsible for the English-language content</p><p class="lh-v"><span class="pg-ph-inline">name and address — required, to be supplied</span></p></div>
		</div>
		<details class="lh-full"><summary>The Impressum as published, with its disclaimer (German)</summary><div class="si-prose" lang="de">${D.impressum.de}</div></details>
		<p class="si-source">From <a href="${esc(D.impressum.url)}">${esc(D.impressum.url)}</a> · telephone number and names as published there.</p>
	</section>

	<section class="lh-privacy" aria-labelledby="lh-h-priv">
		<p class="si-eyebrow si-eyebrow--ruled">Privacy</p>
		<h1 class="lh-title" id="lh-h-priv">What we do with your data</h1>
		<div class="lh-notice"><b>Only the German text is in force today.</b> The English privacy page reads: “${esc(D.facts.privacy_en_now.quote)}” <span class="pg-ph-inline">English text — owed before launch</span></div>
		<div class="lh-intro si-prose" lang="de">${intro.html}</div>
		<div class="lh-tools"><button type="button" class="si-btn-ghost lh-all">Open all</button><span>${C.length} clauses</span></div>
		<div class="lh-list">${C.map(c => `<details class="lh-q" lang="de"><summary><span>${c.n}</span>${esc(c.title)}</summary><div class="si-prose">${c.html}</div></details>`).join('')}</div>
	</section>
</div>`, 'Legal', 'legal-letterhead.html');

document.querySelectorAll('.si-prose').forEach(enhanceProse);
const all = document.querySelector('.lh-all');
all.addEventListener('click', () => { const open = all.textContent === 'Open all'; document.querySelectorAll('.lh-q').forEach(d => { d.open = open; }); all.textContent = open ? 'Close all' : 'Open all'; });
