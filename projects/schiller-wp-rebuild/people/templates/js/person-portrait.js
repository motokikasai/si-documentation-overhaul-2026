/* PROFILE DRAFT A · The Portrait — an editorial long-read.
 * Order of argument: who is this (credentials) → hear them (verified quotes)
 * → the life → the recordings → the writing and the press → the company kept
 * → where to go next. */
import {
	loadProfile, esc, medallion, heroPortrait, settleImages, reveal, reduceMotion,
	fmtDate, fmtMonth, clock, duration, LANG, LANG_NAME, KIND, plural, city,
	personHref, playModal, scrollSpy, companyLine, confLabel, nameHTML,
	figure, talkLength, sessionNote, talksHeading, thinNote,
} from './person-core.js';
import { draftStrip } from './person-proto.js';   // prototype-only review strip

const { data, p } = await loadProfile();
const main = document.querySelector('main');
document.title = `${p.name} — Schiller Institute`;
const F = p.figures;
const sig = p.talks.find(t => t.signature) || p.talks[0];
const quoteById = Object.fromEntries(p.quotes.map(q => [q.id, q]));

/* ---- hero -------------------------------------------------------------------- */
const since = F.first ? `In the archive since ${F.first}` : '';
const credQ = p.credentials_quote && quoteById[p.credentials_quote];
const hero = `
<section class="pa-hero" aria-labelledby="pa-name">
	<div class="ct-container pa-hero__grid">
		<figure class="pa-hero__portrait si-reveal">
			${heroPortrait(p, { ar: 0.8, fill: 0.62 })}
			${p.photo ? `<figcaption class="si-meta">Photograph: ${esc(p.credit || 'Schiller Institute')}</figcaption>` : ''}
		</figure>
		<div class="pa-hero__text">
			<p class="si-eyebrow si-eyebrow--ruled">${[p.archetype, p.country, since].filter(Boolean).map(esc).join(' · ') || 'Person'}</p>
			<h1 class="si-display pa-name" id="pa-name">${nameHTML(p.name)}</h1>
			${p.honorific ? `<p class="pa-honorific">${esc(p.honorific)}</p>` : ''}
			${p.standfirst ? `<p class="si-lead pa-standfirst">${esc(p.standfirst)}</p>` : ''}
			${p.credentials.length ? `<ol class="pa-ladder">
				${p.credentials.map((c, i) => `<li class="si-reveal" style="--i:${i + 2}"><span class="pa-ladder__org">${esc(c.org)}</span><span class="pa-ladder__role">${esc(c.role)}</span></li>`).join('')}
			</ol>` : ''}
			${credQ ? `<button type="button" class="pf-playlink pa-own-words" data-quote="${esc(credQ.id)}">In the speaker's own words <small>${esc(fmtMonth(credQ.date))} · ${clock(credQ.t)}</small></button>` : ''}
		</div>
	</div>
	<div class="ct-container">
		${F.talks || F.network ? `<dl class="si-figures pa-figs">
			${figure(F.talks, 'Recording', 'Recordings')}
			${figure(F.conferences, 'Conference', 'Conferences')}
			${figure(F.network, 'Fellow speaker', 'Fellow speakers')}
			${F.languages.length > 1 ? figure(F.languages.length, 'Language', 'Languages') : ''}
			${figure(F.minutes, 'Minute of talks', 'Minutes of talks')}
		</dl>` : ''}
	</div>
</section>`;

/* ---- section nav ----------------------------------------------------------------- */
const sections = [
	['voice', 'In their words', p.quotes.length],
	['life', 'Life', 1],
	['recordings', 'Recordings', p.talks.length],
	['writing', 'Writing & press', p.writing.length],
	['company', 'Company', p.network.length],
	['documents', 'Documents', p.documents.length],
].filter(s => s[2]);
const toc = sections.length < 2 ? '' : `
<nav class="pa-toc" aria-label="On this page">
	<div class="ct-container pa-toc__row">
		<span class="pa-toc__name" aria-hidden="true">${medallion(p, 30)}<b>${esc(p.name)}</b></span>
		<ol>${sections.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}</ol>
		${sig ? `<button type="button" class="pa-toc__listen" data-talk="${esc(sig.id)}"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg> ${sig.untimed ? 'Watch the session' : `Listen <span>${duration(sig.dur)}</span>`}</button>` : ''}
	</div>
