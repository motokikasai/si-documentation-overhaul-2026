/* shoot-wp.mjs — screenshots of the kit running inside WordPress on si-v4.
 *   node build/local-proxy.mjs si-v4.local 8770 &
 *   PW=<playwright node_modules> node build/shoot-wp.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

/* Firefox cannot send a Host header of its own, and /etc/hosts needs root, so
   the pages are reached through build/local-proxy.mjs:
     node build/local-proxy.mjs si-v4.local 8770 */
const BASE = process.env.SI_BASE || 'http://127.0.0.1:8770';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const SHOTS = [
	['wp-leaf', '/blog/2019/09/13/the-necessity-of-redefining-sustainable-development-as-sustained-development/', 1440, 1300],
	['wp-leaf-phone', '/blog/2019/09/13/the-necessity-of-redefining-sustainable-development-as-sustained-development/', 390, 1100],
	['wp-ledger', '/blog/', 1440, 1300],
	['wp-ledger-de', '/de/blog/', 1440, 1300],
];

const browser = await firefox.launch();
for (const [name, path, w, h] of SHOTS) {
	const page = await browser.newPage({ viewport: { width: w, height: h } });
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
	const res = await page.goto(BASE + path, { waitUntil: 'load' }).catch(e => ({ status: () => String(e) }));
	await page.waitForTimeout(1200);
	await page.screenshot({ path: OUT + name + '.png' });
	console.log(`${errors.length ? '✗' : '✓'} ${name} — HTTP ${res.status?.()}${errors.length ? '\n   ' + errors.slice(0, 3).join('\n   ') : ''}`);
	await page.close();
}
await browser.close();
