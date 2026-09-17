// Interaction checks for the three /people/ drafts (headless Firefox).
//   PW=~/.npm/_npx/<hash>/node_modules node people/build/interact.mjs [--out dir]
// Asserts behaviour, not pixels; saves a few state screenshots for review.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.PW || '.', 'x.js'));
const { firefox } = require('playwright');

const outAt = process.argv.indexOf('--out');
const out = outAt > 0 ? process.argv[outAt + 1] : '/tmp';
const base = process.env.BASE || 'http://localhost:8760/people/templates/';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await firefox.launch();
const open = async (file, viewport = { width: 1440, height: 900 }) => {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + file, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return { page, errors };
};
const settle = p => p.waitForTimeout(450);

/* ---- A · Register --------------------------------------------------------- */
{
  const { page, errors } = await open('people-register.html');
  check('A renders every person', await page.locator('.reg-row').count() === 418);
  await page.keyboard.press('/');
  check('A "/" focuses search', await page.evaluate(() => document.activeElement?.matches('[data-q]')));
  await page.keyboard.type('zepp');
  await settle(page);
  const rows = await page.locator('.reg-row').count();
  check('A search narrows', rows >= 1 && rows < 5, `${rows} rows`);
  check('A search highlights', await page.locator('.reg-row mark').count() > 0);
  check('A search is in the URL', page.url().includes('q=zepp'));
  await page.keyboard.press('Escape');
  await settle(page);
  check('A Escape clears search', await page.locator('.reg-row').count() === 418);
  await page.keyboard.type('qqqxxx');
  await settle(page);
  check('A empty state', await page.locator('.si-empty').isVisible());
  await page.click('[data-reset]');
  await page.click('[data-sort="heard"]');
  await settle(page);
  const first = await page.locator('.reg-row .reg-surname').first().textContent();
  check('A "Most heard" ranks Zepp-LaRouche first', /Zepp/.test(first), first);
  check('A alphabet hidden when ranked', await page.locator('[data-alpha]').isHidden());
  await page.screenshot({ path: `${out}/i-register-ranked.png` });
  await page.click('[data-sort="az"]');
  await settle(page);
  await page.click('.reg-alpha a:has-text("M")');
  await page.waitForTimeout(1200);
  check('A letter jump + scroll-spy', await page.locator('.reg-alpha a[aria-current="true"]').textContent() === 'M');
  const row = page.locator('.reg-row a').filter({ has: page.locator('.reg-surname', { hasText: 'Askary' }) }).first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await page.mouse.move(400, 500);
  await row.hover({ position: { x: 60, y: 10 } });
  await page.waitForTimeout(500);
  check('A loupe shows a portrait on hover', await page.locator('[data-loupe].is-on img').count() === 1);
  await page.screenshot({ path: `${out}/i-register-loupe.png` });
  await row.click();
  await page.waitForTimeout(700);
  check('A profile sheet opens', await page.locator('dialog.si-sheet[open]').isVisible());
  check('A sheet names the person', /Askary/.test(await page.locator('#si-sheet-title').textContent()));
  await page.screenshot({ path: `${out}/i-register-sheet.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('A sheet closes on Escape, focus returns', await page.evaluate(() => !document.querySelector('dialog[open]') && document.activeElement?.matches('a[data-person]')));
  check('A no console errors', !errors.length, errors.join(' | '));
  await page.close();
}

/* ---- B · Gallery ---------------------------------------------------------- */
{
  const { page, errors } = await open('people-medallions.html');
  check('B principal plates', await page.locator('.gal-plate').count() === 12);
  const initial = await page.locator('.gal-card:not(.gal-card--ghost)').count();
  check('B first page is paged, not all 418', initial >= 48 && initial < 418, `${initial}`);
  await page.click('[data-show="portrait"]');
  await page.waitForTimeout(800);
  check('B "With portrait" filter', await page.locator('[data-count]').textContent() === '132 of 418');
  check('B filter in URL', page.url().includes('show=portrait'));
  await page.click('[data-show="all"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(900);
  const after = await page.locator('.gal-card:not(.gal-card--ghost)').count();
  check('B scrolling loads the next page', after > initial, `${initial} -> ${after}`);
  // direct click: scrolling to the button keeps triggering infinite scroll, which moves it
  await page.locator('[data-show-all]').evaluate(el => el.click());
  await page.waitForTimeout(600);
  check('B "Show everyone" renders all', await page.locator('.gal-card:not(.gal-card--ghost)').count() === 418);
  await page.click('.gal-toolbar .si-select__button >> nth=0');
  await page.click('.si-select__list:not([hidden]) li:has-text("Germany")');
  await page.waitForTimeout(800);
  const de = await page.locator('.gal-card:not(.gal-card--ghost)').count();
  check('B country filter', de > 3 && de < 20, `${de}`);
  await page.evaluate(() => scrollTo({ top: document.querySelector('#company').offsetTop - 60, behavior: 'instant' }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/i-gallery-germany.png` });
  await page.locator('.gal-card a').first().click();
  await page.waitForTimeout(700);
  check('B sheet opens from a card', await page.locator('dialog.si-sheet[open]').isVisible());
  await page.click('.si-sheet__close');
  await page.waitForTimeout(300);
  await page.locator('.gal-plates').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.click('[data-dir="1"]');
  await page.waitForTimeout(900);
  check('B plates scroll with the arrows', await page.locator('.gal-plates').evaluate(el => el.scrollLeft > 100));
  check('B no console errors', !errors.length, errors.join(' | '));
  await page.close();
}

