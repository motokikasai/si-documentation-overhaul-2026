// Block styles vs drafts: computed-style diff + screenshot. Dev only.
//   PW=/home/motoki/.npm/_npx/e41f203b7505f1fb/node_modules node wp-plugins/schiller-editorial/tools/compare.mjs
// Needs serve.py on 8761 (from projects/schiller-wp-rebuild/) and local-proxy.mjs on 8770.
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW + '/');
const { firefox } = require('playwright');

const URL = process.env.SI_URL || 'http://127.0.0.1:8761/wp-plugins/schiller-editorial/tools/compare.html';
const OUT = process.env.SI_SHOT || '/tmp/schiller-editorial-compare.png';

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.goto(URL);
await page.waitForFunction(() => ['draft', 'block'].every((id) =>
	document.getElementById(id).contentDocument?.readyState === 'complete'));
await page.waitForTimeout(500);

const { keys, diffs } = await page.evaluate(() => window.siCompare());
console.log(`compared: ${keys.join(', ')}`);
if (!diffs.length) console.log('no differences');
for (const d of diffs) console.log(`${d.k.padEnd(14)} ${d.p.padEnd(22)} draft=${d.draft}  block=${d.block}`);

// hover: the ghost button fills with the accent in both
const hover = {};
for (const id of ['draft', 'block']) {
	const f = page.frameLocator('#' + id);
	await f.locator('[data-k="ghost"]').hover();
	await page.waitForTimeout(300);
	hover[id] = await f.locator('[data-k="ghost"]').evaluate((el) => {
		const cs = getComputedStyle(el);
		return `${cs.backgroundColor} / ${cs.color}`;
	});
}
console.log(`ghost:hover    draft=${hover.draft}  block=${hover.block}  ${hover.draft === hover.block ? 'same' : 'DIFFERENT'}`);

await page.mouse.move(0, 0);
await page.waitForTimeout(600); // let the hover-out transition finish before the shot
await page.screenshot({ path: OUT, fullPage: true });
console.log('screenshot: ' + OUT);
await browser.close();