</nav>`;

/* ---- the voice: one quote at a time ----------------------------------------------- */
const voice = p.quotes.length ? `
<section class="pa-voice" id="voice" aria-labelledby="pa-voice-h">
	<div class="ct-container">
		<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled" id="pa-voice-h">In their own words</p></header>
		<div class="pa-quotes" data-quotes>
			${p.quotes.map((q, i) => `
			<figure class="pa-quote" id="q-${esc(q.id)}" ${i ? 'hidden' : ''} aria-roledescription="quote" aria-label="${i + 1} of ${p.quotes.length}">
				<span class="pa-quote__stamp" aria-hidden="true"><b class="si-tabular">${clock(q.t)}</b><span>into the recording</span></span>
				<blockquote><p>${esc(q.text).replace(/\[(.+?)\]/g, '<span class="pa-edit" title="Editorial correction">[$1]</span>')}</p></blockquote>
				<figcaption>
					${q.context ? `<span class="pa-quote__context">${esc(q.context)}</span>` : ''}
					<span class="pa-quote__where">${esc(q.talk_title)}${q.conf_title ? ` — <i>${esc(q.conf_title)}</i>` : ''}, ${esc(city(q.place))}, ${esc(fmtDate(q.date))}</span>
					<button type="button" class="pf-playlink" data-quote="${esc(q.id)}">Hear it <small>${clock(q.t)}</small></button>
				</figcaption>
			</figure>`).join('')}
			${p.quotes.length > 1 ? `
			<div class="pa-quotes__nav" role="group" aria-label="Quotes">
				<button type="button" class="pa-arrow" data-step="-1" aria-label="Previous quote"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
				<ol>${p.quotes.map((q, i) => `<li><button type="button" data-go="${i}" aria-label="Quote ${i + 1}"${i ? '' : ' aria-current="true"'}><span>${String(i + 1).padStart(2, '0')}</span><i></i></button></li>`).join('')}</ol>
				<button type="button" class="pa-arrow" data-step="1" aria-label="Next quote"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
			</div>` : ''}
		</div>
		<p class="pa-voice__note si-meta">Transcribed from the recording's captions and checked against it; words in [brackets] are editorial.</p>
	</div>
