/* shoot.mjs — screenshots of the video drafts, Firefox only.
 *
 *   cd projects/schiller-wp-rebuild && python3 articles/build/serve.py 8764
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules \
 *     node videos/build/shoot.mjs [draft…] [--v=webcast] [--port=8764] [--phone-only]
 *
 * Walks the page before the full-page capture so every scroll-revealed block
 * has arrived (an IntersectionObserver never fires for content never on screen).
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const port = opt('port') || '8764';
const recs = (opt('v') || 'webcast').split(',');
const names = args.filter(a => !a.startsWith('--'));
const DRAFTS = names.length ? names : ['programme', 'reading', 'echo', 'constellation', 'almanac'];
const sizes = [['desktop', { width: 1440, height: 1000 }], ['phone', { width: 390, height: 844 }]]
	.filter(([l]) => !(args.includes('--phone-only') && l === 'desktop') && !(args.includes('--desktop-only') && l === 'phone'));

const OUT = new URL('./out/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await firefox.launch();
const errs = [];
for (const d of DRAFTS) for (const v of recs) for (const [label, size] of sizes) {
	const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
	page.on('pageerror', e => errs.push(`${d}/${v}/${label}: ${e.message}`));
	page.on('console', m => m.type() === 'error' && !/ytimg|youtube|NS_BINDING/.test(m.text()) && errs.push(`${d}/${v}/${label}: ${m.text()}`));
	await page.goto(`http://127.0.0.1:${port}/videos/templates/video-${d}.html?v=${v}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
	await page.evaluate(async () => {
		const step = innerHeight * 0.8;
		for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); }
		scrollTo({ top: 0, behavior: 'instant' }); await new Promise(r => setTimeout(r, 300));
	});
	const file = `${OUT}${d}-${v}-${label}.png`;
	// very long pages (a 90-minute transcript on a phone) exceed what Firefox will
	// rasterise in one go; the top 12,000px is what a review needs
	const H = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.screenshot({ path: file, fullPage: true, ...(H > 12000 ? { clip: { x: 0, y: 0, width: size.width, height: 12000 } } : {}) });
	const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	console.log(`${d.padEnd(14)} ${v.padEnd(10)} ${label.padEnd(8)} overflow ${String(over).padStart(4)}px  ${file.split('/').pop()}`);
	if (label === 'phone' && over > 0) errs.push(`${d}/${v}: ${over}px of horizontal scroll at 390px`);
	await page.close();
}
await browser.close();
if (errs.length) { console.error('\nPROBLEMS\n' + errs.join('\n')); process.exit(1); }
console.log('\nno page errors');
