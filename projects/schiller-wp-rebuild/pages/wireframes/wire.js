/* wire.js — the wireframe apparatus, shared by the five Home shapes.
 *
 * Three jobs:
 *   1. the header controls — notes on/off, and a switch that simulates the
 *      SCHEDULE SOURCE being empty, so every draft has to show what it says
 *      when nothing is scheduled (CLAUDE.md house rule, block-conventions §9);
 *   2. the chips — every perishable value on a wireframe is wrapped in one, so
 *      a reviewer can see at a glance what the page is promising to keep true;
 *   3. the small interactions each shape needs to be judged at all.
 * Nothing here ships: in WordPress these values come from bindings, Query
 * Loops and an events source.
 */
const DATA = new URL('../data/', import.meta.url);
export const get = n => fetch(new URL(n, DATA)).then(r => r.json());
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const nf = n => Number(n).toLocaleString('en-GB');

/* ---- perishable values --------------------------------------------------- */
/** auto: computed at render from the archive (a binding or a Query Loop). */
export const auto = (v, what) => `<span class="val">${esc(v)}</span> <span class="chip chip--auto" title="Computed at render: ${esc(what)}">auto</span>`;
/** dated: cannot be computed, so it carries the date it was true. */
export const dated = (v, when) => `<span class="val">${esc(v)}</span> <span class="chip chip--dated" title="Carries its date: true as of ${esc(when)}">as of ${esc(when)}</span>`;
/** sched: comes from the events source, and has an empty state. */
export const sched = (on, off) => `<span class="sched-on">${on} <span class="chip chip--sched" title="From the events source; degrades when empty">scheduled</span></span><span class="sched-off">${off} <span class="chip chip--static" title="What the page says when nothing is scheduled">fallback</span></span>`;

/** The years the archive covers, computed — never written as "fourteen years". */
export const span = (from, to = new Date().getFullYear()) => `${from}–${to}`;

/* ---- next Friday, 11:00 ET, in the reader's own clock -------------------- */
export function nextWeekly(weekday = 5, hour = 11, tz = 'America/New_York', from = new Date()) {
	const off = t => {
		const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(t).map(x => [x.type, x.value]));
		return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - t) / 60000;
	};
	for (let i = 0; i < 8; i++) {
		const d = new Date(from.getTime() + i * 864e5);
		const g = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
		if (g.weekday !== ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]) continue;
		let t = Date.UTC(+g.year, g.month - 1, +g.day, hour);
		t -= off(new Date(t)) * 60000;
		if (t > from.getTime() - 36e5) return new Date(t);
	}
	return null;
}
export const localTime = d => new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(d);

/* ---- header ------------------------------------------------------------- */
export function chrome({ n, name, idea, ask, screens }) {
	document.body.insertAdjacentHTML('afterbegin', `
	<header class="w-hd">
		<b>Wireframe ${n} · ${esc(name)}</b>
		<span class="w-idea">${esc(idea)}</span>
		<span class="w-meta">
			<span>${esc(screens)}</span>
			<button type="button" data-t="notes" aria-pressed="true">Notes</button>
			<button type="button" data-t="sched" aria-pressed="true">Schedule source: live</button>
			<a href="index.html">All five →</a>
		</span>
	</header>
	<p class="w-ask"><b>What this page asks of a visitor:</b> ${ask}</p>`);
	document.body.classList.add('notes-on');
	document.body.dataset.sched = 'live';
	document.querySelector('.w-hd').addEventListener('click', e => {
		const b = e.target.closest('button'); if (!b) return;
		if (b.dataset.t === 'notes') {
			b.setAttribute('aria-pressed', String(document.body.classList.toggle('notes-on')));
		} else {
			const live = document.body.dataset.sched === 'empty';
			document.body.dataset.sched = live ? 'live' : 'empty';
			b.setAttribute('aria-pressed', String(live));
			b.textContent = `Schedule source: ${live ? 'live' : 'empty'}`;
		}
	});
}

/** Notes column: [n, text] pairs, numbered to the callouts in the wireframe. */
export function notes(list) {
	const el = document.querySelector('.w-notes');
	if (!el) return;
	el.innerHTML = `<h3>What you are looking at</h3><ol>${list.map(t => `<li>${t}</li>`).join('')}</ol>`;
}

/* ---- pieces every shape needs (they differ in placement, not in kind) ----- */

/** The standing invitation. Its live form comes from the events source; its
 *  empty form is the general one, and is part of the design, not an error. */
export function weekBox(now, { compact = false } = {}) {
	const fri = nextWeekly();
	return `<div class="box box--quiet">
		<span class="lbl">This week</span>
		<p class="txt" style="margin:0 0 8px">${sched(
			`Peace Coalition · <b>${fri ? esc(localTime(fri)) : 'Friday'}</b> your time`,
			`The Peace Coalition meets weekly — the newsletter carries the day`)}</p>
		<p class="txt txt--m" style="margin:0 0 10px">${auto(now.counts.ipc_weeks, 'count of published meeting reports')} weeks so far · ${dated('11:00 ET', now.counts.ipc_asof)}</p>
		${compact ? '' : '<div class="bars"><div class="bar"></div><div class="bar"></div></div>'}
		<button class="btn" style="margin-top:6px">Take the open seat</button>
	</div>`;
}

/** The one action every shape ends on. */
export function signup(label = 'The week by email') {
	return `<div class="box box--open">
		<span class="lbl">${esc(label)}</span>
		<div class="row r2" style="gap:10px"><div class="field">you@example.org</div><button class="btn">Sign up</button></div>
		<p class="txt txt--m" style="margin:8px 0 0">Double opt-in · unsubscribe any time</p>
	</div>`;
}

/** Rows of real archive items — a core Query Loop in production. */
export function rows(items, n = 3) {
	return items.slice(0, n).map(a => `<a class="box box--open" style="display:block;text-decoration:none;color:inherit;padding:10px 0;border:0;border-bottom:1px solid var(--line)">
		<span class="txt txt--m" style="font-size:11.5px">${esc(a.d)}</span>
		<div class="bar bar--h" style="width:${70 + (a.t.length % 4) * 7}%"></div></a>`).join('');
}

export const faces = (n, size = '') => `<div class="row" style="grid-template-columns:repeat(auto-fill,minmax(${size || '58px'},1fr));gap:10px">${Array.from({ length: n }, () => '<span class="face"></span>').join('')}</div>`;