/* ---- C · Chronicle ---------------------------------------------------------- */
{
  const { page, errors } = await open('people-chronicle.html');
  check('C one section per dated year', await page.locator('.chr-year').count() === 14);
  check('C first section is the newest year', await page.locator('.chr-year').first().getAttribute('id') === 'y-2025');
  check('C undated remainder listed', await page.locator('[data-undated] a').count() === 131);
  await page.click('.chr-hist__bar[data-year="2016"]');
  await page.waitForTimeout(1400);
  check('C histogram jumps to its year', await page.locator('.chr-dial a[aria-current="true"]').textContent() === '2016');
  await page.screenshot({ path: `${out}/i-chronicle-2016.png` });
  await page.click('[data-order="asc"]');
  await page.waitForTimeout(400);
  check('C oldest-first order', await page.locator('.chr-year').first().getAttribute('id') === 'y-2012');
  await page.fill('[data-q]', 'beethoven');
  await page.waitForTimeout(600);
  const years = await page.locator('.chr-year').count();
  check('C searching a conference title keeps its whole roster', years === 1 && await page.locator('.chr-people li').count() >= 9, `${years} years`);
  check('C dial marks empty years', await page.locator('.chr-dial a.is-empty').count() === 13);
  check('C no console errors', !errors.length, errors.join(' | '));
  await page.close();
}

/* ---- the WordPress render (build/render-test.php output) --------------------
   The shipped PHP partials + inline payload: the JS must take over the server's
   no-JS list, use permalinks and absolute image URLs. */
for (const [view, sel] of [['register', '.reg-row a[data-person]'], ['gallery', '.gal-card a'], ['chronicle', '.chr-people a']]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(new URL(`../build/out/wp-${view}.html`, base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const enhanced = await page.locator(sel).count();
  const href = await page.locator(sel).first().getAttribute('href');
  check(`WP ${view}: JS took over the server list`, enhanced > 0 && await page.locator('[data-grid-baseline]').count() === 0, `${enhanced} enhanced links`);
  check(`WP ${view}: links are permalinks`, href?.startsWith('/people/'), href);
  const broken = await page.evaluate(() => [...document.images].filter(i => i.complete && i.src && !i.naturalWidth && i.loading !== 'lazy').length);
  check(`WP ${view}: no broken images, no errors`, !broken && !errors.length, errors.slice(0, 3).join(' | '));
  if (view === 'gallery') await page.screenshot({ path: `${out}/i-wp-gallery.png` });
  await page.close();
}
{
  // no JavaScript at all: the server list alone is a usable page
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(new URL('../build/out/wp-chronicle.html', base).href, { waitUntil: 'networkidle' });
  const rows = await page.locator('.reg-row a[href^="/people/"]').count();
  const firstVisible = await page.locator('.reg-row').first().isVisible();
  check('WP no-JS: every person is a visible link', rows === 418 && firstVisible, `${rows}`);
  await page.screenshot({ path: `${out}/i-wp-nojs.png` });
  await ctx.close();
}

/* ---- the Jasper dropdown + hover stability (Firefox, and Chromium if it launches;
   Chromium needs LD_LIBRARY_PATH to a local libnspr4/libnss3 on this box) -------- */
const engines = [['firefox', browser]];
try { engines.push(['chromium', await require('playwright').chromium.launch()]); } catch { console.log('skip chromium (does not launch here)'); }
for (const [eng, br] of engines) {
  for (const [label, viewport, scroll] of [['roomy', { width: 1440, height: 900 }, 0], ['pinned', { width: 1440, height: 900 }, 1500], ['cramped', { width: 1440, height: 700 }, 0], ['phone', { width: 390, height: 844 }, 700]]) {
    const page = await br.newPage({ viewport });
    await page.goto(base + 'people-register.html', { waitUntil: 'networkidle' });
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), scroll);
    await page.waitForTimeout(500);
    const btn = page.locator('.si-select__button').first();
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const b = await btn.boundingBox();
    await btn.click();
    await page.waitForTimeout(250);
    const list = page.locator('.si-select__list:not([hidden])');
    const l = await list.boundingBox();
    const headerBottom = await page.evaluate(() => document.querySelector('.ct-header').getBoundingClientRect().bottom);
    const side = await list.getAttribute('data-side');
    const inside = l.y >= headerBottom && l.y + l.height <= viewport.height && l.x >= 0 && l.x + l.width <= viewport.width;
    const below = viewport.height - (b.y + b.height);
    check(`${eng} dropdown ${label}: opens ${side}, inside the viewport, clear of the header`, inside && (side === 'bottom' || below < 186),
      `button y=${Math.round(b.y)} list ${Math.round(l.y)}–${Math.round(l.y + l.height)} header ${Math.round(headerBottom)}`);
    if (label === 'roomy') {
      await page.keyboard.press('End');
      await page.keyboard.press('Home');
      await page.keyboard.type('ger');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      check(`${eng} dropdown keyboard: type-ahead + Enter filters`, await page.locator('.si-select__value').first().textContent() === 'Germany (11)' && page.url().includes('country=Germany'));
      check(`${eng} dropdown closes, focus back on the control`, await page.evaluate(() => document.activeElement?.classList.contains('si-select__button')) && !(await list.count()));
      // hover stability: box and text must not move by even a fraction
      const probe = sel => page.locator(sel).first().evaluate(e => {
        const r = e.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(e);
        const t = range.getBoundingClientRect(); return [r.top, r.height, t.top].map(v => v.toFixed(3)).join('/');
      });
      for (const sel of ['.si-select__button', '.si-segmented button:nth-child(2)', '.si-segmented button:nth-child(3)']) {
        await page.mouse.move(2, viewport.height - 2); await page.waitForTimeout(250);
        const before = await probe(sel);
        const r = await page.locator(sel).first().boundingBox();
        await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(400);
        const after = await probe(sel);
        check(`${eng} hover does not move ${sel}`, before === after, `${before} → ${after}`);
      }
      await page.screenshot({ path: `${out}/i-${eng}-select-closed.png`, clip: { x: 0, y: Math.max(0, r0(b.y) - 60), width: 1440, height: 200 } });
    }
    if (label === 'cramped' || label === 'pinned') await page.screenshot({ path: `${out}/i-${eng}-select-${label}.png` });
    await page.keyboard.press('Escape');
    await page.close();
  }
  if (eng !== 'firefox') await br.close();
}
function r0(v) { return Math.round(v); }

