// Headless-Firefox check of the /people/ drafts: console errors, failed requests,
// layout overflow, and screenshots at several scroll depths and two widths.
//   python3 -m http.server 8760 --directory projects/schiller-wp-rebuild   (serve the PARENT)
//   PW=~/.npm/_npx/<hash>/node_modules node people/build/shoot.mjs [page ...] [--out dir]
// Chromium does not launch on this box (missing libnspr4) — Firefox only.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.PW || '.', 'x.js'));
const { firefox } = require('playwright');

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : '/tmp';
const pages = args.length ? args : ['people-register', 'people-medallions', 'people-chronicle'];
const base = process.env.BASE || 'http://localhost:8760/people/templates/';

const browser = await firefox.launch();
let failures = 0;
for (const name of pages) {
  for (const [label, viewport] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const problems = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
    const url = name.includes('/') || name.endsWith('.html') ? new URL(name, base).href : `${base}${name}.html`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) problems.push(`horizontal overflow: ${overflow}px`);
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    const depths = label === 'desk' ? [0, 0.12, 0.45] : [0, 0.1];
    for (const d of depths) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(H * d));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${path.basename(name, '.html')}-${label}-${Math.round(d * 100)}.png` });
    }
    console.log(`${name} [${label}] height=${H} ${problems.length ? '\n  ' + problems.join('\n  ') : 'clean'}`);
    failures += problems.length;
    await page.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
