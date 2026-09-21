/* peek.mjs — look closely at one part of one draft (a viewport-sized shot at a
 * given scroll position or selector), Firefox only.
 *
 *   PW=… node conferences/build/peek.mjs <draft> [--at=<css selector>]
 *        [--y=<px>] [--rec=2025-berlin] [--w=1440] [--h=900] [--state=upcoming]
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const draft = args.find(a => !a.startsWith('--')) || 'proceedings';
const rec = opt('rec', '2025-berlin');
const w = +opt('w', 1440), h = +opt('h', 900);
const state = opt('state') ? `&state=${opt('state')}` : '';
const OUT = new URL('./out/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => m.type() === 'error' && console.error('console:', m.text()));
await page.goto(`http://127.0.0.1:${opt('port', '8763')}/conferences/templates/conference-${draft}.html?c=${rec}${state}`,
	{ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.evaluate(async () => {
	const step = innerHeight * 0.8;
	for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
	scrollTo(0, 0); await new Promise(r => setTimeout(r, 200));
});
const at = opt('at'), y = opt('y');
if (at) await page.evaluate(sel => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), at);
else if (y) await page.evaluate(v => scrollTo(0, +v), y);
await page.waitForTimeout(450);
const name = `peek-${draft}-${rec}${state ? "-upcoming" : ""}${at ? '-' + at.replace(/[^a-z0-9]+/gi, '') : y ? '-y' + y : ''}.png`;
await page.screenshot({ path: OUT + name });
console.log(OUT + name);
await browser.close();
