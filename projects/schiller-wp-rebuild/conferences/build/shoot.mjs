/* shoot.mjs — screenshots of the conference drafts, Firefox only.
 *
 *   cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8763
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules \
 *     node conferences/build/shoot.mjs [draft…] [--rec=2025-berlin] [--port=8763]
 *
 * Chromium's headless shell needs a system libnspr4 this box does not have;
 * Firefox is the browser every prototype in this repo is verified in.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const port = opt('port') || '8763';
const rec = opt('rec') || '2025-berlin';
const state = opt('state') ? `&state=${opt('state')}` : '';
const names = args.filter(a => !a.startsWith('--'));
const DRAFTS = names.length ? names
	: ['proceedings', 'marquee', 'rostrum', 'thread', 'atrium'];

const OUT = new URL('./out/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await firefox.launch();
const errs = [];
for (const d of DRAFTS) {
	for (const [label, size] of [['desktop', { width: 1440, height: 1000 }],
		['phone', { width: 390, height: 844 }]]) {
		const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
		page.on('pageerror', e => errs.push(`${d}/${label}: ${e.message}`));
		page.on('console', m => m.type() === 'error' && errs.push(`${d}/${label}: ${m.text()}`));
		const url = `http://127.0.0.1:${port}/conferences/templates/conference-${d}.html?c=${rec}${state}`;
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);
		// walk the page so every scroll-revealed block has arrived before the
		// full-page capture (an IntersectionObserver never fires for content
		// that was never on screen).
		await page.evaluate(async () => {
			const step = innerHeight * 0.8;
			for (let y = 0; y < document.body.scrollHeight; y += step) {
				scrollTo(0, y);
				await new Promise(r => setTimeout(r, 60));
			}
			scrollTo(0, 0);
			await new Promise(r => setTimeout(r, 260));
		});
		await page.waitForTimeout(400);
		const file = `${OUT}${d}-${rec}${state ? '-upcoming' : ''}-${label}.png`;
		await page.screenshot({ path: file, fullPage: label === 'desktop' });
		// how wide does the page actually get? (phone: must be 0)
		const over = await page.evaluate(() =>
			document.documentElement.scrollWidth - document.documentElement.clientWidth);
		console.log(`${d.padEnd(12)} ${label.padEnd(8)} overflow ${String(over).padStart(4)}px  ${file.split('/').pop()}`);
		if (label === 'phone' && over > 0) errs.push(`${d}: ${over}px of horizontal scroll at 390px`);
		await page.close();
	}
}
await browser.close();
if (errs.length) { console.error('\nPROBLEMS\n' + errs.join('\n')); process.exit(1); }
console.log('\nno page errors');
