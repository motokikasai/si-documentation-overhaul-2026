/* legal-layers.js — Legal, draft C "The Layers".
 * The layered notice data-protection regulators recommend: layer one is a
 * single screen — every service the NEW site uses, why, and whether today's
 * text covers it (taken from the project's own decisions, not invented);
 * layer two is the full text beneath. The gaps are shown, because they are
 * the work that must be done before launch. */
import { esc, mount, enhanceProse } from './pages-core.js';
import { legal, clauses, SERVICES } from './legal-shared.js';

const D = await legal();
const C = clauses(D.privacy.de);
const gap = s => s.covered === 'no' || s.covered.startsWith('partly');

mount(`
<div class="ct-container ll-wrap">
	<header class="ll-head">
		<p class="si-eyebrow si-eyebrow--ruled">Privacy · at a glance</p>
		<h1 class="ll-title">Your data on this site, <em>on one screen</em></h1>
		<p class="ll-lead">What is collected, by whom, and why. The full notice follows below.</p>
	</header>
	<section class="ll-layer1" aria-label="Summary">
		<table class="ll-table">
			<thead><tr><th scope="col">When you…</th><th scope="col">Handled by</th><th scope="col">Why</th><th scope="col">Legal basis</th><th scope="col">In today’s notice?</th></tr></thead>
			<tbody>${SERVICES.map(s => `<tr class="${gap(s) ? 'is-gap' : ''}"><th scope="row">${esc(s.what)}</th><td>${esc(s.who)}</td><td>${esc(s.why)}</td><td><span class="pg-ph-inline">Art. 6 basis — counsel</span></td><td class="ll-cov"><span class="ll-dot" aria-hidden="true"></span>${esc(s.covered)}</td></tr>`).join('')}</tbody>
		</table>
		<p class="ll-key"><span class="ll-dot ll-dot--gap"></span> ${SERVICES.filter(gap).length} of ${SERVICES.length} uses of data are not yet covered by the notice in force — to fix before launch. Rows come from the project’s decisions: NationBuilder for people and money, two-click youtube-nocookie video, self-hosted fonts, GA4 planned.</p>
		<div class="ll-rights"><h2>Your rights</h2><p>Access, correction, deletion, restriction, portability, objection, and withdrawal of consent — set out in §10 below. <span class="pg-ph-inline">data-protection contact — to be supplied</span></p></div>
	</section>
	<section class="ll-layer2" aria-labelledby="ll-h-full">
		<div class="ll-l2head"><h2 id="ll-h-full">The full notice <span>Deutsch · in force</span></h2><p class="si-source">English: “${esc(D.facts.privacy_en_now.quote)}” — <span class="pg-ph-inline">owed</span></p></div>
		<div class="ll-fold">${C.map(c => `<details lang="de"${c.n === '0' ? ' open' : ''}><summary>${c.n === '0' ? 'Einleitung' : `§ ${c.n} · ${esc(c.title)}`}</summary><div class="si-prose">${c.html}</div></details>`).join('')}</div>
		<details class="ll-imp"><summary>Impressum</summary><div class="si-prose" lang="de">${D.impressum.de}</div></details>
	</section>
</div>`, 'Legal', 'legal-layers.html');

document.querySelectorAll('.si-prose').forEach(enhanceProse);
