/* shoot-wp.mjs — the video kit running inside WordPress on si-v4.
 *   node articles/build/local-proxy.mjs si-v4.local 8770 &
 *   PW=<playwright node_modules> node videos/build/shoot-wp.mjs
 * Firefox cannot send a Host header of its own and /etc/hosts needs root, so the
 * pages are reached through the proxy.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');
const BASE = process.env.SI_BASE || 'http://127.0.0.1:8770';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SHOTS = process.argv.slice(2).length
	? process.argv.slice(2).map((p, i) => [`wp-video-${i}`, p, 1440, 1400])
	: [
		['wp-video', '/videos/live-dialogue-with-helga-zepp-larouche-the-magnificent-humanity-at-the-crossroads/', 1440, 1400],
		['wp-video-phone', '/videos/live-dialogue-with-helga-zepp-larouche-the-magnificent-humanity-at-the-crossroads/', 390, 1100],
	];

const browser = await firefox.launch();
let bad = 0;
for (const [name, path, w, h] of SHOTS) {
	const page = await browser.newPage({ viewport: { width: w, height: h } });
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => { if (m.type() === 'error' && !/ytimg|youtube|NS_BINDING/.test(m.text())) errors.push(m.text()); });
	const res = await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForTimeout(700);
	await page.evaluate(async () => {
		for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); }
		scrollTo({ top: 0, behavior: 'instant' }); await new Promise(r => setTimeout(r, 250));
	});
	const H = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true, ...(H > 12000 ? { clip: { x: 0, y: 0, width: w, height: 12000 } } : {}) });
	const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	console.log(`${name.padEnd(16)} ${res.status()}  overflow ${String(over).padStart(4)}px  ${errors.length ? 'ERRORS: ' + errors.join(' | ') : 'clean'}`);
	if (errors.length || (w === 390 && over > 0) || res.status() !== 200) bad++;
	await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
