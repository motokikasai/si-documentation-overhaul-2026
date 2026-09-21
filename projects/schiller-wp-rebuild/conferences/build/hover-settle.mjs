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
		const same = before.equals(after);
		if (!same) bad++;
		console.log(`${same ? 'ok  ' : 'FAIL'} ${name.padEnd(15)} @${dsf}x — settles where it started`);
		await p.close();
	}
}
await browser.close();
process.exit(bad ? 1 : 0);
