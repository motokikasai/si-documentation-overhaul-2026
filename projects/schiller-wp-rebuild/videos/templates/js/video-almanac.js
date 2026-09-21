/* video-almanac.js — draft E, "the Almanac".
 * The broadcast in its time. Every episode of its series on a calendar wall,
 * this one lit; the fortnight around it as a day-strip of everything the
 * Institute published; and the series' own rhythm, measured from its dates.
 * A weekly series is drawn a year to a row; a short daily one (Daily
 * Beethoven: 81 episodes in 203 days) a week to a column; a video in no
 * series is placed among all 1,212 videos of the wing. */
import {
	loadVideo, loadIndex, esc, fmtDate, fmtShort, hms, human, plural, LANG, kindLabel, titleHTML,
	facadeHTML, mountTape, seriesNavHTML, ctaHTML, recordHTML, bodyHTML, chaptersHTML, followChapters,
	reveal, draftStrip, fail, wantedTime, weekday, thumb,
} from './video-core.js';

const DAY = 864e5;
const d2 = iso => new Date(iso + 'T12:00:00Z');
const dayOfYear = d => Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1, 12)) / DAY);
const TYPE_KEY = { si_video: 'video', post: 'article', si_statement: 'statement', si_conference: 'conference', si_presentation: 'video', si_coverage: 'coverage', si_document: 'document' };

const main = document.getElementById('main');
try {
	const [rec, index] = await Promise.all([loadVideo(), loadIndex()]);
	document.title = `${rec.title} — Schiller Institute`;
	main.innerHTML = render(rec, index);
	main.removeAttribute('aria-busy');
	mount(rec, index);
} catch (err) { fail(main, err); }
draftStrip('video-almanac.html');

function episodes(rec, index, lang = rec.lang) {
	if (rec.series) return index.videos.filter(v => v.series === rec.series.slug && v.lang === lang);
	return index.videos;
}

function render(rec, index) {
	const s = rec.series, at = wantedTime();
	const cad = s?.cadence;
	const langs = s ? [...new Set(index.videos.filter(v => v.series === s.slug).map(v => v.lang))] : [];
	return `
	<article class="al">
		<header class="si-wrap al-head">
			<div class="al-head__text">
				<p class="si-eyebrow si-eyebrow--ruled">${esc(kindLabel(rec))}</p>
				${titleHTML(rec)}
				<p class="al-date"><span class="al-date__wd">${weekday(rec.date)}</span> <span class="al-date__d">${fmtDate(rec.date)}</span></p>
				<dl class="si-figures al-figs">
					${s ? `<div class="si-figure"><dt>of ${s.of} in ${esc(LANG[rec.lang])}</dt><dd class="si-tabular">No. ${s.ep}</dd></div>` : ''}
					${rec.duration ? `<div class="si-figure"><dt>on the tape</dt><dd class="si-tabular">${human(rec.duration).replace(' min', '′').replace(' hr', 'h')}</dd></div>` : ''}
					${rec.week.length ? `<div class="si-figure"><dt>published within a week</dt><dd class="si-tabular">${rec.week.length}</dd></div>` : ''}
				</dl>
				${cad ? `<p class="al-cad">In the year to this broadcast the series aired on a <b>${esc(cad.weekday)}</b> in ${cad.k} of ${cad.n} weeks.</p>` : ''}
			</div>
			<div class="al-head__tape">${facadeHTML(rec, { start: at })}
				${rec.chapters.length ? `<details class="al-ch"><summary>${plural(rec.chapters.length, 'chapter')}</summary>${chaptersHTML(rec)}</details>` : ''}
			</div>
		</header>

		<section class="si-vid-band al-wall" aria-labelledby="al-w-h">
			<div class="si-wrap">
				<div class="al-wall__head">
					<div class="si-vid-band__head">
						<h2 id="al-w-h">${s ? `Every episode of ${esc(s.label)}` : 'Every video in the archive'}</h2>
						<p>${s ? `${plural(s.of, 'episode')} in ${esc(LANG[rec.lang])}, ${fmtDate(s.first)} to ${fmtDate(s.last)}. Each mark is one broadcast; this one is ringed. Point at any mark to read it, press to go there.`
							: `${plural(index.videos.length, 'video')}, ${index.videos[0].date.slice(0, 4)} to ${index.videos.at(-1).date.slice(0, 4)}, one mark per week, darker where there were more. This one is ringed.`}</p>
					</div>
					${langs.length > 1 ? `<div class="si-segmented si-js-only" role="group" aria-label="Language">${langs.map(l => `<button type="button" data-lang="${l}" aria-pressed="${l === rec.lang}">${esc(LANG[l])}</button>`).join('')}</div>` : ''}
				</div>
				<div class="al-cal" data-mode=""></div>
				<p class="al-legend si-vid-note"><span class="al-key al-key--cc"></span> captions on record <span class="al-key"></span> none <span class="al-key al-key--self"></span> this broadcast</p>
			</div>
			<div class="al-tip" role="tooltip" hidden></div>
		</section>

		${rec.week.length ? `<section class="si-wrap si-vid-band al-fort" aria-labelledby="al-f-h">
			<div class="al-wall__head">
				<div class="si-vid-band__head"><h2 id="al-f-h">The fortnight around it</h2>
				<p>Everything the Institute published from a week before to a week after, by day and by kind.</p></div>
				${rec.otherLangWeek.length ? `<div class="si-segmented si-js-only" role="group" aria-label="Languages shown">
					<button type="button" data-wl="one" aria-pressed="true">${esc(LANG[rec.lang])}</button><button type="button" data-wl="all" aria-pressed="false">All languages</button></div>` : ''}
			</div>
			<div class="al-strip">${stripHTML(rec)}</div>
		</section>` : ''}

		${s ? `<section class="si-wrap si-vid-band"><h2 class="si-vid-h3">Before and after</h2>${seriesNavHTML(rec)}</section>` : ''}
		${bodyHTML(rec) ? `<section class="si-wrap si-vid-band al-about"><h2 class="si-vid-h3">As published with the video</h2>${bodyHTML(rec)}</section>` : ''}
		${ctaHTML(rec) ? `<section class="si-vid-night al-cta"><div class="si-wrap">${ctaHTML(rec)}</div></section>` : ''}
		<section class="si-wrap si-vid-band al-record"><div class="si-vid-band__head"><h2>The record</h2></div>${recordHTML(rec)}</section>
	</article>`;
}