</section>` : '';

/* ---- life: bio + at a glance -------------------------------------------------------- */
const glance = [
	['Country', esc(p.country)],
	p.native && ['Name in native script', esc(p.native)],
	['Heard', F.first ? (F.first === F.last ? String(F.first) : `${F.first}–${F.last}`) : ''],
	['Where', F.places.map(esc).join(' <span aria-hidden="true">→</span> ')],
	['Published in', F.languages.map(l => esc(LANG_NAME[l] || l)).join(', ')],
].filter(r => r && r[1]);
const life = `
<section class="pa-life" id="life" aria-labelledby="pa-life-h">
	<div class="ct-container pa-life__grid">
		<div class="pa-bio">
			<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled">Life</p><h2 class="si-heading" id="pa-life-h">${esc(p.name)}</h2></header>
			${p.bio.map((para, i) => `<p class="${i ? '' : 'pa-bio__first'}">${esc(para)}</p>`).join('')}
			${p.level === 'none' ? thinNote(p) : p.bio_source === 'generated' ? `<p class="si-meta pa-bio__src">This short biography is composed from the archive's own records. <a class="si-link" href="#">Know more? Tell us.</a></p>` : ''}
		</div>
		${glance.length || p.themes.length ? `<aside class="pa-glance" aria-label="At a glance">
			<p class="si-eyebrow">At a glance</p>
			${glance.length ? `<dl>${glance.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
			${p.themes.length ? `<p class="si-eyebrow pa-glance__themes">Themes</p>
			<ul class="pf-chips">${p.themes.map(t => `<li><a href="#">${esc(t)}</a></li>`).join('')}</ul>` : ''}
		</aside>` : ''}
	</div>
</section>`;

/* ---- recordings ------------------------------------------------------------------------- */
const maxDur = Math.max(...p.talks.filter(t => !t.untimed).map(t => t.dur || 0), 1);
const talkRow = (t, i) => `
<li class="pa-rec si-reveal" style="--i:${i % 6}">
	<span class="pa-rec__year si-tabular">${t.year || ''}</span>
	<div class="pa-rec__body">
		<h3 class="pa-rec__title">${esc(t.title)}</h3>
		<p class="si-meta"><i>${esc(t.conf_title)}</i> · ${esc(city(t.place))} · ${esc(fmtDate(t.date))}</p>
		<div class="pa-rec__meta">
			${t.untimed ? `<span class="pf-session">${esc(sessionNote(t))} · ${esc(talkLength(t))}</span>`
				: t.dur ? `<span class="pa-rec__bar" style="--w:${(t.dur / maxDur * 100).toFixed(1)}%" title="${duration(t.dur)}"><i></i></span><span class="si-meta si-tabular">${duration(t.dur)}</span>` : ''}
			${t.transcript ? `<span class="pa-tag">Transcript</span>` : ''}
			${t.versions.length ? `<span class="pa-rec__langs si-meta">Also dubbed: <span class="pf-langs">${t.versions.filter(v => v.lang !== 'en').map(v => `<button type="button" class="pf-lang" data-yt="${esc(v.yt)}" data-title="${esc(t.title)}" title="${esc(LANG_NAME[v.lang])}">${LANG[v.lang]}</button>`).join('')}</span></span>` : ''}
			${t.pages.length ? `<span class="pa-rec__langs si-meta">Write-up: <span class="pf-langs">${t.pages.map(g => `<a class="pf-lang" href="${esc(g.url)}" title="${esc(LANG_NAME[g.lang])}">${LANG[g.lang] || g.lang}</a>`).join('')}</span></span>` : ''}
		</div>
	</div>
	<button type="button" class="pa-rec__play" data-talk="${esc(t.id)}" aria-label="Play: ${esc(t.title)}">
		<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10l8-5z" fill="currentColor"/></svg>
	</button>
</li>`;
const SHOW = 5;
const recordings = !p.talks.length ? '' : `
<section class="pa-recs" id="recordings" aria-labelledby="pa-recs-h">
	<div class="ct-container">
		<header class="pf-head">
			<p class="si-eyebrow si-eyebrow--ruled">Recordings</p>
			<h2 class="si-heading" id="pa-recs-h">${esc(talksHeading(p))}</h2>
		</header>
		<ol class="pa-rec-list">${p.talks.map((t, i) => talkRow(t, i)).join('')}</ol>
		${p.talks.length > SHOW ? `<button type="button" class="pa-more" data-more aria-expanded="false">Show all ${p.talks.length} recordings</button>` : ''}
	</div>
</section>`;

/* ---- writing & press ---------------------------------------------------------------------- */
const press = p.writing.filter(w => w.outlet);
const writingGroups = [
	['Statements & letters', p.writing.filter(w => w.kind === 'statement')],
	['Interviews & press', p.writing.filter(w => w.kind === 'interview' || w.kind === 'coverage')],
	['Articles & video', p.writing.filter(w => w.kind === 'article' || w.kind === 'video')],
].filter(g => g[1].length);
const writing = p.writing.length ? `
<section class="pa-writing" id="writing" aria-labelledby="pa-writing-h">
	<div class="ct-container">
		<header class="pf-head">
			<p class="si-eyebrow si-eyebrow--ruled">Writing & press</p>
			<h2 class="si-heading" id="pa-writing-h">On the page</h2>
		</header>
		${press.length ? `<div class="pa-press"><span class="si-eyebrow">Interviewed by</span>${[...new Set(press.map(w => w.outlet))].map(o => `<span class="pf-outlet">${esc(o)}</span>`).join('<i aria-hidden="true"></i>')}</div>` : ''}
		<div class="pa-writing__cols">
			${writingGroups.map(([label, items]) => `
			<div class="pa-writing__col">
				<h3 class="si-eyebrow">${esc(label)}</h3>
				<ul>${items.map(w => `
					<li>
						<p class="si-meta si-tabular">${esc(fmtDate(w.date))}${w.outlet ? ` · <span class="pf-outlet">${esc(w.outlet)}</span>` : ''}</p>
						<a class="pa-writing__title" href="${esc(w.url)}">${esc(w.title)}</a>
						${w.langs.length > 1 ? `<span class="pf-langs">${w.langs.map(l => `<a class="pf-lang" href="${esc(l.url)}" title="${esc(LANG_NAME[l.lang])}">${LANG[l.lang] || l.lang}</a>`).join('')}</span>` : ''}
					</li>`).join('')}
				</ul>
			</div>`).join('')}
		</div>
	</div>
</section>` : '';

/* ---- the company kept ------------------------------------------------------------------------ */
const notable = companyLine(p);
const confByKey = Object.fromEntries(p.conferences.map(c => [c.key, c]));
const together = n => {
	if (!n.shared.length) return 'In conversation';
	if (n.shared.length === 1) return confLabel(confByKey[n.shared[0]]);
	const ys = n.shared.map(k => confByKey[k].date.slice(0, 4)).sort();
	return `${n.shared.length} conferences together, ${ys[0] === ys.at(-1) ? ys[0] : `${ys[0]}–${ys.at(-1)}`}`;
};
const personCard = n => `
<li class="pa-person" data-confs="${esc(n.shared.join(' '))}">
	<a href="${esc(personHref(n.key, data))}">
		${medallion(n, 64)}
		<span class="pa-person__text">
			<b class="si-name">${esc(n.name)}</b>
			${n.role ? `<span class="pa-person__role">${esc(n.role)}</span>` : ''}
			<span class="si-meta">${esc(together(n))}${n.country ? ` · ${esc(n.country)}` : ''}</span>
		</span>
	</a>
</li>`;
const COMPANY = 12;
const company = p.network.length ? `
<section class="pa-company" id="company" aria-labelledby="pa-company-h">
	<div class="ct-container">
		<header class="pf-head pa-company__head">
			<div>
				<p class="si-eyebrow si-eyebrow--ruled">The company kept</p>
				<h2 class="si-heading" id="pa-company-h">${plural(p.network.length, 'person', 'people')} shared ${p.conferences.length === 1 ? 'this programme' : 'these programmes'}${F.network_countries > 1 ? `, from ${F.network_countries} countries` : ''}</h2>
				${notable.length ? `<p>Among them ${notable.map(n => `<a class="si-link" href="${esc(personHref(n.key, data))}">${esc(n.name)}</a> (${esc(n.role.replace(/^Former /, 'former '))})`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>` : ''}
			</div>
			${p.conferences.length > 1 ? `
			<label class="pa-company__filter">
				<span class="si-visually-hidden">Conference</span>
				<select data-conf-filter>
					<option value="">Every conference</option>
					${p.conferences.map(c => `<option value="${esc(c.key)}">${esc(c.date.slice(0, 4))} · ${esc(c.title)}</option>`).join('')}
				</select>
			</label>` : ''}
		</header>
		<ul class="pa-people" data-people>${p.network.map(personCard).join('')}</ul>
		${p.network.length > COMPANY ? `<button type="button" class="pa-more" data-more-people aria-expanded="false">Show all ${p.network.length}</button>` : ''}
	</div>
</section>` : '';

/* ---- documents ----------------------------------------------------------------------------------- */
const documents = p.documents.length ? `
<section class="pa-docs" id="documents" aria-labelledby="pa-docs-h">
	<div class="ct-container">
		<header class="pf-head"><p class="si-eyebrow si-eyebrow--ruled">Documents</p><h2 class="si-heading" id="pa-docs-h">To read and keep</h2></header>
		<ul class="pa-doc-list">${p.documents.map(d => `
			<li><a class="pa-doc" href="#">
				<span class="pa-doc__sheet" aria-hidden="true"><span>${d.file ? 'PDF' : 'REPORT'}</span></span>
				<span class="pa-doc__text">
					<span class="pf-kind">${esc(d.kind)}${d.role ? ` · ${esc(d.role)}` : ''}</span>
					<b>${esc(d.title)}</b>
					<span class="si-meta">${[d.year, d.file].filter(Boolean).map(esc).join(' · ')}</span>
					${d.langs.length > 1 ? `<span class="pf-langs">${d.langs.map(l => `<span class="pf-lang">${LANG[l.lang] || l.lang}</span>`).join('')}</span>` : ''}
				</span>
			</a></li>`).join('')}
		</ul>
	</div>
</section>` : '';

/* ---- continue: the page's one dark band ------------------------------------------------------------- */
const lastConf = p.conferences[p.conferences.length - 1];
const cont = `
<section class="pa-continue" aria-labelledby="pa-continue-h">
	<div class="ct-container">
		<div class="pa-continue__panel">
		<p class="si-eyebrow" id="pa-continue-h">Continue</p>
		<div class="pa-continue__grid">
			${lastConf ? `<a class="pa-next" href="#">
				<span class="pa-next__kicker">The conference · ${esc(fmtDate(lastConf.date))}</span>
				<b>${esc(lastConf.title)}</b>
				<span>${plural(lastConf.speakers, 'speaker', 'speakers')} · ${esc(city(lastConf.place))} <span aria-hidden="true">→</span></span>
			</a>` : ''}
			${p.themes.length ? `<div class="pa-next">
				<span class="pa-next__kicker">The ideas</span>
				<b>More on ${esc(p.themes[0])}${p.themes[1] ? ` and ${esc(p.themes[1])}` : ''}</b>
				<ul class="pf-chips">${p.themes.map(t => `<li><a href="#">${esc(t)}</a></li>`).join('')}</ul>
			</div>` : `<a class="pa-next" href="people-register.html">
				<span class="pa-next__kicker">The people</span>
				<b>Everyone the Institute has brought to its conferences</b>
				<span>Statesmen, scientists, diplomats and artists <span aria-hidden="true">→</span></span>
			</a>`}
			<form class="pa-next pa-invite" data-invite>
				<span class="pa-next__kicker">Be in the room</span>
				<b>Get the invitation to the next conference</b>
				<label class="pa-invite__row"><span class="si-visually-hidden">Email</span><input type="email" required placeholder="you@example.org" autocomplete="email"><button class="ct-button" type="submit">Invite me</button></label>
				<span class="pa-invite__done" hidden>Thank you — the next invitation will reach you.</span>
			</form>
		</div>
		</div>
	</div>
</section>`;


main.innerHTML = `<div class="pa-progress" aria-hidden="true"></div>${hero}${toc}${voice}${life}${recordings}${writing}${company}${documents}${cont}`;
main.removeAttribute('aria-busy');
settleImages(main);
reveal(main);
if (main.querySelector('.pa-toc')) scrollSpy(main.querySelector('.pa-toc'));
draftStrip(data, 'person-portrait.html');

/* ---- behaviour ---------------------------------------------------------------------------------------- */
const talkById = Object.fromEntries(p.talks.map(t => [t.id, t]));
const meta = t => [t.conf_title, city(t.place), fmtDate(t.date)].filter(Boolean).join(' · ');
main.addEventListener('click', e => {
	const q = e.target.closest('[data-quote]');
	if (q) { const x = quoteById[q.dataset.quote]; return playModal({ yt: x.yt, t: Math.max(0, x.t - 2), title: x.talk_title, meta: `${p.name} · ${fmtDate(x.date)}` }); }
	const t = e.target.closest('[data-talk]');
	if (t) { const x = talkById[t.dataset.talk]; return playModal({ yt: x.yt, t: x.start, title: x.title, meta: meta(x) }); }
	const v = e.target.closest('[data-yt]');
	if (v) return playModal({ yt: v.dataset.yt, t: 0, title: v.dataset.title, meta: v.title });
});

// recordings: collapse to SHOW
const recList = main.querySelector('.pa-rec-list');
const moreRec = main.querySelector('[data-more]');
if (moreRec) {
	const set = open => {
		[...recList.children].forEach((li, i) => li.hidden = !open && i >= SHOW);
		moreRec.setAttribute('aria-expanded', open);
		moreRec.textContent = open ? 'Show fewer' : `Show all ${p.talks.length} recordings`;
	};
	set(false);
	moreRec.onclick = () => set(moreRec.getAttribute('aria-expanded') !== 'true');
}

// company: conference filter + collapse
const peopleList = main.querySelector('[data-people]');
if (peopleList) {
	const moreP = main.querySelector('[data-more-people]');
	const filter = main.querySelector('[data-conf-filter]');
	let open = false;
	const apply = () => {
		const c = filter?.value || '';
		let shown = 0;
		for (const li of peopleList.children) {
			const match = !c || li.dataset.confs.split(' ').includes(c);
			li.hidden = !match || (!open && !c && shown >= COMPANY);
			if (match) shown++;
		}
		if (moreP) {
			moreP.hidden = !!c;
			moreP.setAttribute('aria-expanded', open);
			moreP.textContent = open ? 'Show fewer' : `Show all ${p.network.length}`;
		}
		settleImages(peopleList);
	};
	apply();
	filter?.addEventListener('change', apply);
	moreP?.addEventListener('click', () => { open = !open; apply(); });
}

// quotes: one at a time, auto-advancing while in view (never with reduced motion)
const qBox = main.querySelector('[data-quotes]');
if (qBox && p.quotes.length > 1) {
	const figs = [...qBox.querySelectorAll('.pa-quote')];
	const dots = [...qBox.querySelectorAll('[data-go]')];
	let cur = 0, timer = 0, inView = false, hover = false;
	const DWELL = 9000;
	const go = (i, user) => {
		cur = (i + figs.length) % figs.length;
		figs.forEach((f, j) => { f.hidden = j !== cur; f.classList.toggle('is-in', j === cur); });
		dots.forEach((d, j) => j === cur ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
		if (user) stop();
		schedule();
	};
	const stop = () => { clearTimeout(timer); timer = 0; qBox.classList.remove('is-running'); };
	const schedule = () => {
		stop();
		if (reduceMotion || !inView || hover || qBox.dataset.paused) return;
		qBox.classList.add('is-running');
		timer = setTimeout(() => go(cur + 1), DWELL);
	};
	qBox.style.setProperty('--dwell', `${DWELL}ms`);
	qBox.addEventListener('click', e => {
		const s = e.target.closest('[data-step]'); if (s) { qBox.dataset.paused = '1'; go(cur + +s.dataset.step, true); }
		const d = e.target.closest('[data-go]'); if (d) { qBox.dataset.paused = '1'; go(+d.dataset.go, true); }
	});
	qBox.addEventListener('pointerenter', () => { hover = true; stop(); });
	qBox.addEventListener('pointerleave', () => { hover = false; schedule(); });
	qBox.addEventListener('focusin', () => { hover = true; stop(); });
	new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.5 }).observe(qBox);
	figs[0].classList.add('is-in');
}

// the invitation (prototype: no request is sent)
main.querySelector('[data-invite]')?.addEventListener('submit', e => {
	e.preventDefault();
	e.target.querySelector('.pa-invite__row').hidden = true;
	e.target.querySelector('.pa-invite__done').hidden = false;
});

// the toc shows the name once the hero has scrolled away
const tocEl = main.querySelector('.pa-toc');
if (tocEl) new IntersectionObserver(([e]) => tocEl.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0))
	.observe(main.querySelector('.pa-name'));
