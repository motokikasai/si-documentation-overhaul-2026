/* video-programme-wp.js — the Programme, inside WordPress.
 *
 * Everything readable is already on the page (template-parts/videos/programme.php).
 * This adds the behaviour that needs a browser:
 *
 *   the tape        two-click; nothing from YouTube until the reader presses play
 *   the timeline    drawn once the length is known — from the record, or from the
 *                   player itself, which reports it as soon as it starts
 *   the chapters    the one under the playhead is marked, and the rail follows it
 *                   (only when the chapter changes, and never while a hand is busy)
 *   the read-along  press a line to hear it; the line under the playhead lights up;
 *                   find a word, and the hits show on the timeline
 *   the long text   folds after three paragraphs, and folds back
 *   the places      the dot map above the list, from land.json
 *
 * With this blocked the page still reads: the facade is a link to the tape, the
 * chapters are links at their second, the text is all there.
 */
import { videoData, mountTape, hms, esc, reveal, settleImages, handIsBusy, reduceMotion, wantedTime } from './video-core-wp.js';

const page = document.querySelector('.vd-programme');
const data = videoData();
if (page && data) {
	const tape = mountTape(page);
	settleImages(page);
	reveal(page);
	foldLongText();
	followChapters();
	readAlong(tape);
	timeline(data.duration);
	document.addEventListener('si:duration', e => timeline(e.detail.duration));
	places();
	const at = wantedTime();
	if (at != null && tape) tape.seek(at);
}

/* ---- the editor's text, folded ------------------------------------------- */
function foldLongText() {
	const about = page.querySelector('.pg-about .si-vid-body');
	const more = page.querySelector('.pg-more');
	if (!about || !more || about.children.length <= 4) return;
	about.classList.add('is-folded');
	more.hidden = false;
	more.addEventListener('click', () => {
		const open = about.classList.toggle('is-folded') === false;
		more.textContent = open ? more.dataset.less : more.dataset.more;
		more.setAttribute('aria-expanded', String(open));
		if (!open && about.getBoundingClientRect().top < 0) {
			about.closest('.pg-about').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
		}
	});
}

/* ---- the chapter under the playhead --------------------------------------- */
function followChapters() {
	const rail = page.querySelector('.pg-side__scroll');
	const rows = [...page.querySelectorAll('[data-ch]')];
	if (!rows.length) return;
	let last = null;
	document.addEventListener('si:time', e => {
		let i = -1;
		data.chapters.forEach((c, j) => { if (e.detail.t >= c.t) i = j; });
		rows.forEach(el => el.classList.toggle('is-now', +el.dataset.ch === i));
		page.querySelectorAll('.si-vid-bar__seg').forEach(sg => sg.classList.toggle('is-now', +sg.dataset.ch === i));
		const now = rows.find(el => +el.dataset.ch === i);
		if (!rail || !now || now === last || handIsBusy()) return;
		last = now;
		const r = now.getBoundingClientRect(), R = rail.getBoundingClientRect();
		if (r.top < R.top || r.bottom > R.bottom) {
			rail.scrollTo({ top: rail.scrollTop + r.top - R.top - 40, behavior: reduceMotion ? 'auto' : 'smooth' });
		}
	});
}

/* ---- the timeline ---------------------------------------------------------
 * Only drawn when the length is known: the record does not carry one until a
 * caption file is uploaded, and inventing one would be inventing content. The
 * player reports it the moment it starts, so the bar appears then. */
function timeline(duration) {
	const box = page.querySelector('.pg-bar');
	if (!box || !duration || box.dataset.drawn) return;
	// nothing to carry — no chapters, and no seconds beside a name until captions land.
	// A bare position line only repeats the player's own scrubber.
	if (!data.chapters.length && !(data.marks || []).length) return;
	box.dataset.drawn = '1';
	box.hidden = false;
	const marks = (data.marks || []).flatMap(m => m.at.map(t => ({ t, title: `${m.name} · ${hms(t)}` })));
	const segs = data.chapters.map((c, i) => {
		const end = c.end ?? duration;
		return `<span class="si-vid-bar__seg" data-ch="${i}" style="left:${(c.t / duration * 100).toFixed(3)}%;width:${((end - c.t) / duration * 100).toFixed(3)}%" title="${esc(c.title)}"></span>`;
	}).join('');
	box.innerHTML = `<div class="si-vid-bar" role="group" aria-label="${esc(document.title)}" data-duration="${duration}">
		<div class="si-vid-bar__track"><span class="pg-bar__fill"></span>${segs}${marks.map(m =>
			`<span class="si-vid-bar__tick is-soft" style="left:${(m.t / duration * 100).toFixed(3)}%" title="${esc(m.title)}"></span>`).join('')}<span class="si-vid-bar__head" aria-hidden="true"></span>
			<span class="pg-bar__ghost" aria-hidden="true"><span class="pg-bar__tip"></span></span></div>
		<div class="si-vid-bar__scale si-tabular" aria-hidden="true"><span>0:00</span><span>${hms(duration)}</span></div>
	</div>`;
	const bar = box.querySelector('.si-vid-bar');
	const track = box.querySelector('.si-vid-bar__track');
	const ghost = box.querySelector('.pg-bar__ghost'), tip = ghost.firstElementChild;
	track.addEventListener('click', e => {
		const r = track.getBoundingClientRect();
		document.dispatchEvent(new CustomEvent('si:want', { detail: { t: (e.clientX - r.left) / r.width * duration } }));
	});
	track.addEventListener('mousemove', e => {
		const r = track.getBoundingClientRect();
		const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
		const t = x * duration;
		let ci = -1;
		data.chapters.forEach((c, i) => { if (t >= c.t) ci = i; });
		ghost.style.left = `${x * 100}%`;
		tip.innerHTML = `<b>${hms(t)}</b>${ci >= 0 ? esc(data.chapters[ci].title) : ''}`;
		const w = tip.offsetWidth, px = x * r.width;
		tip.style.setProperty('--tx', `${px < w / 2 ? -px : px > r.width - w / 2 ? -(w - (r.width - px)) : -w / 2}px`);
		track.querySelectorAll('.si-vid-bar__seg').forEach((sg, i) => sg.classList.toggle('is-hover', i === ci));
	});
	track.addEventListener('mouseleave', () => track.querySelectorAll('.si-vid-bar__seg').forEach(sg => sg.classList.remove('is-hover')));
	document.addEventListener('si:time', e => {
		const p = Math.min(100, e.detail.t / duration * 100);
		bar.style.setProperty('--p', `${p}%`);
		bar.querySelector('.si-vid-bar__head').style.left = `${p}%`;
		bar.classList.add('is-live');
	});
}

