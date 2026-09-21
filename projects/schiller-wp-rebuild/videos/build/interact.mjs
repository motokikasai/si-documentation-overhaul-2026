/* interact.mjs — assertions for the five video drafts, Firefox only.
 *
 *   cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8764
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node videos/build/interact.mjs [--port=8764]
 *
 * Every check is against the PAYLOAD: chapter rows against the record's
 * chapters, caption lines against its sentences, every seekable second against
 * the set of seconds the record actually holds (an invented second fails), the
 * archive search against a count made here in Node from the same corpus, the
 * two-click rule against the network. A draft passes when it says exactly what
 * the record holds — nothing invented, nothing dropped.
 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const BASE = `http://127.0.0.1:${opt('port', '8764')}/videos/templates/`;
const DRAFTS = ['programme', 'reading', 'echo', 'constellation', 'almanac'];
const RECORDS = ['webcast', 'interview', 'beethoven', 'bare'];

const fails = [];
const ok = (name, cond, detail = '') => {
	console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? ` — ${detail}` : ''}`);
	if (!cond) fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
};
const load = async f => JSON.parse(await readFile(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const data = Object.fromEntries(await Promise.all(RECORDS.map(async r => [r, await load(`video-${r}.json`)])));
const index = await load('videos.json');
const corpus = await load('corpus.json');

/** Every second a page may legitimately seek to, for one record. */
function seconds(rec) {
	const s = new Set([0]);
	for (const c of rec.chapters) s.add(c.t);
	for (const x of rec.transcript?.sentences || []) s.add(Math.floor(x.t));
	for (const p of rec.people) p.at.forEach(t => s.add(t));
	for (const p of rec.places) (p.at || []).forEach(t => s.add(t));
	for (const t of rec.terms || []) t.at.forEach(x => s.add(x));
	return s;
}
const sentenceAt = (rec, t) => { let a = -1; rec.transcript.sentences.forEach((s, i) => { if (s.t <= t + 0.2) a = i; }); return a; };

const browser = await firefox.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });

