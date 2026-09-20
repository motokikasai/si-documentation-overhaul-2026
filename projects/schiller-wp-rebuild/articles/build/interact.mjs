/* interact.mjs — the verification pass for the six article drafts.
 *
 *   python3 -m http.server 8761          # from projects/schiller-wp-rebuild/
 *   PW=<playwright node_modules> node build/interact.mjs
 *
 * Firefox only: chromium's headless shell needs a system libnspr4 this box
 * does not have. Every check is a real assertion against the rendered page —
 * counts taken from the payload, not from the markup that produced it.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8761/articles/templates/';
const HERE = new URL('.', import.meta.url).pathname;
const index = JSON.parse(readFileSync(HERE + '../data/articles.json', 'utf8'));
const reading = JSON.parse(readFileSync(HERE + '../data/reading.json', 'utf8'));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
	if (cond) { pass++; console.log(`  ✓ ${name}`); }
	else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const browser = await firefox.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });

async function open(path, { width, height } = {}) {
	const page = await ctx.newPage();
	if (width) await page.setViewportSize({ width, height: height || 1000 });
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
	await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForSelector('main:not([aria-busy])', { timeout: 20000 });
	page.__errors = errors;
	return page;
}
const clean = (page, name) => ok(`${name}: no console or page errors`, page.__errors.length === 0, page.__errors.slice(0, 2).join(' | '));

/* ======================================================= A · The Leaf ===== */
console.log('\nDRAFT A — The Leaf');
{
	const a = reading.articles['55739'];
	const page = await open('article-leaf.html');
	clean(page, 'leaf');
	eq('leaf: the title is the article title', (await page.textContent('.leaf-title')).trim(), a.t);
	ok('leaf: the date of creation is printed', (await page.textContent('.ar-date')).includes('2019'));
	ok('leaf: the byline links to both People', (await page.$$eval('.ar-byline a', els => els.map(e => e.getAttribute('href')))).join() === '/people/hussein-askary/,/people/jason-ross/');
	ok('leaf: the apparatus sits in the margin column',
		await page.$eval('.leaf-margin', el => getComputedStyle(el).position === 'sticky'));
	ok('leaf: the featured image is out of the reading column',
		await page.$eval('.leaf-plate', el => !el.closest('.ar-prose')));
	eq('leaf: the picture carries a caption only when the library holds one',
		(await page.$$('.leaf-plate figcaption')).length, a.image && a.image.line ? 1 : 0);
	ok('leaf: the margin carries no explanatory notes at all',
		(await page.$$('.leaf-note')).length === 0);
	eq('leaf: no reading-progress hairline', (await page.$$('.ar-progress')).length, 0);
	ok('leaf: the legacy "Record" block is gone',
		!(await page.textContent('.leaf-margin')).includes('Legacy post'));
	/* structure: the heading that opened the body is the deck now */
	eq('leaf: the opening heading is set as the deck, not as a section',
		(await page.textContent('.leaf-standfirst')).trim(), a.deck);
	ok('leaf: … and it is no longer inside the prose',
		!(await page.textContent('.leaf-prose')).includes(a.deck));
	eq('leaf: the outline starts at h2', await page.$eval('.leaf-prose', el =>
		el.querySelector('h2, h3, h4, h5')?.tagName || ''), 'H2');
	/* footnotes */
	eq('leaf: every note in the list is rendered', (await page.$$('.si-notes li')).length, a.notes);
	eq('leaf: every note has a marker pointing at it', (await page.$$('.si-fn a')).length, a.notes);
	ok('leaf: the markers and the notes agree on the numbers',
		await page.evaluate(() => {
			const marks = [...document.querySelectorAll('.si-fn a')].map(a => a.getAttribute('href'));
			return marks.every(h => document.querySelector(h.replace('#', '#')) !== null);
		}));
	ok('leaf: each note links back to its marker',
		await page.evaluate(() => [...document.querySelectorAll('.si-fn-back')]
			.every(a => document.querySelector(a.getAttribute('href')) !== null)));
	const before = await page.evaluate(() => scrollY);
	await page.click('.si-fn a');
	await page.waitForTimeout(1000);
	const atNote = await page.evaluate(() => scrollY);
	ok('leaf: a marker carries the reader to its note', atNote > before + 500);
	ok('leaf: … and the note is on screen when you arrive',
		await page.$eval('#fn-1', el => {
			const r = el.getBoundingClientRect();
			return r.top > 0 && r.bottom < innerHeight;
		}));
	ok('leaf: … and the note it landed on is marked',
		await page.$eval('#fn-1', el => el.classList.contains('is-flash')));
	await page.click('.si-fn-back');
	await page.waitForTimeout(1000);
	ok('leaf: the back-link returns to the marker in the text',
		await page.evaluate(() => scrollY) < atNote - 500 &&
		await page.$eval('#fnref-1', el => {
			const r = el.getBoundingClientRect();
			return r.top > 0 && r.bottom < innerHeight;
		}));
	ok('leaf: the body is set in paragraphs', (await page.$$('.leaf-prose p')).length > 40);
	ok('leaf: paragraphs are separated by the rhythm, not by nothing',
		await page.$eval('.leaf-prose p + p', el => parseFloat(getComputedStyle(el).marginTop) > 8));
	ok('leaf: the colophon states when it was published',
		(await page.textContent('.ar-colophon')).includes('Published'));
	ok('leaf: … and no longer repeats the URL the reader is already on',
		!(await page.textContent('.ar-colophon')).includes('Permalink'));
	ok('leaf: "continue" stays in the article\'s own language',
		await page.evaluate(() => [...document.querySelectorAll('.ar-continue a')]
			.every(a => !/^\/(de|ru|zh-hans)\//.test(a.getAttribute('href')))));
	ok('leaf: "continue" is an index of real links', (await page.$$('.ar-continue a[href^="/blog/"]')).length === 6);
	ok('leaf: a long article earns the drop cap or opens on a heading',
		await page.$eval('.leaf-prose', el => el.classList.contains('has-drop') || el.firstElementChild.tagName !== 'P'));
	await page.close();
}
{
	const page = await open('article-leaf.html?p=115296');
	eq('leaf: ?p= switches the article', (await page.textContent('.leaf-title')).slice(0, 20), reading.articles['115296'].t.slice(0, 20));
	ok('leaf: a 317-word news short gets no drop cap',
		!await page.$eval('.leaf-prose', el => el.classList.contains('has-drop')));
	await page.close();
}

/* ============================================ B · The Reading Room ===== */
console.log('\nDRAFT B — The Reading Room');
{
	const a = reading.articles['55739'];
	const page = await open('article-room.html');
	clean(page, 'room');
	eq('room: one station per heading', (await page.$$('.room-spine b')).length, a.sections.filter(s => s.level <= 3).length);
	eq('room: the section list matches', (await page.$$('.room-sections a')).length, a.sections.filter(s => s.level <= 3).length);
	ok('room: the clock starts at the article\'s reading time',
		(await page.textContent('[data-left]')).includes(String(a.m)));
	const day = await page.$eval('body', el => getComputedStyle(el).backgroundColor);
	await page.click('[data-set="ground"][data-value="night"]');
	const night = await page.$eval('body', el => getComputedStyle(el).backgroundColor);
	ok('room: the night ground changes the page', day !== night, `${day} vs ${night}`);
	ok('room: night keeps the text legible (light ink on dark ground)',
		await page.$eval('.room-prose', el => {
			const c = getComputedStyle(el).color.match(/\d+/g).map(Number);
			return (c[0] + c[1] + c[2]) / 3 > 128;
		}));
	await page.click('[data-set="size"][data-value="l"]');
	const big = await page.$eval('.room-prose', el => parseFloat(getComputedStyle(el).fontSize));
	await page.click('[data-set="size"][data-value="s"]');
	const small = await page.$eval('.room-prose', el => parseFloat(getComputedStyle(el).fontSize));
	ok('room: the size setting really changes the reading size', big > small + 2, `${big} vs ${small}`);
	await page.reload({ waitUntil: 'load' });
	await page.waitForSelector('main:not([aria-busy])');
	eq('room: the settings are remembered', await page.getAttribute('body', 'data-ground'), 'night');
	await page.evaluate(() => localStorage.clear());
	await page.close();
}
{
	const page = await open('article-room.html?p=115296');
	eq('room: an article with no headings shows no station', (await page.$$('.room-spine b')).length, 0);
	ok('room: … and no empty section list', (await page.$$('.room-sections')).length === 0);
	/* the two-click video rule */
	const asked = [];
	page.on('request', r => { if (/youtube|ytimg|google/.test(r.url())) asked.push(r.url()); });
	await page.waitForTimeout(400);
	ok('room: nothing is fetched from YouTube before the click', asked.every(u => u.includes('ytimg')), asked.join(' '));
	await page.click('.ar-embed');
	await page.waitForSelector('.ar-embed iframe');
	ok('room: play inserts the nocookie player',
		(await page.getAttribute('.ar-embed iframe', 'src')).startsWith('https://www.youtube-nocookie.com/embed/'));
	await page.close();
}

/* ============================================== C · The Threshold ===== */
console.log('\nDRAFT C — The Threshold');
{
	const page = await open('article-threshold.html');
	clean(page, 'threshold');
	ok('threshold: the cover is the article\'s own image', (await page.getAttribute('.th-cover__img', 'src')).includes('covers/55739'));
	ok('threshold: the title sits on the cover', await page.$eval('.th-title', el => !!el.closest('.th-cover')));
	ok('threshold: the date is on the cover too', (await page.textContent('.th-cover .ar-date')).includes('2019'));
	/* the article's OWN illustrations stay in the body — what must not come
	   back is the cover, which has already done its work */
	ok('threshold: the cover is never repeated in the reading field',
		await page.$eval('.th-sheet', el => !el.querySelector('img[src*="covers/"]')));
	const read = () => page.$eval('.th-cover', el => parseFloat(el.style.getPropertyValue('--cover-opacity') || '1'));
	const before = await read();
	await page.bringToFront();
	await page.evaluate(() => scrollTo({ top: 600, behavior: 'instant' }));
	/* the dissolve is driven from requestAnimationFrame; wait for the value to
	   move rather than for a fixed number of milliseconds */
	await page.waitForFunction(
		() => parseFloat(document.querySelector('.th-cover').style.getPropertyValue('--cover-opacity') || '1') < 1,
		null, { timeout: 4000 }).catch(() => {});
	const after = await read();
	ok('threshold: the cover dissolves as you cross it', after < before, `${before} → ${after}`);
	await page.close();
}
{
	const page = await open('article-threshold.html?nocover=1');
	ok('threshold: with no photograph the date becomes the picture', (await page.textContent('.th-numeral')) === '2019');
	ok('threshold: … and the title stays legible on the light field',
		await page.$eval('.th-title', el => {
			const c = getComputedStyle(el).color.match(/\d+/g).map(Number);
			return (c[0] + c[1] + c[2]) / 3 < 128;
		}));
	await page.close();
}

/* ================================================= A · The Ledger ===== */
console.log('\nCOLLECTION A — The Ledger');
{
	const en = index.items.filter(i => i.l === 'en').length;
	const page = await open('articles-ledger.html');
	clean(page, 'ledger');
	eq('ledger: the page is called Articles', (await page.textContent('h1')).trim(), 'Articles');
	eq('ledger: every English article is listed', (await page.$$('.lg-row')).length, en);
	ok('ledger: the count line agrees', (await page.textContent('[data-count]')).includes(en.toLocaleString('en-GB')));
	ok('ledger: months are the grouping', (await page.$$('.lg-month')).length > 100);
	ok('ledger: the month head is sticky', await page.$eval('.lg-month', el => getComputedStyle(el).position === 'sticky'));
	await page.hover('.lg-row:nth-child(2) a, .lg-group .lg-row:nth-of-type(2) a');
	await page.waitForSelector('.lg-loupe h2');
	ok('ledger: hovering a line raises it in the loupe', (await page.textContent('.lg-loupe h2')).length > 5);
	ok('ledger: the loupe picture starts tonal, like every other photograph',
		await page.$eval('.lg-loupe .arc-thumb img', el => getComputedStyle(el).filter.includes('grayscale')));
	/* Two moves, not one: the loupe's markup is replaced when a new row is
	   raised, and a browser does not re-evaluate :hover under a cursor that
	   has not moved since. A real pointer always moves. */
	const plate = await (await page.$('.lg-loupe .arc-thumb')).boundingBox();
	await page.mouse.move(plate.x + plate.width / 2, plate.y + plate.height / 2);
	await page.mouse.move(plate.x + plate.width / 2 + 6, plate.y + plate.height / 2 + 4);
	await page.waitForTimeout(1000);        /* the fade runs for --si-dur-3 */
	ok('ledger: … and takes its own colours when the pointer reaches it',
		await page.$eval('.lg-loupe .arc-thumb img', el => getComputedStyle(el).filter === 'none'));
	eq('ledger: … and the index itself carries no pictures at all',
		(await page.$$('.lg-list img')).length, 0);
	await page.keyboard.press('/');
	eq('ledger: "/" reaches the search field', await page.evaluate(() => document.activeElement.type), 'search');
	await page.fill('[data-q]', 'Beethoven');
	await page.waitForTimeout(400);
	const found = (await page.$$('.lg-row')).length;
	ok('ledger: search narrows the index', found > 0 && found < en, `${found} rows`);
	ok('ledger: the search is in the URL, so a view can be shared', page.url().includes('q=Beethoven'));
	await page.click('[data-reset]');
	await page.waitForTimeout(300);
	eq('ledger: clear puts them all back', (await page.$$('.lg-row')).length, en);
	await page.selectOption('[data-set="topic"]', 'classical-culture');
	await page.waitForTimeout(300);
	const topicRows = (await page.$$('.lg-row')).length;
	eq('ledger: the topic filter uses the reviewed classification', topicRows,
		index.items.filter(i => i.l === 'en' && i.tp.includes('classical-culture')).length);
	await page.close();
}

/* ================================================== B · The Drift ===== */
console.log('\nCOLLECTION B — The Drift');
{
	const years = new Set(index.items.filter(i => i.l === 'en').map(i => i.d.slice(0, 4)));
	const page = await open('articles-drift.html');
	clean(page, 'drift');
	eq('drift: one station per year', (await page.$$('.dr-year')).length, years.size);
	eq('drift: the density rail has the same years', (await page.$$('.dr-rail button')).length, years.size);
	ok('drift: the newest year is drawn immediately', (await page.$$('#y-2026 .dr-entry')).length > 0);
	ok('drift: distant years are still empty (lazy)', (await page.$$('#y-2013 .dr-entry')).length === 0);
	ok('drift: long pieces are set as features', (await page.$$('.dr-entry--feature')).length > 0);
	ok('drift: short pieces stay one line', (await page.$$('.dr-entry:not(.dr-entry--feature)')).length > 0);
	ok('drift: entries alternate banks', (await page.$$('.dr-entry--l')).length > 0 && (await page.$$('.dr-entry--r')).length > 0);
	await page.click('.dr-rail button[data-y="2016"]');
	await page.waitForSelector('#y-2016 .dr-entry', { timeout: 8000 }).catch(() => {});
	ok('drift: the rail travels to a year', (await page.$$('#y-2016 .dr-entry')).length > 0);
	/* the rail's marker is an IntersectionObserver, and the jump keeps
	   correcting itself while the years it passed fill in — wait for it */
	await page.waitForFunction(
		() => document.querySelector('.dr-rail button[data-y="2016"]')?.getAttribute('aria-current') === 'true',
		null, { timeout: 8000 }).catch(() => {});
	ok('drift: … and the rail says where you are',
		await page.$eval('.dr-rail button[data-y="2016"]', el => el.getAttribute('aria-current') === 'true'));
	await page.close();
}

/* ============================================= C · The Broadsheet ===== */
console.log('\nCOLLECTION C — The Broadsheet');
{
	const en = index.items.filter(i => i.l === 'en');
	const months = [...new Set(en.map(i => i.d.slice(0, 7)))].sort();
	const latest = months[months.length - 1];
	const inLatest = en.filter(i => i.d.slice(0, 7) === latest);
	const longest = inLatest.slice().sort((a, b) => b.w - a.w)[0];
	const page = await open('articles-broadsheet.html');
	clean(page, 'broadsheet');
	ok('broadsheet: the masthead names the edition', (await page.textContent('[data-edition]')).includes('No. ' + months.length.toLocaleString('en-GB')));
	eq('broadsheet: the lead is the month\'s longest piece', (await page.textContent('.bs-lead .t')).trim(), longest.t);
	ok('broadsheet: the second tier is at most three', (await page.$$('.bs-tier article')).length <= 3);
	ok('broadsheet: the columns are ruled, not boxed',
		await page.$eval('.bs-columns', el => getComputedStyle(el).columnRuleStyle === 'solid'));
	eq('broadsheet: every month of the archive is a back issue',
		(await page.$$('.bs-month:not(:disabled)')).length, months.length);
	await page.click('[data-step="-1"]');
	await page.waitForTimeout(300);
	ok('broadsheet: ← opens the previous edition', (await page.textContent('[data-edition]')).includes('No. ' + (months.length - 1).toLocaleString('en-GB')));
	ok('broadsheet: the edition is in the URL', page.url().includes('m=' + months[months.length - 2]));
	await page.close();
}
{
	const page = await open('articles-broadsheet.html?m=2020-03');
	ok('broadsheet: an old edition can be opened directly', (await page.textContent('[data-edition]')).includes('March 2020'));
	ok('broadsheet: … and composes from that month only',
		await page.$eval('.bs-lead .bs-meta', el => el.textContent.includes('2020')));
	await page.close();
}

/* ================================================== the phone ========= */
console.log('\nNARROW (390px)');
for (const [name, path, sel] of [
	['leaf', 'article-leaf.html', '.leaf-prose'],
	['room', 'article-room.html', '.room-prose'],
	['threshold', 'article-threshold.html', '.th-prose'],
	['ledger', 'articles-ledger.html', '.lg-list'],
	['drift', 'articles-drift.html', '.dr-entries'],
	['broadsheet', 'articles-broadsheet.html', '.bs-columns'],
]) {
	const page = await open(path, { width: 390, height: 900 });
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	ok(`${name}: no horizontal scroll at 390px`, overflow <= 1, `${overflow}px`);
	ok(`${name}: its content is still there`, !!(await page.$(sel)));
	if (name === 'leaf') {
		/* stacked, the margin apparatus must not sit on the first line of the
		   article — the plate was touching the drop cap */
		const gap = await page.evaluate(() => {
			const plate = document.querySelector('.leaf-plate');
			const prose = document.querySelector('.leaf-prose');
			return Math.round(prose.getBoundingClientRect().top - plate.getBoundingClientRect().bottom);
		});
		ok('leaf: the plate keeps its distance from the text at 390px', gap >= 24, `${gap}px`);
	}
	await page.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
