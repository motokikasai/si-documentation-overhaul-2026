/* about-founding.js — About, draft A "The Founding".
 * The institution told outward from its founding documents: the founding
 * sentence, the 1984 declaration (with the archive's own photograph of it), the
 * namesake, the founder, then what the archive actually writes about. */
import { esc, nf, fmtDate, getJSON, mount, medallion } from './pages-core.js';

const [facts, now, V] = await Promise.all([getJSON('facts.json'), getJSON('now.json'), getJSON('voices.json')]);
const hzl = V.voices.find(v => v.key === 'helga-zepp-larouche');
const up = 'https://schillerinstitute.com/wp-content/uploads/';
const topics = [...now.topics].sort((a, b) => b.n - a.n);
const tmax = topics[0].n;

mount(`
<header class="ab-head ct-container">
	<p class="si-eyebrow si-eyebrow--ruled">About</p>
	<h1 class="ab-title">The Schiller Institute</h1>
	<p class="ab-founding">${esc(facts.founding.quote)}.</p>
	<p class="si-source">From <a href="${esc(facts.founding.url)}">${esc(facts.founding.title)}</a>, ${esc(fmtDate(facts.founding.date))}</p>
</header>

<section class="ab-decl" aria-labelledby="ab-h-decl">
	<div class="ct-container ab-decl__grid">
		<figure class="ab-doc si-reveal"><img src="${up}2016/11/declaration-inalienable_rights_of_man_0.png" alt="The 'Declaration of the Inalienable Rights of Man' was drafted and adopted by the international Schiller Institute as its founding document in November 1984." width="527" height="723"></figure>
		<div class="si-reveal">
			<p class="hm-kicker">The founding document</p>
			<h2 class="ab-h2" id="ab-h-decl">The Declaration of the Inalienable Rights of Man</h2>
			<p class="ab-text">${esc(facts.declaration.quote)}</p>
			<p class="si-source">From <a href="${esc(facts.declaration.url)}">${esc(facts.declaration.title)}</a></p>
			<a class="si-btn-ghost ab-read" href="${esc(facts.declaration.url)}">Read the Declaration</a>
		</div>
	</div>
</section>

<section class="ab-two ct-container" aria-label="The namesake and the founder">
	<article class="ab-card si-reveal">
		<p class="hm-kicker">The namesake</p>
		<figure class="ab-portrait"><img src="${up}2018/02/schiller.jpg" alt="Johann Christoph Friedrich von Schiller" width="256" height="300"></figure>
		<h2 class="ab-h3">Friedrich Schiller, 1759–1805</h2>
		<blockquote class="ab-verse">${esc(facts.noble_cause.quote).replace(/([.;]) /g, '$1<br>').replace(/ (Arouse|But)/g, '<br>$1')}</blockquote>
		<p class="si-source">Quoted at the head of <a href="${esc(facts.noble_cause.url)}">${esc(facts.noble_cause.title)}</a>, the text of the film shown at the founding conference in 1984.</p>
	</article>
	<article class="ab-card si-reveal" style="--i:1">
		<p class="hm-kicker">The founder</p>
		<figure class="ab-portrait ab-portrait--wide"><img src="${up}2012/12/helga-larouche_inalienable-rights-of-man-EIRNS1984_0.png" alt="Helga Zepp-LaRouche, founder of the international Schiller Institute, holds its founding document, the Declaration of the Inalienable Rights of Man" width="800" height="564"><figcaption>Helga Zepp-LaRouche, founder of the international Schiller Institute, holds its founding document, the Declaration of the Inalienable Rights of Man.</figcaption></figure>
		<h2 class="ab-h3"><a href="${esc(hzl.url)}">${esc(hzl.name)}</a></h2>
		<p class="ab-role">${esc(hzl.title)} · ${hzl.n} appearances in the archive</p>
	</article>
</section>

<section class="ab-work ct-container si-reveal" aria-labelledby="ab-h-work">
	<p class="hm-kicker">The work, by what the archive writes about</p>
	<h2 class="ab-h2" id="ab-h-work">${nf(now.counts.articles)} articles since ${now.counts.first_year}, in ten subjects</h2>
	<ol class="ab-topics">${topics.map(t => `<li><a href="/topic/${esc(t.slug)}/"><span class="ab-topic__l">${esc(t.label)}</span><span class="ab-topic__bar" style="--w:${(t.n / tmax * 100).toFixed(1)}%"></span><span class="ab-topic__n">${nf(t.n)}</span></a></li>`).join('')}</ol>
	<p class="si-source">Articles carrying each reviewed topic; an article may carry more than one.</p>
</section>

<section class="ab-close ct-container si-reveal" aria-label="Next">
	<a href="join-ladder.html"><span class="hm-kicker">Take part</span><b>Join the movement</b></a>
	<a href="../../people/templates/people-register.html"><span class="hm-kicker">${nf(now.counts.people)} people</span><b>Who speaks here</b></a>
	<a href="contact-letter.html"><span class="hm-kicker">Write</span><b>Contact us</b></a>
	<a href="donate-facts.html"><span class="hm-kicker">Support</span><b>Become a member</b></a>
</section>`, 'About', 'about-founding.html');