/* ---- the places, on a dot-resolution world -------------------------------- */
async function places() {
	const box = page.querySelector('.pg-places');
	if (!box || !data.places?.length || !data.land) return;
	let land;
	try { land = await (await fetch(data.land)).json(); } catch { return; }
	const w = 420, h = 190;
	const X = lon => (lon + 180) / 360 * w, Y = lat => (90 - lat) / 150 * h;
	const dots = [];
	land.rows.forEach((row, r) => {
		const lat = land.north - land.step / 2 - r * land.step;
		for (let c = 0; c < row.length; c++) {
			if (row[c] === '1') dots.push(`<circle cx="${X(land.west + land.step / 2 + c * land.step).toFixed(1)}" cy="${Y(lat).toFixed(1)}" r="1.25"/>`);
		}
	});
	const max = Math.max(...data.places.map(p => p.n));
	const pins = data.places.map(p => {
		const r = 3 + Math.sqrt(p.n / max) * 11;
		return `<g class="si-vid-map__place"><circle class="si-vid-map__halo" cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="${r.toFixed(1)}"/>
			<circle class="si-vid-map__pin" cx="${X(p.lon).toFixed(1)}" cy="${Y(p.lat).toFixed(1)}" r="2.6"/>
			<title>${esc(p.name)} — ${p.n}</title></g>`;
	}).join('');
	box.querySelector('.si-vid-places').insertAdjacentHTML('beforebegin',
		`<svg class="si-vid-map" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(data.places.map(p => p.name).join(', '))}">
			<g class="si-vid-map__land">${dots.join('')}</g>${pins}</svg>`);
}

/* ---- the read-along --------------------------------------------------------
 * The captions are already on the page. This makes each line playable, lights the
 * line under the playhead (unless the reader's hand is busy, or they said Stay),
 * and finds a word — marking the hits on the timeline as it goes. */
function readAlong(tape) {
	const box = page.querySelector('.pg-read__box');
	if (!box) return;
	const lines = [...box.querySelectorAll('.si-vid-tx__s')];
	const times = lines.map(el => +el.dataset.t);
	const follow = page.querySelector('.pg-follow input');

	box.addEventListener('click', e => {
		const s = e.target.closest('.si-vid-tx__s');
		if (!s || getSelection().toString().length > 2) return;
		tape?.seek(+s.dataset.t);
	});

	let now = -1;
	document.addEventListener('si:time', e => {
		let i = -1;                                   // the last line that has started
		let lo = 0, hi = times.length - 1;
		while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= e.detail.t + 0.2) { i = m; lo = m + 1; } else hi = m - 1; }
		if (i === now) return;
		lines[now]?.classList.remove('is-now');
		now = i;
		const el = lines[i];
		if (!el) return;
		el.classList.add('is-now');
		if (follow?.checked === false || handIsBusy()) return;
		const r = el.getBoundingClientRect(), R = box.getBoundingClientRect();
		if (r.top < R.top + 40 || r.bottom > R.bottom - 40) {
			box.scrollTo({ top: box.scrollTop + r.top - R.top - R.height * 0.33, behavior: reduceMotion ? 'auto' : 'smooth' });
		}
	});

	const input = page.querySelector('.pg-find');
	const count = page.querySelector('.si-vid-find__n');
	if (!input) return;
	input.addEventListener('input', () => {
		const q = input.value.trim();
		box.querySelectorAll('mark.si-vid-hit').forEach(m => m.replaceWith(...m.childNodes));
		box.normalize();
		page.querySelectorAll('.si-vid-bar__tick.is-find').forEach(t => t.remove());
		if (q.length < 2) { count.textContent = ''; return; }
		const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		const hits = [];
		for (const el of lines) {
			if (!rx.test(el.textContent)) { rx.lastIndex = 0; continue; }
			rx.lastIndex = 0;
			el.innerHTML = esc(el.textContent).replace(rx, m => `<mark class="si-vid-hit">${m}</mark>`);
			hits.push(+el.dataset.t);
		}
		count.textContent = hits.length
			? hits.length + ' ' + (hits.length === 1 ? count.dataset.one || 'line' : count.dataset.many || 'lines')
			: count.dataset.none || 'not said';
		const track = page.querySelector('.si-vid-bar__track');
		const dur = +(page.querySelector('.si-vid-bar')?.dataset.duration || 0);
		if (track && dur) {
			for (const t of hits) {
				track.insertAdjacentHTML('beforeend',
					`<span class="si-vid-bar__tick is-brass is-find" style="left:${(t / dur * 100).toFixed(3)}%"></span>`);
			}
		}
		box.querySelector('mark.si-vid-hit')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});
}