for (const d of DRAFTS) for (const r of RECORDS) {
	console.log(`\n${d} · ${r}`);
	const rec = data[r];
	const page = await ctx.newPage();
	const yt = [];
	const errs = [];
	page.on('request', q => { if (/youtube(-nocookie)?\.com/.test(q.url())) yt.push(q.url()); });
	page.on('pageerror', e => errs.push(e.message));
	await page.goto(`${BASE}video-${d}.html?v=${r}`, { waitUntil: 'networkidle' });
	await page.waitForSelector('main:not([aria-busy])');
	await page.evaluate(() => { window.__seeks = []; document.addEventListener('si:seek', e => window.__seeks.push(e.detail.t)); });
	ok('renders without a script error', !errs.length, errs.join(' | '));
	ok('nothing requested from YouTube before a press', yt.length === 0, yt[0]);

	// every seekable second is one the record holds
	const seeks = await page.$$eval('[data-seek]:not([data-yt])', els => els.map(e => +e.dataset.seek));
	const allowed = seconds(rec);
	const bad = seeks.filter(t => !allowed.has(t));
	ok(`every one of ${seeks.length} seek controls points at a second the record holds`, bad.length === 0, `invented: ${bad.slice(0, 5)}`);

	// nothing printed for what the record does not hold
	const nTx = await page.$$eval('.si-vid-tx__s', e => e.length);
	if (rec.transcript) ok(`caption lines = ${rec.transcript.sentences.length} sentences`, nTx === 0 || nTx === rec.transcript.sentences.length, `${nTx}`);
	else ok('no caption markup for a record without captions', nTx === 0, `${nTx}`);
	const nCh = await page.$$eval('.si-vid-chapters__a', e => e.length);
	ok(`chapter rows ∈ {0, ${rec.chapters.length}}`, nCh === 0 || nCh === rec.chapters.length, `${nCh}`);
	const mail = await page.$$eval('.si-vid-cta a[href^="mailto:"]', e => e.map(a => a.getAttribute('href')));
	if (rec.invite) ok('the invitation is the one the description publishes', mail.length > 0 && mail.every(h => h.startsWith(`mailto:${rec.invite.email}`)), mail.join());
	else ok('no invitation where the record carries none', mail.length === 0, mail.join());
	const rows = await page.$$eval('.si-vid-record > div', e => e.length);
	ok('the record colophon is present', rows >= 8, `${rows}`);

	// the playhead, simulated — before any real player exists to report its own time
	if (['programme', 'reading'].includes(d) && rec.transcript) {
		const t = rec.transcript.sentences[Math.floor(rec.transcript.sentences.length / 2)].t + 1;
		await page.evaluate(t => document.dispatchEvent(new CustomEvent('si:simulate-time', { detail: { t } })), t);
		const now = await page.$eval('.si-vid-tx__s.is-now', e => +e.dataset.i).catch(() => -1);
		ok(`the playhead at ${t.toFixed(0)}s lights sentence ${sentenceAt(rec, t)}`, now === sentenceAt(rec, t), `${now}`);
		if (rec.chapters.length) {
			let ci = -1; rec.chapters.forEach((c, j) => { if (t >= c.t) ci = j; });
			const lit = await page.$$eval('.si-vid-chapters__a.is-now, .rd-ch.is-now', e => e.map(x => +x.dataset.ch));
			ok(`…and chapter ${ci}`, lit.length > 0 && lit.every(x => x === ci), lit.join());
		}
	}
	// two-click: the facade becomes a youtube-nocookie player with the JS API on
	if (rec.yt) {
		await page.click('.si-vid-embed__btn');
		const src = await page.$eval('.si-vid-embed iframe', f => f.src).catch(() => '');
		// from 0 — or from wherever the (simulated) playhead already stood
		const st = +(src.match(/start=(\d+)/) || [])[1];
		ok(`press → youtube-nocookie with the JS API, from ${st}s`, /youtube-nocookie\.com\/embed\/.+enablejsapi=1/.test(src) && (st === 0 || allowed.has(st) || rec.transcript?.sentences.some(x => Math.floor(x.t + 1) === st)), src);
	}

	// draft-specific behaviour
	if (d === 'programme' && rec.chapters.length) {
		const i = Math.min(3, rec.chapters.length - 1);
		await page.click(`.pg-side .si-vid-chapters__a[data-ch="${i}"]`);
		await page.waitForTimeout(100);
		const last = await page.evaluate(() => window.__seeks.at(-1));
		ok(`chapter ${i} → the tape seeks to ${rec.chapters[i].t}`, last === rec.chapters[i].t, `${last}`);
		if (rec.transcript) await page.click('.pg-read__box .si-vid-tx__s[data-i="40"]');
		if (rec.transcript) {
			const l2 = await page.evaluate(() => window.__seeks.at(-1));
			ok(`caption line 40 → ${Math.floor(rec.transcript.sentences[40].t)}`, l2 === Math.floor(rec.transcript.sentences[40].t), `${l2}`);
		}
	}
	if (d === 'reading' && rec.transcript) {
		await page.click('[data-follow="0"]');   // "Stay": a playing tape must not scroll the text out from under a selection
		await page.evaluate(() => {
			const s = document.querySelectorAll('.si-vid-tx__s')[12];
			s.scrollIntoView({ block: 'center' });
			const r = document.createRange(); r.selectNodeContents(s);
			getSelection().removeAllRanges(); getSelection().addRange(r);
		});
		await page.waitForTimeout(150);
		ok('selecting words offers “cite this moment”', await page.$eval('.rd-cite', e => !e.hidden));
		await page.click('.rd-cite__btn');
		const q = await page.$eval('.rd-cite', e => e.dataset.last || '');
		const t12 = Math.floor(rec.transcript.sentences[12].t);
		ok(`the citation carries the line's own second (?t=${t12})`, q.includes(`${rec.url}?t=${t12}`) && q.includes('automatic captions'), q.slice(0, 120));
	}
	if (d === 'echo' && rec.terms) {
		ok(`${rec.terms.length} words listed`, await page.$$eval('.ec-term', e => e.length) === rec.terms.length);
		const i = rec.terms.findIndex(t => t.docs > 2);
		await page.click(`.ec-term[data-i="${i}"]`);
		ok(`“${rec.terms[i].term}” → ${rec.terms[i].echoes.length} echoes on the axis`, await page.$$eval('.ec-dot', e => e.length) === rec.terms[i].echoes.length);
		const q = 'Gaza';
		const rx = /\bGaza/i;
		const expect = corpus.docs.filter(d => d.s.some(s => rx.test(s))).length;
		await page.fill('.ec-form input', q);
		await page.click('.ec-form button');
		await page.waitForSelector('.ec-sum', { timeout: 20000 });
		const got = await page.$eval('.ec-sum b', e => parseInt(e.textContent));
		ok(`archive search “${q}” finds ${expect} broadcasts (counted in Node)`, got === expect, `${got}`);
	}
	if (d === 'echo' && !rec.terms && rec.composers) {
		const eps = index.videos.filter(v => v.series === rec.series.slug && v.lang === rec.lang).length;
		await page.waitForSelector('.ec-grid2');
		ok(`composer grid spans all ${eps} episodes`, await page.$eval('.ec-grid2__row .ec-grid2__cells', e => e.children.length) === eps);
		ok('this episode is ringed in every row', await page.$$eval('.ec-cell.is-self', e => e.length) === await page.$$eval('.ec-grid2__row', e => e.length));
	}
	if (d === 'constellation') {
		const people = await page.$$eval('.cn-node[data-s="people"]', e => e.length);
		ok(`${rec.people.length} people in the sky`, people === rec.people.length, `${people}`);
		const nodes = await page.$$eval('.cn-node', e => e.length);
		const listed = await page.$$eval('.cn-list li', e => e.length);
		ok(`sky and list agree (${nodes})`, nodes === listed, `${nodes} vs ${listed}`);
		const whys = await page.$$eval('.cn-why', e => e.filter(x => !x.textContent.trim()).length);
		ok('every connection states its reason', whys === 0, `${whys} without`);
	}
	if (d === 'almanac') {
		const eps = rec.series ? index.videos.filter(v => v.series === rec.series.slug && v.lang === rec.lang) : index.videos;
		const marks = await page.$$eval('.al-c', e => e.length);
		if (rec.series) ok(`the wall holds ${eps.length} episodes (or fewer marks where two share a slot)`, marks <= eps.length && marks >= eps.length * 0.9, `${marks}`);
		ok('this broadcast is ringed exactly once', await page.$$eval('.al-c.is-self', e => e.length) === 1);
		if (rec.week.length) {
			const items = await page.$$eval('.al-item:not(.al-item--self)', e => e.length);
			ok(`the fortnight holds all ${rec.week.length} items`, items === rec.week.length, `${items}`);
		}
	}
	await page.close();
}

/* no horizontal scroll at 390px */
console.log('\nphone');
const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
for (const d of DRAFTS) for (const r of RECORDS) {
	const page = await phone.newPage();
	await page.goto(`${BASE}video-${d}.html?v=${r}`, { waitUntil: 'networkidle' });
	await page.waitForSelector('main:not([aria-busy])');
	const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	ok(`${d} · ${r}: no horizontal scroll at 390px`, over <= 0, `${over}px`);
	await page.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED\n${fails.join('\n')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