/* ---- the fortnight --------------------------------------------------------- */
function stripHTML(rec) {
	const days = [];
	for (let dd = -7; dd <= 7; dd++) {
		const d = new Date(d2(rec.date).getTime() + dd * DAY);
		const iso = d.toISOString().slice(0, 10);
		const items = rec.week.filter(w => w.dd === dd);
		days.push(`<li class="al-day${dd === 0 ? ' is-self' : ''}${[0, 6].includes(d.getUTCDay()) ? ' is-weekend' : ''}" data-dd="${dd}">
			<p class="al-day__d"><span>${new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(d)}</span> <b class="si-tabular">${d.getUTCDate()}</b></p>
			<ul role="list">
				${dd === 0 ? `<li class="al-item al-item--self" data-t="video"><span class="al-item__k">This broadcast</span>${rec.yt ? `<img src="${thumb(rec.yt, 'mqdefault')}" alt="" loading="lazy">` : ''}</li>` : ''}
				${items.map(w => `<li class="al-item" data-t="${TYPE_KEY[w.type] || 'other'}" data-lang="${w.lang}"${w.lang !== rec.lang ? ' hidden' : ''}>
					<a href="${esc(w.url)}"${w.lang !== rec.lang ? ` lang="${w.lang}"` : ''}><span class="al-item__k">${esc(w.type_label)}${w.lang !== rec.lang ? ` · ${w.lang.toUpperCase()}` : ''}</span>
					<span class="al-item__t">${esc(w.title)}</span></a></li>`).join('')}
			</ul>
			<span class="si-visually-hidden">${iso}</span>
		</li>`);
	}
	return `<ol class="al-days" role="list">${days.join('')}</ol>`;
}

