/* hover-settle.mjs — "does anything move after a hover?", in CHROMIUM.
 *
 * The Atrium's sub-nav and its video thumbnails once shifted by a pixel as a
 * hover wore off: Chrome re-rasterises a demoted layer on a differently
 * rounded pixel. This checks the settled state against the untouched state,
 * pixel for pixel, at 100 %, 125 % and 150 % device scaling.
 *
 * Chromium needs libnspr4/libnss3, which this box lacks system-wide:
 *   apt-get download libnspr4 libnss3 && for f in *.deb; do dpkg-deb -x $f nss; done
 *   LD_LIBRARY_PATH=$PWD/nss/usr/lib/x86_64-linux-gnu \
 *   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node conferences/build/hover-settle.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { chromium } = require('playwright');

const URL_ = 'http://127.0.0.1:8763/conferences/templates/conference-atrium.html?c=2025-berlin';
const TARGETS = [
	['sub-nav link', '.at-doors a[href="#watch"]', null],
	['clip thumbnail', '#watch .si-conf-embed', '#watch'],
	['speaker card', 'a.at-voice', '#voices'],
];
const browser = await chromium.launch();
let bad = 0;
for (const dsf of [1, 1.25, 1.5]) {
	for (const [name, sel, section] of TARGETS) {
		const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
		await p.goto(URL_, { waitUntil: 'networkidle' });
		await p.evaluate(s => {
			if (s) document.querySelector(s).scrollIntoView({ behavior: 'instant' });
			document.querySelectorAll('.si-reveal').forEach(e => e.classList.add('is-in'));
		}, section);
		await p.waitForTimeout(1200);
		const bb = await p.locator(sel).first().boundingBox();
		const clip = { x: Math.floor(bb.x) - 2, y: Math.floor(bb.y) - 2, width: Math.ceil(bb.width) + 4, height: Math.ceil(bb.height) + 4 };
		await p.mouse.move(2, 2); await p.waitForTimeout(300);
		const before = await p.screenshot({ clip });
		await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(900);
		await p.mouse.move(2, 2); await p.waitForTimeout(1500);
		const after = await p.screenshot({ clip });
		/* Compare in the page itself: a strict buffer equality also trips on a
		   single re-blended antialiased pixel, which is not movement. Count
		   pixels that differ by more than a hair, and where they are. */
		const d = await p.evaluate(async ([a, b]) => {
			const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
			const [ia, ib] = await Promise.all([load(a), load(b)]);
			const c = new OffscreenCanvas(ia.width, ia.height), x = c.getContext('2d', { willReadFrequently: true });
			x.drawImage(ia, 0, 0); const A = x.getImageData(0, 0, c.width, c.height).data;
			x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0);
			const B = x.getImageData(0, 0, c.width, c.height).data;
			let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
			for (let i = 0; i < A.length; i += 4) {
				const dd = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
				if (dd > max) max = dd;
				if (dd > 12) {
					n++;
					const px = (i / 4) % c.width, py = Math.floor((i / 4) / c.width);
					x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
				}
			}
			return { n, max, box: x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1], w: c.width, h: c.height };
		}, ['data:image/png;base64,' + before.toString('base64'), 'data:image/png;base64,' + after.toString('base64')]);
		/* one stray pixel is antialiasing; a shift moves an edge, which is
		   hundreds of pixels in a line */
		const same = d.n <= 8;
		if (!same) bad++;
		console.log(`${same ? 'ok  ' : 'FAIL'} ${name.padEnd(15)} @${dsf}x — settles where it started`
			+ (d.n ? `  (${d.n}px differ, max Δ${d.max}, box ${JSON.stringify(d.box)} of ${d.w}×${d.h})` : ''));
		await p.close();
	}
}
await browser.close();
process.exit(bad ? 1 : 0);