/* ---- translations reach both layers (build/out/wp-register-de.html: mock German) ---- */
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('../build/out/wp-register-de.html', base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const title = await page.locator('#reg-title').innerText();
  const count = await page.locator('[data-count]').innerText();
  const letter = await page.locator('.reg-letter__glyph small').first().innerText();
  const seg = await page.locator('[data-sort="heard"]').innerText();
  check('i18n: PHP strings translated (title, button)', /Register der\s+Stimmen/.test(title) && seg === 'Am häufigsten', `${title} | ${seg}`);
  check('i18n: JS strings translated, plural + locale number', count === '418 Personen' && /Namen$/.test(letter), `${count} | ${letter}`);
  await page.fill('[data-q]', 'zepp');
  await page.waitForTimeout(300);
  check('i18n: filtered count uses the translated template', /^\d+ von 418$/.test(await page.locator('[data-count]').innerText()), await page.locator('[data-count]').innerText());
  check('i18n: no errors', !errors.length, errors.join(' | '));
  await page.close();
}

/* ---- toolbar controls: one height, one whole-pixel top (Blocksy's label margin
   once put them on sub-pixels, which made the pressed fill look shifted) ------ */
for (const file of ['people-register.html', 'people-medallions.html', 'people-chronicle.html', '../build/out/wp-register.html']) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(new URL(file, base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const g = await page.evaluate(() => [...document.querySelectorAll('.people-toolbar .si-search input, .people-toolbar .si-segmented, .people-toolbar .si-select__button')]
    .map(e => { const r = e.getBoundingClientRect(); return [r.top + scrollY, r.height]; }));
  const whole = v => Math.abs(v - Math.round(v)) <= 1 / 32;
  const ok = g.length >= 2 && g.every(([t, h]) => h === 40 && whole(t) && Math.abs(t - g[0][0]) < 0.02);
  check(`toolbar controls aligned on whole pixels: ${file}`, ok, JSON.stringify(g.map(([t, h]) => [+t.toFixed(3), h])));
  await page.close();
}

/* ---- reduced motion: content is visible without any animation ------------- */
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + 'people-medallions.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => scrollTo({ top: 1400, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const op = await page.locator('.gal-card').first().evaluate(el => getComputedStyle(el).opacity);
  check('reduced motion: cards visible without reveal', op === '1', op);
  const anim = await page.locator('.gal-drift__row').first().evaluate(el => getComputedStyle(el).animationName);
  check('reduced motion: banner drift stopped', anim === 'none', anim);
  await ctx.close();
}

await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