/* ---- the wall -------------------------------------------------------------- */
function wallHTML(rec, eps) {
	if (!eps.length) return '';
	const first = d2(eps[0].date), last = d2(eps.at(-1).date);
	const span = (last - first) / DAY;
	const cell = v => `<a class="al-c${v.cc ? ' is-cc' : ''}${v.id === rec.id ? ' is-self' : ''}" href="/videos/${esc(v.slug)}/" data-id="${v.id}" aria-label="${esc(fmtDate(v.date))}: ${esc(v.title)}"></a>`;
	if (rec.series && span < 400) {
		// a short daily series: columns are weeks (Mon-first), rows are weekdays
		const monday = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
		const weeks = Math.ceil((last - monday) / DAY / 7) + 1;
		const grid = Array.from({ length: 7 }, () => Array(weeks).fill(null));
		for (const v of eps) {
			const d = d2(v.date), k = Math.floor((d - monday) / DAY);
			const slot = grid[k % 7][Math.floor(k / 7)];
			grid[k % 7][Math.floor(k / 7)] = slot ? [...slot, v] : [v];
		}
		const months = [];
		for (let w = 0; w < weeks; w++) {
			const d = new Date(monday.getTime() + w * 7 * DAY);
			if (d.getUTCDate() <= 7) months.push(`<span style="grid-column:${w + 2}">${new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d)}</span>`);
		}
		return `<div class="al-grid al-grid--days" style="--cols:${weeks}">
			<div class="al-grid__months">${months.join('')}</div>
			${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, r) => `<span class="al-grid__row">${n}</span>${grid[r].map(sl => sl ? cell(sl[0]) : '<span class="al-e"></span>').join('')}`).join('')}
		</div>`;
	}
	// a long series (or the whole wing): a year to a row, a week to a column
	const years = [];
	for (let y = first.getUTCFullYear(); y <= last.getUTCFullYear(); y++) years.push(y);
	const slots = new Map();
	for (const v of eps) {
		const d = d2(v.date), y = d.getUTCFullYear(), w = Math.min(52, Math.floor(dayOfYear(d) / 7));
		const k = `${y}:${w}`;
		slots.set(k, [...(slots.get(k) || []), v]);
	}
	const heat = !rec.series;
	const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => `<span style="grid-column:${Math.floor(i * 53 / 12) + 2}">${m}</span>`).join('');
	return `<div class="al-grid al-grid--years${heat ? ' is-heat' : ''}" style="--cols:53">
		<div class="al-grid__months">${months}</div>
		${years.map(y => `<span class="al-grid__row si-tabular">${y}</span>${Array.from({ length: 53 }, (_, w) => {
			const sl = slots.get(`${y}:${w}`);
			if (!sl) return '<span class="al-e"></span>';
			const self = sl.find(v => v.id === rec.id);
			const v = self || sl[0];
			if (heat) return `<a class="al-c is-heat${self ? ' is-self' : ''}" style="--k:${Math.min(1, sl.length / 6)}" href="/videos/${esc(v.slug)}/" data-id="${v.id}" data-n="${sl.length}" aria-label="Week of ${esc(fmtDate(v.date))}: ${plural(sl.length, 'video')}"></a>`;
			return cell(v);
		}).join('')}`).join('')}
	</div>`;
}

function mount(rec, index) {
	mountTape(main);
	followChapters(rec, main);
	reveal(main);
	const cal = main.querySelector('.al-cal');
	const by = new Map(index.videos.map(v => [v.id, v]));
	const draw = lang => {
		cal.innerHTML = wallHTML(rec, episodes(rec, index, lang));
		cal.querySelector('.is-self')?.scrollIntoView({ block: 'nearest', inline: 'center' });
	};
	draw(rec.lang);
	main.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
		main.querySelectorAll('[data-lang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
		draw(b.dataset.lang);
	}));

	// one tooltip for the whole wall
	const tip = main.querySelector('.al-tip');
	const show = a => {
		const v = by.get(+a.dataset.id);
		const n = +a.dataset.n || 1;
		tip.innerHTML = `${v.yt ? `<img src="${thumb(v.yt, 'mqdefault')}" alt="">` : ''}
			<span class="al-tip__d si-tabular">${fmtDate(v.date)}${v.ep ? ` · No. ${v.ep}` : ''}${n > 1 ? ` · ${n} that week` : ''}</span>
			<span class="al-tip__t">${esc(v.title)}</span>${v.lede ? `<span class="al-tip__l">${esc(v.lede)}</span>` : ''}`;
		tip.hidden = false;
		const r = a.getBoundingClientRect(), host = tip.parentElement.getBoundingClientRect();
		const left = Math.min(host.width - 300, Math.max(8, r.left - host.left - 140));
		tip.style.left = `${left}px`;
		tip.style.top = `${r.top - host.top - tip.offsetHeight - 10}px`;
	};
	cal.addEventListener('mouseover', e => { const a = e.target.closest('.al-c'); if (a) show(a); });
	cal.addEventListener('focusin', e => { const a = e.target.closest('.al-c'); if (a) show(a); });
	cal.addEventListener('mouseleave', () => { tip.hidden = true; });
	cal.addEventListener('focusout', () => { tip.hidden = true; });

	// the fortnight: this language, or all
	main.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', () => {
		main.querySelectorAll('[data-wl]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
		main.querySelectorAll('.al-item[data-lang]').forEach(li => { li.hidden = b.dataset.wl === 'one' && li.dataset.lang !== rec.lang; });
	}));
	main.querySelector('.al-days .is-self')?.scrollIntoView({ block: 'nearest', inline: 'center' });
	scrollTo({ top: 0, behavior: 'instant' });
}
