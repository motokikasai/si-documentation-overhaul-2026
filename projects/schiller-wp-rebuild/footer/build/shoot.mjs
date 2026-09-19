// Headless check of the three footer drafts: console errors, failed requests,
// horizontal overflow, unloaded portraits, and screenshots of the footer itself.
//
//   python3 -m http.server 8763 --directory projects/schiller-wp-rebuild   (serve the PARENT)
//   PW=<node_modules with playwright> node footer/build/shoot.mjs [--out dir] [--engine chromium|webkit]
//
// Both engines by default. WebKit is not optional here: the drafts use
// `mask-image`, `aspect-ratio`, `:has()` and `color-mix()`, and Safari is where
// this project has been burned before.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.join(process.env.PW || '.', 'x.js'));
const playwright = require('playwright');

const args = process.argv.slice(2);
const take = flag => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : null; };
const out = take('--out') || '/tmp';
const only = take('--engine');
const engines = only ? [only] : ['chromium', 'webkit'];
const pages = args.length ? args : ['footer-colonnade', 'footer-ledger', 'footer-envoi',
                                   'footer-rotunda', 'footer-cabinet', 'footer-quiet'];
const base = process.env.BASE || 'http://localhost:8763/footer/';

fs.mkdirSync(out, { recursive: true });
let failures = 0;

for (const engine of engines) {
	const browser = await playwright[engine].launch();
	for (const name of pages) {
		for (const [label, viewport] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
			const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
			const problems = [];
			page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
			page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
			page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
			page.on('response', r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });

			await page.goto(`${base}${name}.html#si-footer`, { waitUntil: 'networkidle' });
			await page.waitForTimeout(600);
			// Prototype chrome, hidden for the picture only: the draft strip sits over
			// the footer in a full-element shot, and the sticky header paints over the
			// footer's first line when Playwright clips the element's box. Neither
			// happens to a reader, who arrives at the footer by scrolling.
			await page.addStyleTag({ content:
				'.draft-strip{display:none!important}' +
				'.ct-header{position:static!important}' +
				// the footer ends at the document end, and a stitched element capture
				// runs past it into the canvas — give the page somewhere to scroll
				'body{padding-bottom:100vh}' });

			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
			if (overflow > 0) problems.push(`horizontal overflow: ${overflow}px`);

			// Every portrait that is ON SCREEN has actually decoded — a wrong relative
			// path still renders as a tidy empty circle, which is easy to miss by eye.
			// Off-screen `loading="lazy"` medallions (the portico scrolls sideways on a
			// phone) are SUPPOSED to be unfetched, so intersecting the viewport is the
			// condition, not `complete`.
			const broken = await page.evaluate(() => {
				const seen = i => {
					// A seat the carousel has turned away is `visibility: hidden` but
					// still has a bounding box, and being lazy it is never fetched —
					// correctly. Rect alone is not visibility.
					const shown = i.checkVisibility
						? i.checkVisibility({ visibilityProperty: true, opacityProperty: true })
						: getComputedStyle(i).visibility !== 'hidden';
					if (!shown) return false;
					const r = i.getBoundingClientRect();
					return r.width > 0 && r.right > 0 && r.left < innerWidth
						&& r.bottom > 0 && r.top < innerHeight;
				};
				return [...document.querySelectorAll('#si-footer img')]
					.filter(i => seen(i) && (!i.complete || !i.naturalWidth))
					.map(i => i.getAttribute('src'));
			});
			if (broken.length) problems.push(`portraits not loaded: ${broken.join(', ')}`);

			const foot = page.locator('#si-footer');
			const box = await foot.boundingBox();
			await foot.screenshot({ path: `${out}/${name}-${engine}-${label}.png` });
			if (label === 'desk') await page.screenshot({ path: `${out}/${name}-${engine}-page.png`, fullPage: true });

			console.log(`${name} [${engine}/${label}] footer=${Math.round(box.height)}px  ${problems.length ? '\n  ' + problems.join('\n  ') : 'clean'}`);
			failures += problems.length;
			await page.close();
		}
	}
	await browser.close();
}
process.exit(failures ? 1 : 0);
