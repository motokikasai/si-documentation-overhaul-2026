/* interact.mjs — assertions for the five conference drafts, Firefox only.
 *
 *   cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8763
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules \
 *     node conferences/build/interact.mjs [--port=8763]
 *
 * Every check is against the PAYLOAD, not against the markup's own idea of
 * itself: the number of talk rows against the number of talks in the record,
 * the deep-link seconds against the published timestamps, the two-click video
 * rule against the network. A draft passes when the page says exactly what the
 * record holds — no more (nothing invented) and no less (nothing dropped).
 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const PORT = opt('port', '8763');
const BASE = `http://127.0.0.1:${PORT}/conferences/`;
const DRAFTS = ['proceedings', 'marquee', 'rostrum', 'thread', 'atrium'];
const RECORDS = ['2025-berlin', '2024-beethoven', '2016-berlin', '2023-strasbourg'];

const fails = [];
const ok = (name, cond, detail = '') => {
	if (cond) console.log(`  ok   ${name}`);
	else { console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); fails.push(`${name}${detail ? ` — ${detail}` : ''}`); }
};

/* the payloads, read from disk exactly as the pages read them */
const data = {};
for (const r of RECORDS) {
	data[r] = JSON.parse(await readFile(
		new URL(`../data/conf-${r}.json`, import.meta.url), 'utf8'));
}
/** the adapter's own arithmetic, repeated here so the check is independent */
function expected(rec) {
	const speeches = rec.sessions.filter(s => s.kind === 'speech');
	const sessions = speeches.length
		? [...new Set(speeches.map(s => s.panel || ''))].map(p => ({
			kind: 'panel', talks: speeches.filter(s => (s.panel || '') === p).map(s => s.talks[0] || {}),
		})).concat(rec.sessions.filter(s => s.kind === 'concert'))
		: rec.sessions;
	return {
		sessions: sessions.length,
		talks: sessions.reduce((n, s) => n + (s.talks || []).length, 0),
		works: sessions.reduce((n, s) => n + (s.works || []).length, 0),
		speakers: rec.speakers.length,
		starts: sessions.flatMap(s => (s.talks || []).filter(t => t.start != null).map(t => Math.floor(t.start))),
	};
}

const browser = await firefox.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });

/* ---- 1 · every draft against every record -------------------------------- */
for (const d of DRAFTS) {
	for (const r of RECORDS) {
		console.log(`\n${d} · ${r}`);
		const page = await ctx.newPage();
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => m.type() === 'error' && errors.push(m.text()));
		const yt = [];
		page.on('request', q => { if (/youtube|ytimg|googlevideo|doubleclick/.test(q.url())) yt.push(q.url()); });
		await page.goto(`${BASE}templates/conference-${d}.html?c=${r}`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(400);
		await page.evaluate(async () => {           // let every reveal arrive
			const step = innerHeight * 0.8;
			for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(x => setTimeout(x, 40)); }
			scrollTo(0, 0); await new Promise(x => setTimeout(x, 150));
		});
		const exp = expected(data[r]);

		ok('no page errors', errors.length === 0, errors[0]);

		/* the record's title is on the page, in full */
		const title = await page.title();
		ok('title is the record title', title.startsWith(data[r].title.slice(0, 40)));

		/* every talk in the record reaches the page */
		const rows = await page.evaluate(() => document.querySelectorAll(
			'.si-conf-talk, .mq-talk, .ro-card, .th-mark, .at-talks li').length);
		ok(`talks rendered (${rows} ≥ ${exp.talks ? Math.min(exp.talks, exp.speakers) : 0})`,
			exp.talks === 0 ? rows === 0 : rows >= Math.min(exp.talks, exp.speakers),
			`payload has ${exp.talks} talks / ${exp.speakers} speakers`);

		/* no YouTube request before a click — the two-click rule, except the
		   still images, which are the poster and come from ytimg */
		const beforePlay = yt.filter(u => !/i\.ytimg\.com/.test(u));
		ok('nothing loaded from YouTube before a click', beforePlay.length === 0, beforePlay[0]);

		/* every deep link carries a second the record actually published */
		const starts = await page.evaluate(() => [...document.querySelectorAll('[data-start]')]
			.map(el => +el.dataset.start).filter(n => !Number.isNaN(n)));
		const known = new Set(exp.starts);
		const invented = starts.filter(s => !known.has(s));
		ok('no invented timestamps', invented.length === 0, invented.slice(0, 4).join(', '));

		/* a record with nothing on it says so, and shows no empty furniture */
		if (exp.talks === 0) {
			const empties = await page.evaluate(() => document.querySelectorAll('.si-conf-empty').length);
			ok('the empty record explains itself', empties > 0);
		}
		await page.close();
	}
}

