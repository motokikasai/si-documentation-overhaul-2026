/* interact-index.mjs — assertions for the three /videos/ archive drafts, Firefox only.
 *
 *   cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8764
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node videos/build/interact-index.mjs
 *
 * Every assertion is against the payload (videos/data/videos.json) or against a behaviour
 * the draft claims, never against the markup: the year that opens must list exactly as many
 * videos as the index holds for that year; the Desk must not fetch the 6 MB corpus before a
 * question is asked; the address bar must carry the state; nothing may scroll sideways at
 * 390px. Screenshots land in the scratchpad, not in the repo.
 */
const { firefox } = await import(`${process.env.PW}/playwright/index.mjs`);

const BASE = process.env.BASE || 'http://127.0.0.1:8764/videos/templates/';
const SHOT = process.env.SHOT || '/tmp/';
let bad = 0;
const ok = (c, m, x = '') => { console.log(`${c ? ' ok ' : 'FAIL'}  ${m}${x ? ' — ' + x : ''}`); if (!c) bad++; };

const browser = await firefox.launch();
const settle = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const index = await (await fetch(BASE + '../data/videos.json')).json();
const V = index.videos;

for (const [file, name] of [['videos-shelf.html', 'Shelf'], ['videos-run.html', 'Run'], ['videos-desk.html', 'Desk']]) {
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errs = [];
	page.on('console', m => m.type() === 'error' && errs.push(m.text()));
	page.on('pageerror', e => errs.push(String(e)));
	await page.goto(BASE + file, { waitUntil: 'networkidle' });
	await settle(page);
	console.log(`\n— ${name} —`);
	ok(errs.length === 0, 'no console errors', errs.slice(0, 3).join(' | '));
	ok(!(await page.locator('main').getAttribute('aria-busy')), 'main rendered');
	ok((await page.locator('h1').innerText()).length > 3, 'has a heading', await page.locator('h1').innerText());

	if (name === 'Shelf') {
		const bands = await page.locator('.vi-shelf').count();
		ok(bands === 5, 'a band per series plus the shelf outside one', `${bands}`);
		const counts = await page.locator('.vi-band__note').allInnerTexts();
		ok(counts.some(t => t.includes('751')), 'the weekly dialogue reports 751', counts[0]);
		await page.click('.vi-shelf[data-series="weekly-webcast-hzl"] .vi-more');
		await settle(page);
		const rows = await page.locator('.vi-row').count();
		ok(rows === 60, 'opening a series pages 60 rows first', `${rows}`);
		ok(page.url().includes('series=weekly-webcast-hzl'), 'the open series is in the address');
		await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
		await page.waitForFunction(() => document.querySelectorAll('.vi-row').length > 60, null, { timeout: 4000 }).catch(() => {});
		ok(await page.locator('.vi-row').count() > 60, 'the list grows at the end', `${await page.locator('.vi-row').count()}`);
		await page.click('.vi-more--back'); await settle(page);
		ok(await page.locator('.vi-shelf').count() === 5, 'and back to the shelves');
	}

	if (name === 'Run') {
		const yrs = await page.locator('.vi-year').count();
		ok(yrs === 12, 'a section per year, 2015–2026', `${yrs}`);
		const first = await page.locator('.vi-year').first().getAttribute('data-year');
		ok(first === '2026', 'newest year first', first);
		const peakW = await page.locator('.vi-year[data-year="2021"] .vi-year__weight').evaluate(e => e.style.getPropertyValue('--w'));
		ok(peakW === '100.0%', 'the busiest year is the full rule', peakW);
		const cells = await page.locator('.vi-year[data-year="2021"] .vi-rail__cell').count();
		ok(cells === 12, 'twelve months in a rail', `${cells}`);
		await page.click('.vi-year[data-year="2021"] .vi-year__no'); await settle(page);
		const rows = await page.locator('.vi-year[data-year="2021"] .vi-row').count();
		const real = V.filter(v => v.date.startsWith('2021')).length;
		ok(rows === real, 'an open year lists all of its videos', `${rows} vs ${real}`);
		const months = await page.locator('.vi-year[data-year="2021"] .vi-month').count();
		ok(months >= 10, 'grouped by month', `${months}`);
		await page.click('.vi-year[data-year="2021"] .vi-rail__bar >> nth=0'); await settle(page);
		const m1 = await page.locator('.vi-year[data-year="2021"] .vi-month').count();
		ok(m1 === 1, 'picking a month narrows to that month', `${m1}`);
		ok(page.url().includes('month=2021-01'), 'the month is in the address', page.url());
	}

	if (name === 'Desk') {
		ok(await page.locator('.vd-hit').count() === 0, 'nothing is searched before a question');
		const before = await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('corpus.json')));
		ok(!before, 'the 6 MB corpus is not loaded on first paint');
		await page.click('.vd-try >> nth=1');                   // Ukraine
		await page.waitForSelector('.vd-hit', { timeout: 20000 });
		await settle(page);
		const hits = await page.locator('.vd-hit').count();
		ok(hits > 0, 'the spoken word answers', `${hits} transcripts`);
		const clock = await page.locator('.vd-hit__clock').first().innerText();
		ok(/^\d+:\d\d(:\d\d)?$/.test(clock), 'each answer carries its second', clock);
		const href = await page.locator('.vd-hit__a').first().getAttribute('href');
		ok(/^\/videos\/[a-z0-9-]+\/\?t=\d+$/.test(href), 'and opens the video at that second', href);
		ok(await page.locator('.vd-hit__line mark').count() > 0, 'the word is marked in the line');
		ok(await page.locator('.vi-row').count() > 0, 'titles answer too');
		ok(page.url().includes('q=Ukraine'), 'the question is in the address');
		const nonsense = 'zzqqxx';
		await page.fill('.vi-q', nonsense);
		await page.waitForFunction(() => document.querySelector('.vi-empty, .vd-caveat'), null, { timeout: 5000 }).catch(() => {});
		ok(await page.locator('.vi-empty').count() > 0, 'a question with no answer says so');
	}

	await page.screenshot({ path: SHOT + `idx-${name.toLowerCase()}.png`, fullPage: false });
	// the phone
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(BASE + file, { waitUntil: 'networkidle' });
	await settle(page);
	const over = await page.evaluate(() => {
		const d = document.documentElement;
		const wide = [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > d.clientWidth + 1)
			.map(e => e.className).slice(0, 4);
		return { scroll: d.scrollWidth - d.clientWidth, wide };
	});
	ok(over.scroll <= 0, 'no horizontal scroll at 390px', JSON.stringify(over));
	await page.screenshot({ path: SHOT + `idx-${name.toLowerCase()}-390.png`, fullPage: false });
	await page.close();
}

await browser.close();
console.log(bad ? `\n${bad} failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
