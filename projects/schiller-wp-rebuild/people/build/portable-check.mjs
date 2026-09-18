// Opens people/portable/*.html from file:// (no server) and checks: renders, no network
// request at all, every visible portrait loaded after a scroll-through, fonts embedded,
// play still loads the video, the switcher strip moves between files and people.
//   PW=~/.npm/_npx/<hash>/node_modules node people/build/portable-check.mjs
//   (add LD_LIBRARY_PATH=<unpacked libnspr4/libnss3> to run Chromium as well)
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW + '/x.js');
const { firefox, chromium } = require('playwright');
const DIR = new URL('../portable/', import.meta.url).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const [bname, btype, opts] of [['firefox', firefox, {}], ['chromium', chromium, process.env.LD_LIBRARY_PATH ? {} : null]]) {
  if (!opts) { console.log('skip chromium (no libnspr4 path)'); continue; }
  const browser = await btype.launch(opts);
  for (const f of ['index', 'person-portrait', 'person-listening']) for (const k of ['richard-black', 'jason-ross', 'haidar-al-fuadi-al-atabe']) {
    if (f === 'index' && k !== 'richard-black') continue;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [], net = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    page.on('request', r => { if (!/^(file|data):/.test(r.url())) net.push(r.url()); });
    await page.goto(`${DIR}${f}.html?p=${k}`); await page.waitForTimeout(1200);
    // scroll the whole page so lazy portraits get their turn
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(120); }
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
      busy: document.querySelector('main')?.getAttribute('aria-busy'),
      h1: document.querySelector('h1')?.textContent.trim(),
      imgs: [...document.images].filter(i => i.offsetParent !== null).map(i => i.complete && i.naturalWidth > 0),
      font: document.fonts.check('16px "Source Serif 4"'),
    }));
    ok(!errs.length && !net.length && r.busy === null && r.imgs.every(Boolean) && r.font,
      `${bname} ${f} ${k}: h1="${r.h1}" imgs=${r.imgs.length} font=${r.font} net=${net.length} ${errs.join(' | ')}`);
    if (f === 'person-listening' && k === 'richard-black') {
      await page.click('[data-moment="q-trade"]'); await page.waitForTimeout(300);
      ok(/youtube-nocookie.*JD3d_guFUV4/.test(await page.getAttribute('[data-player] iframe', 'src') || ''), `${bname}: pressing play still loads the video`);
    }
    if (f === 'person-portrait' && k === 'richard-black') {
      await page.click('.pf-strip a:has-text("Ross")'); await page.waitForTimeout(1200);
      ok((await page.textContent('h1')).includes('Jason Ross'), `${bname}: switcher strip navigates between people`);
    }

    await page.close();
  }
  await browser.close();
}
console.log(fails ? `${fails} FAILED` : 'all passed');
