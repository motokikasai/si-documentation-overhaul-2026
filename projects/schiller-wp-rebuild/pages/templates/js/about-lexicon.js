/* about-lexicon.js — About, draft B "The Lexicon".
 * The Institute defined the way a dictionary defines a word: pronunciation,
 * part of speech, numbered senses, etymology, usage, "see also", and the name
 * in other languages. Every sense carries its citation, like a real lexicon. */
import { esc, nf, fmtDate, getJSON, mount, medallion } from './pages-core.js';

const [facts, now, V, R] = await Promise.all([getJSON('facts.json'), getJSON('now.json'), getJSON('voices.json'), getJSON('record.json')]);
const rec = l => R.record.find(r => r.label.startsWith(l));
const cite = (c, pre = '') => `<cite>${pre}<a href="${esc(c.url)}">${esc(c.title)}</a>${c.date ? `, ${esc(fmtDate(c.date))}` : ''}</cite>`;

const SENSES = [
	{ tag: 'institution', def: `A policy institute founded in 1984 on the initiative of Helga Zepp-LaRouche, “${esc(facts.founding.quote.replace(/^The Schiller Institute was founded in 1984 on the initiative of Helga Zepp-LaRouche, wife of the American statesman and physical economist Lyndon LaRouche, /, ''))}”.`, c: facts.founding },
	{ tag: 'programme', def: `An argument for peace through development: corridors of rail, water and power across Eurasia and beyond — “${esc(rec('The Eurasian Land-Bridge').cite.quote)}”.`, c: rec('The Eurasian Land-Bridge').cite },
	{ tag: 'movement', def: `A weekly practice: ${esc(facts.ipc_report.quote.replace(/\.$/, ''))}.`, c: facts.ipc_report },
	{ tag: 'culture', def: `A network of community choruses — “${esc(facts.choruses.quote)}”.`, c: facts.choruses },
	{ tag: 'platform', def: `A meeting place: ${nf(now.counts.people)} people on record in the archive, among them —`, voices: V.voices.slice(1, 7) },
];

mount(`
<article class="al-entry ct-container">
	<header class="al-head">
		<p class="al-guide"><span>Schiller Institute</span><span>— Schiller Institute, the —</span><span>Schiller-Institut</span></p>
		<h1 class="al-word">Schil<i>·</i>ler In<i>·</i>sti<i>·</i>tute</h1>
		<p class="al-pron"><span>/ˈʃɪl.ər ˈɪn.stɪ.tjuːt/</span> <i>n.</i> <span class="al-since">since 1984</span></p>
	</header>

	<ol class="al-senses">${SENSES.map((s, i) => `
		<li class="si-reveal" style="--i:${i}">
			<p><span class="al-tag">${s.tag}</span> ${s.def}</p>
			${s.voices ? `<ul class="al-voices">${s.voices.map(v => `<li><a href="${esc(v.url)}">${medallion(v, 36)}<span><b>${esc(v.name)}</b>${esc(v.title)}</span></a></li>`).join('')}</ul>` : cite(s.c, '— ')}
		</li>`).join('')}
	</ol>

	<section class="al-block si-reveal"><h2>Etymology</h2>
		<p>From <b>Friedrich Schiller</b> (1759–1805), poet of freedom; chosen for the conviction that a great purpose enlarges the one who serves it:</p>
		<blockquote>${esc(facts.noble_cause.quote)}</blockquote>
		${cite(facts.noble_cause, '— Schiller, quoted in ')}
	</section>

	<section class="al-block si-reveal"><h2>Usage</h2>
		<p class="al-usage">“…${esc(facts.world_citizen.quote)}.”</p>
		<cite>— Lyndon LaRouche, Berlin, 12 October 1988; in <a href="${esc(facts.world_citizen.url)}">${esc(facts.world_citizen.title)}</a></cite>
		<p class="al-usage">“${esc(facts.dignity.quote)}”</p>
		${cite(facts.dignity, '— Schiller, <i>Die Künstler</i>; in ')}
	</section>

	<section class="al-block al-cols si-reveal">
		<div><h2>In other languages</h2>
			<dl class="al-langs">
				<div><dt>de</dt><dd>Schiller-Institut, Vereinigung für Staatskunst e.V.</dd></div>
				<div><dt>articles</dt><dd>English ${nf(now.counts.languages_articles.en)} · Deutsch ${nf(now.counts.languages_articles.de)} · Русский ${nf(now.counts.languages_articles.ru)}</dd></div>
			</dl>
			<p class="si-source">German name from <a href="${esc(facts.impressum_de.url)}">${esc(facts.impressum_de.title)}</a></p>
		</div>
		<div><h2>See also</h2>
			<ul class="al-see">
				<li><a href="../../articles/templates/articles-ledger.html">Articles</a> <span>${nf(now.counts.articles)}</span></li>
				<li><a href="../../people/templates/people-register.html">People</a> <span>${nf(now.counts.people)}</span></li>
				<li><a href="#">Videos</a> <span>${nf(now.counts.videos)}</span></li>
				<li><a href="#">Conferences</a> <span>${nf(now.counts.conferences_listed)}</span></li>
				<li><a href="${esc(facts.declaration.url)}">Declaration of the Inalienable Rights of Man</a> <span>1984</span></li>
			</ul>
		</div>
	</section>

	<footer class="al-foot si-reveal">
		<p>To take part: <a href="join-ladder.html">join</a>, <a href="contact-letter.html">write to us</a>, or <a href="donate-facts.html">become a member</a>.</p>
	</footer>
</article>`, 'About', 'about-lexicon.html');
