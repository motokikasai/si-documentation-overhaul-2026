// Headless-Firefox behaviour checks for the single-person drafts (person-*.html):
// two-click video consent, quote timestamps, filters, transcript, orbit, and
// errors/overflow for every draft x person x width (1440, 390).
//   python3 -m http.server 8760 --directory projects/schiller-wp-rebuild   (serve the PARENT)
//   PW=~/.npm/_npx/<hash>/node_modules node people/build/profile-interact.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW + '/x.js');
const { firefox } = require('playwright');
const PAYLOAD = JSON.parse(require('node:fs').readFileSync(new URL('../data/profiles.json', import.meta.url), 'utf8'));
const B = process.env.BASE || 'http://localhost:8760/people/templates/';
const browser = await firefox.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const open = async (f, w = 1440) => {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const yt = []; page.on('request', r => { if (/youtube|ytimg|google/.test(r.url())) yt.push(r.url()); });
  await page.goto(B + f, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
  return { page, errs, yt };
};
// A
{ const { page, errs, yt } = await open('person-portrait.html?p=richard-black');
  ok(yt.length === 0, 'A: nothing requested from YouTube/Google on load');
  await page.click('.pa-own-words'); await page.waitForTimeout(300);
  ok(await page.isVisible('.pf-modal .pf-player__play'), 'A: own-words opens modal with two-click facade');
  ok(yt.length === 0, 'A: still nothing from YouTube before consent');
  await page.click('.pf-modal .pf-player__play'); await page.waitForTimeout(300);
  const src = await page.getAttribute('.pf-modal iframe', 'src');
  ok(/youtube-nocookie\.com\/embed\/JD3d_guFUV4\?start=40[23]\d/.test(src || ''), 'A: consent loads nocookie embed at the quote second: ' + (src || '').slice(0, 70));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(!(await page.isVisible('.pf-modal')), 'A: Escape closes the player');
  const before = await page.locator('.pa-rec:not([hidden])').count();
  await page.click('[data-more]'); ok((await page.locator('.pa-rec:not([hidden])').count()) > before, `A: show all recordings (${before} → ${await page.locator('.pa-rec:not([hidden])').count()})`);
  await page.selectOption('[data-conf-filter]', '2016-york-september-2016-memorial'); await page.waitForTimeout(100);
  const names = await page.locator('.pa-person:not([hidden]) .si-name').allTextContents();
  ok(names.includes('Ramsey Clark') && names.length <= 4, 'A: conference filter narrows company: ' + names.join(', '));
  await page.click('[data-step="1"]'); ok(await page.isVisible('#q-q-clark'), 'A: next quote');
  // lazy portraits load once scrolled into view
  await page.selectOption('[data-conf-filter]', ''); await page.locator('#company').scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
  const loaded = await page.evaluate(() => [...document.querySelectorAll('#company .si-medallion__img')].filter(i => i.getBoundingClientRect().top < innerHeight && i.getBoundingClientRect().bottom > 0).map(i => i.complete && i.naturalWidth > 0));
  ok(loaded.length > 0 && loaded.every(Boolean), `A: company portraits in view are loaded (${loaded.length})`);
  await 
  ok(errs.length === 0, 'A: no errors ' + errs.join(' | '));
  await page.close(); }
// B
{ const { page, errs, yt } = await open('person-listening.html?p=richard-black');
  ok(yt.length === 0, 'B: nothing from YouTube on load');
  ok(await page.isVisible('[data-pane="transcript"] [data-t]'), 'B: transcript shown for featured talk');
  await page.fill('[data-find]', 'pentagon'); await page.waitForTimeout(200);
  ok((await page.locator('.pb-lines mark').count()) >= 1, 'B: transcript search marks "pentagon": ' + await page.textContent('[data-find-count]'));
  await page.click('[data-tab="room"]'); ok(await page.isVisible('.pb-room li'), `B: in-the-room tab lists ${await page.locator('.pb-room li').count()} people`);
  await page.click('[data-track="0FNtEWfay_8-0"] [data-play]'); await page.waitForTimeout(700);
  const src = await page.getAttribute('[data-player] iframe', 'src').catch(() => null);
  ok(/0FNtEWfay_8/.test(src || ''), 'B: playing another talk loads it in the stage');
  const room = await page.locator('.pb-room b').allTextContents();
  ok(room.includes('Ramsey Clark'), 'B: in-the-room follows the talk (9/11 conf → Ramsey Clark): ' + room.join(', '));
  ok(await page.locator('[data-track="0FNtEWfay_8-0"].is-current').count() === 1, 'B: reel marks current talk');
  await page.click('[data-moment="q-trade"]'); await page.waitForTimeout(500);
  const src2 = await page.getAttribute('[data-player] iframe', 'src');
  ok(/JD3d_guFUV4\?start=43/.test(src2), 'B: moment jumps to its second in its own talk: ' + src2.slice(0, 70));
  ok(await page.getAttribute('[data-tab="transcript"]', 'aria-selected') === 'true', 'B: transcript tab returns for the featured talk');
  ok(errs.length === 0, 'B: no errors ' + errs.join(' | '));
  await page.close(); }
// every page × person × width: errors and overflow
for (const f of ['person-portrait', 'person-listening']) for (const k of ['richard-black', 'jason-ross', 'haidar-al-fuadi-al-atabe', 'metin-apti', 'maurizio-abbate', 'john-scales-avery']) for (const w of [1440, 390]) {
  const { page, errs } = await open(`${f}.html?p=${k}`, w);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  // thin records: no zero figure, no "null"/"undefined"/"NaN", no empty section heading
  const junk = await page.evaluate(() => {
    const txt = document.querySelector('main').innerText;
    const bad = [...txt.matchAll(/\b(null|undefined|NaN)\b/g)].map(m => m[0]);
    const zeros = [...document.querySelectorAll('.si-figure dd')].filter(d => d.textContent.trim() === '0').length;
    return { bad, zeros };
  });
  ok(!errs.length && over <= 0 && !junk.bad.length && !junk.zeros, `${f} ${k} ${w}: errors=${errs.length} overflow=${over} junk=${junk.bad.join(',')} zero-figures=${junk.zeros} ${errs.join(' | ')}`);
  await page.close();
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'all passed');
