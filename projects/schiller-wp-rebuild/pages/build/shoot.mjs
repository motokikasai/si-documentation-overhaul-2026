/* shoot.mjs — screenshots of the page drafts, Firefox only (see CLAUDE.md).
 *   PW=<playwright node_modules> node pages/build/shoot.mjs <spec>…
 * spec = "file.html?query@WIDTHxHEIGHT[+scrollY][!full]" e.g. "page-folio.html?p=45811@1440x1000+900"
 * Prints every page error / console error; exits 1 if any page threw.
 * Serve first:  python3 articles/build/serve.py 8761   (in schiller-wp-rebuild/)
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(process.env.PW + '/');
const { firefox } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8761/pages/templates/';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await firefox.launch();
let fails = 0;
for (const spec of process.argv.slice(2)) {
	const m = spec.match(/^(.*?)@(\d+)x(\d+)(?:\+(\d+))?(!full)?$/);
	if (!m) { console.log('bad spec', spec); continue; }
	const [, path, w, h, sy, full] = m;
	const page = await browser.newPage({ viewport: { width: +w, height: +h } });
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', c => { if (c.type() === 'error' && !/NS_BINDING_ABORTED|downloadable font|Failed to load resource|Cookie “/.test(c.text())) errors.push(c.text()); });
	await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForSelector('main:not([aria-busy])', { timeout: 15000 }).catch(() => errors.push('main still busy'));
	await page.evaluate(() => document.querySelectorAll('.si-reveal').forEach(e => e.classList.add('is-in')));
	if (sy) await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), +sy);
	await page.waitForTimeout(900);
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	const name = path.replace(/\.html.*$/, '') + (path.includes('?') ? '-' + path.split('?')[1].replace(/[^a-z0-9]+/gi, '') : '') + `-${w}` + (sy ? `-s${sy}` : '') + (full ? '-full' : '');
	await page.screenshot({ path: OUT + name + '.png', fullPage: !!full });
	console.log(`${errors.length ? 'ERR ' : 'ok  '} ${name}${overflow > 1 ? `  (h-overflow ${overflow}px)` : ''}${errors.length ? '\n     ' + errors.join('\n     ') : ''}`);
	if (errors.length) fails++;
	await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
