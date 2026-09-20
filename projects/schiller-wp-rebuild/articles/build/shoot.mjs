/* shoot.mjs — screenshots of the drafts, Firefox (chromium needs a system
 * libnspr4 this box does not have). Usage:
 *   PW=<playwright node_modules> node build/shoot.mjs [name…]
 * Serve the repo first:  python3 -m http.server 8761  (in schiller-wp-rebuild/)
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8761/articles/templates/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SHOTS = [
	['leaf',             'article-leaf.html',        { w: 1440, h: 1200 }],
	['leaf-short',       'article-leaf.html?p=115296', { w: 1440, h: 1100 }],
	['leaf-caption',     'article-leaf.html?p=82526',  { w: 1440, h: 1100 }],
	['leaf-notes',       'article-leaf.html',        { w: 1440, h: 1100, evaluate: 'notes' }],
	['leaf-phone',       'article-leaf.html',        { w: 390, h: 1100 }],
	['room',             'article-room.html',        { w: 1440, h: 1200 }],
	['room-night',       'article-room.html?p=55739', { w: 1440, h: 1200, night: true }],
	['room-phone',       'article-room.html',        { w: 390, h: 1100 }],
	['threshold',        'article-threshold.html',   { w: 1440, h: 1200 }],
	['threshold-read',   'article-threshold.html',   { w: 1440, h: 1200, scroll: 1100 }],
	['threshold-phone',  'article-threshold.html',   { w: 390, h: 1100 }],
	['ledger',           'articles-ledger.html',     { w: 1440, h: 1200 }],
	['ledger-loupe',     'articles-ledger.html',     { w: 1440, h: 1200, hover: '.lg-row:nth-child(4) a' }],
	['ledger-phone',     'articles-ledger.html',     { w: 390, h: 1100 }],
	['drift',            'articles-drift.html',      { w: 1440, h: 1200 }],
	['drift-scroll',     'articles-drift.html',      { w: 1440, h: 1200, scroll: 1800 }],
	['drift-phone',      'articles-drift.html',      { w: 390, h: 1100 }],
	['broadsheet',       'articles-broadsheet.html', { w: 1440, h: 1400 }],
	['broadsheet-foot',  'articles-broadsheet.html', { w: 1440, h: 1400, scroll: 1500 }],
	['broadsheet-old',   'articles-broadsheet.html?m=2020-03', { w: 1440, h: 1400 }],
	['broadsheet-phone', 'articles-broadsheet.html', { w: 390, h: 1200 }],
];

const wanted = process.argv.slice(2);
const list = wanted.length ? SHOTS.filter(s => wanted.some(w => s[0].startsWith(w))) : SHOTS;

const browser = await firefox.launch();
let fails = 0;
for (const [name, path, o] of list) {
	const page = await browser.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1 });
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
	await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForSelector('main:not([aria-busy])', { timeout: 15000 }).catch(() => {});
	if (o.night) await page.evaluate(() => document.querySelector('[data-set="ground"][data-value="night"]')?.click());
	if (o.scroll) { await page.evaluate(y => scrollTo(0, y), o.scroll); await page.waitForTimeout(900); }
	if (o.hover) { await page.hover(o.hover); await page.waitForTimeout(700); }
	if (o.evaluate === 'notes') {
		await page.click('.si-fn a');
		await page.waitForTimeout(1200);
	}
	await page.waitForTimeout(o.wait ?? 900);
	await page.screenshot({ path: OUT + name + '.png' });
	if (errors.length) { fails++; console.log(`✗ ${name}\n   ${errors.slice(0, 4).join('\n   ')}`); }
	else console.log(`✓ ${name}`);
	await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