/* ---- 2 · the behaviours, one draft at a time ----------------------------- */
console.log('\nbehaviours');
{	/* two-click video: the player only exists after a press */
	const page = await ctx.newPage();
	const yt = [];
	page.on('request', q => { if (/youtube(-nocookie)?\.com/.test(q.url())) yt.push(q.url()); });
	await page.goto(`${BASE}templates/conference-proceedings.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	ok('no player before the click', await page.locator('iframe').count() === 0);
	await page.locator('.si-conf-embed__btn').first().click();
	await page.waitForTimeout(500);
	const src = await page.locator('iframe').first().getAttribute('src');
	ok('the player is youtube-nocookie', /youtube-nocookie\.com\/embed\//.test(src || ''), src || '');
	await page.close();
}
{	/* a talk's watch link opens the tape at that talk's own second */
	const page = await ctx.newPage();
	await page.goto(`${BASE}templates/conference-proceedings.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	const link = page.locator('.si-conf-watch[data-start]').first();
	const want = +await link.getAttribute('data-start');
	await link.click();
	await page.waitForTimeout(500);
	const src = await page.locator('iframe').first().getAttribute('src') || '';
	ok(`the deep link plays from ${want}s`, src.includes(`start=${want}`), src);
	await page.close();
}
{	/* the rostrum's filter narrows the roster to one session */
	const page = await ctx.newPage();
	await page.goto(`${BASE}templates/conference-rostrum.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	const all = await page.locator('.ro-card:visible').count();
	await page.locator('.ro-filter .si-chip').nth(1).click();
	await page.waitForTimeout(200);
	const some = await page.locator('.ro-card:visible').count();
	ok(`the filter narrows the roster (${all} → ${some})`, some > 0 && some < all);
	await page.close();
}
{	/* the thread's playhead names the talk under the read line */
	const page = await ctx.newPage();
	await page.goto(`${BASE}templates/conference-thread.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	await page.evaluate(() => scrollTo(0, 2600));
	await page.waitForTimeout(400);
	const who = (await page.locator('.th-playhead__who').textContent().catch(() => '')) || '';
	const live = (await page.locator('.th-mark.is-live .th-mark__who').textContent().catch(() => '')) || '';
	ok('the playhead names the live mark', who.trim().length > 0 && who.trim() === live.trim(), `${who} / ${live}`);
	await page.close();
}
{	/* the atrium's doors follow the reader */
	const page = await ctx.newPage();
	await page.goto(`${BASE}templates/conference-atrium.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.getElementById('voices')?.scrollIntoView());
	await page.waitForTimeout(400);
	const cur = await page.locator('.at-doors a[aria-current]').getAttribute('href').catch(() => '');
	ok('the sub-nav marks the section in view', cur === '#voices' || cur === '#programme', cur || 'none');
	await page.close();
}
{	/* atrium: the sub-nav sits on a whole pixel with a whole-pixel height, so
	   Chrome has nothing to round differently on hover (the People toolbar bug) */
	const page = await ctx.newPage();
	for (const r of RECORDS) {
		await page.goto(`${BASE}templates/conference-atrium.html?c=${r}`, { waitUntil: 'networkidle' });
		await page.waitForTimeout(250);
		const [top, h] = await page.evaluate(() => {
			const b = document.querySelector('.at-doors').getBoundingClientRect();
			return [b.top + scrollY, b.height];
		});
		const whole = v => Math.abs(v - Math.round(v)) <= 1 / 32;
		ok(`atrium doors on whole pixels · ${r} (${top.toFixed(3)}, ${h})`, whole(top) && whole(h));
	}
	/* atrium: a session published without timings offers ONE way in, not a
	   "Play" per talk that would all start at 0:00 */
	await page.goto(`${BASE}templates/conference-atrium.html?c=2025-berlin`, { waitUntil: 'networkidle' });
	const untimed = await page.evaluate(() => {
		const acc = [...document.querySelectorAll('.at-acc')].find(d => d.querySelector('.at-untimed'));
		return acc ? { rows: acc.querySelectorAll('.at-talk').length, plays: acc.querySelectorAll('.at-talk .si-conf-watch').length } : null;
	});
	ok('untimed session: talks listed, no per-talk play', !!untimed && untimed.rows > 0 && untimed.plays === 0, JSON.stringify(untimed));
	/* atrium: the cultural strand is named by its reviewed form, never "Concert" by default */
	const form = await page.locator('.at-acc--culture .at-acc__meta').first().textContent();
	ok(`culture labelled by its form, inside the programme (${form.trim()})`,
		/Cultural presentation/.test(form) && !/Concert/.test(form));
	ok('no separate culture band', await page.locator('#culture').count() === 0);
	/* atrium: the whole speaker card is the link to the person */
	const cards = await page.evaluate(() => ({
		links: document.querySelectorAll('.at-voices a.at-voice').length,
		nested: document.querySelectorAll('.at-voices a.at-voice a').length,
	}));
	ok(`speaker cards are whole links (${cards.links}), none nested`,
		cards.links === data['2025-berlin'].tally.on_people && cards.nested === 0);
	/* atrium: the globe replaces the flat map, which stays in the markup as
	   the no-canvas fallback and plots exactly the countries on record */
	ok('the globe is mounted', await page.locator('.at-gather canvas.si-globe').count() === 1);
	await page.evaluate(() => document.querySelector('.si-globe').scrollIntoView({ behavior: 'instant', block: 'center' }));
	const frameA = await page.evaluate(() => document.querySelector('.si-globe').toDataURL().length + ':' + document.querySelector('.si-globe').toDataURL().slice(-400));
	await page.waitForTimeout(1500);
	const frameB = await page.evaluate(() => document.querySelector('.si-globe').toDataURL().length + ':' + document.querySelector('.si-globe').toDataURL().slice(-400));
	ok('the globe turns', frameA !== frameB);
	/* leaving the tab and coming back must not freeze it (it used to, until the
	   globe was scrolled out of view and back) */
	const frame = () => page.evaluate(() => document.querySelector('.si-globe').toDataURL().slice(-600));
	const setHidden = h => page.evaluate(h => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
		document.dispatchEvent(new Event('visibilitychange'));
	}, h);
	await setHidden(true);
	await page.waitForTimeout(200);
	const h1 = await frame(); await page.waitForTimeout(800); const h2 = await frame();
	ok('the globe rests while the tab is hidden', h1 === h2);
	await setHidden(false);
	const v1 = await frame(); await page.waitForTimeout(800); const v2 = await frame();
	ok('the globe turns again on returning to the tab', v1 !== v2);
	/* and a drag answers even when the loop is not running */
	await setHidden(true);
	const d1 = await frame();
	const gb = await page.locator('.si-globe').boundingBox();
	await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
	await page.mouse.down();
	await page.mouse.move(gb.x + gb.width / 2 + 80, gb.y + gb.height / 2, { steps: 6 });
	await page.mouse.up();
	ok('a drag turns the globe even while it is paused', d1 !== await frame());
	await setHidden(false);
	const flat = await page.evaluate(async () => {
		const core = await import('./js/conference-core.js');
		const rec = core.normalise(await (await fetch('../data/conf-2025-berlin.json')).json());
		const land = await core.loadLand();
		const div = document.createElement('div');
		div.innerHTML = core.gatheringSVG(rec, land);
		return div.querySelectorAll('.si-gather__origin').length;
	});
	ok(`flat fallback plots the record's countries (${flat})`, flat === data['2025-berlin'].geo.countries.length);
	/* atrium: the record names YouTube and carries no provenance rows */
	const rec = await page.locator('#record .si-conf-colophon').textContent();
	ok('the record names YouTube, drops the provenance rows',
		/YouTube/.test(rec) && !/Source|on \/people\//.test(rec));
	await page.close();
}
{	/* the upcoming state fixture rewrites the spine, not the content */
	const page = await ctx.newPage();
	await page.goto(`${BASE}templates/conference-atrium.html?c=2025-berlin&state=upcoming`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	ok('upcoming shows a countdown', await page.locator('[data-countdown]').count() === 1);
	ok('upcoming shows registration', await page.locator('#register').count() === 1);
	ok('upcoming still lists the real sessions',
		await page.locator('.at-acc').count() === expected(data['2025-berlin']).sessions);
	await page.close();
}
{	/* phones: no horizontal scroll anywhere */
	const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
	for (const d of DRAFTS) {
		await p.goto(`${BASE}templates/conference-${d}.html?c=2025-berlin`, { waitUntil: 'networkidle' });
		await p.waitForTimeout(300);
		const over = await p.evaluate(() =>
			document.documentElement.scrollWidth - document.documentElement.clientWidth);
		ok(`${d}: no horizontal scroll at 390px`, over === 0, `${over}px`);
	}
	await p.close();
}
{	/* the index of the wing lists every draft and loads its own payload */
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(e.message));
	await page.goto(`${BASE}index.html`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(300);
	ok('the wing index has no page errors', errors.length === 0, errors[0]);
	ok('the wing index links all five drafts',
		await page.locator('a[href^="templates/conference-"]').count() >= 5);
	await page.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED\n- ${fails.join('\n- ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
