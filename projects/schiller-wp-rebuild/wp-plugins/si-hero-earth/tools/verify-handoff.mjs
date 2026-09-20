/* verify-handoff.mjs — the hero's four load paths, measured in a real browser.
 *
 *   # against the preview harness
 *   python3 -m http.server 8750 --directory <plugin root>
 *   PW=<playwright node_modules> node tools/verify-handoff.mjs
 *
 *   # against WordPress (si-v4, through the Host-header proxy)
 *   node ../../articles/build/local-proxy.mjs si-v4.local 8770 &
 *   PW=… SI_BASE=http://127.0.0.1:8770 SI_PATH=/ node tools/verify-handoff.mjs
 *
 * Firefox only on this box — chromium's headless shell needs a libnspr4 that
 * is not installed. Firefox renders WebGL here through a software rasteriser,
 * which is slow but real: the scene starts and the checks below mean what
 * they say.
 *
 * WHAT IT IS CHECKING, AND WHY EACH ONE EXISTS
 *
 * 1. armed before the first paint — the whole point of 0.2.0. If the gate's
 *    answer lands after the hero has been painted, the visitor watches a
 *    static four-act hero turn into a one-act scroll runway. That is what was
 *    reported, and it is what regresses if the gate ever drifts back into the
 *    footer, or if its script gets deferred, or if an optimiser moves it.
 * 2. the canvas dissolves, never cuts — transparent while it has nothing but
 *    an untextured globe to show, opaque only after a complete frame.
 * 3. a refused visitor gets the whole static hero — all four acts, no canvas,
 *    no 520vh runway.
 * 4. a broken module gives the static hero BACK. Arming before the import is
 *    a guess; this proves the guess can be taken back.
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW ? process.env.PW + '/' : import.meta.url);
const { firefox } = require('playwright');

const BASE = process.env.SI_BASE || 'http://127.0.0.1:8750';
const PATH = process.env.SI_PATH || '/tools/preview.html';
const url = (q = '') => BASE + PATH + q;

const browser = await firefox.launch();
let failures = 0;

const check = (label, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
};

/* The marks the page takes of itself: first paint, and the two class changes
   that are the handoff. Polling rather than a MutationObserver because the
   class can be set before any observer of ours could be installed. */
const instrument = async (page) => {
	await page.addInitScript(() => {
		window.__m = {};
		const mark = (n) => { if (!(n in window.__m)) window.__m[n] = Math.round(performance.now()); };
		new PerformanceObserver((l) => l.getEntries().forEach((e) => mark(e.name)))
			.observe({ type: 'paint', buffered: true });
		const iv = setInterval(() => {
			const el = document.querySelector('.si-hero');
			if (!el) return;
			if (el.classList.contains('is-live')) mark('is-live');
			if (el.classList.contains('is-scene')) { mark('is-scene'); clearInterval(iv); }
		}, 4);
	});
};

const state = (page) => page.evaluate(() => {
	const el = document.querySelector('.si-hero');
	if (!el) return null;
	const stages = Array.from(el.querySelectorAll('.si-hero__stage'));
	return {
		live: el.classList.contains('is-live'),
		scene: el.classList.contains('is-scene'),
		fallback: el.dataset.siHeroFallback || null,
		canvasDisplay: getComputedStyle(el.querySelector('.si-hero__canvas')).display,
		canvasOpacity: getComputedStyle(el.querySelector('.si-hero__canvas')).opacity,
		canvasFade: getComputedStyle(el.querySelector('.si-hero__canvas')).transitionDuration,
		posterPresent: !!el.querySelector('.si-hero__poster'),
		heroH: el.offsetHeight,
		viewportH: window.innerHeight,
		visibleStages: stages.filter((s) => parseFloat(getComputedStyle(s).opacity) > 0.9).length,
		stageCount: stages.length,
		overflow: document.documentElement.scrollWidth - window.innerWidth,
		marks: window.__m,
	};
});

const open = async (opts = {}) => {
	const page = await browser.newPage({
		viewport: opts.viewport || { width: 1440, height: 900 },
		reducedMotion: opts.reducedMotion,
	});
	page.on('pageerror', (e) => check('no page error', false, String(e).slice(0, 120)));
	if (opts.block) await page.route(opts.block, (r) => r.abort());
	await instrument(page);
	await page.goto(url(opts.query || ''), { waitUntil: 'commit' });
	return page;
};

/* --- 1 & 2: the live path ------------------------------------------------ */
console.log('\nlive path (desktop, WebGL)');
{
	const page = await open();
	await page.waitForFunction(() => document.querySelector('.si-hero')?.classList.contains('is-scene'), null, { timeout: 40000 })
		.catch(() => {});
	/* Sampled the moment .is-scene lands: the canvas should still be part way
	   through its transition. Informational — how far through depends on how
	   fast the polling caught it — but a `0s` duration here would mean the
	   dissolve had been styled away and the handoff was a cut again. */
	const mid = await state(page);
	await page.waitForTimeout(1200);
	const s = await state(page);
	const fcp = s.marks['first-contentful-paint'];
	const live = s.marks['is-live'];

	check('armed', s.live);
	check('armed before the first paint', live !== undefined && fcp !== undefined && live <= fcp,
		`is-live ${live}ms, first paint ${fcp}ms`);
	check('scene revealed', s.scene, `is-scene ${s.marks['is-scene']}ms`);
	check('canvas dissolves rather than cuts', parseFloat(s.canvasFade) > 0,
		`transition ${s.canvasFade}, opacity ${mid.canvasOpacity} at the class change`);
	check('canvas opaque after the fade', s.canvasOpacity === '1');
	check('poster still behind it', s.posterPresent);
	check('one act on screen', s.visibleStages === 1, `${s.visibleStages}/${s.stageCount}`);
	check('pinned runway', s.heroH > s.viewportH * 3, `${s.heroH}px`);
	await page.close();
}

/* --- 3: the gated path --------------------------------------------------- */
console.log('\nstatic path (?si-hero=static)');
{
	const page = await open({ query: '?si-hero=static' });
	await page.waitForTimeout(2500);
	const s = await state(page);
	check('not armed', !s.live);
	check('reason recorded', !!s.fallback, s.fallback || '');
	check('no canvas', s.canvasDisplay === 'none');
	check('all four acts legible', s.visibleStages === s.stageCount, `${s.visibleStages}/${s.stageCount}`);
	check('normal height', s.heroH < s.viewportH * 2, `${s.heroH}px`);
	await page.close();
}

/* --- 3b: the phone ------------------------------------------------------- */
console.log('\nphone (390px — under the viewport floor)');
{
	const page = await open({ viewport: { width: 390, height: 844 } });
	await page.waitForTimeout(2500);
	const s = await state(page);
	check('not armed', !s.live, s.fallback || '');
	check('all four acts legible', s.visibleStages === s.stageCount, `${s.visibleStages}/${s.stageCount}`);
	check('no horizontal scroll', s.overflow <= 0, `${s.overflow}px`);
	await page.close();
}

/* --- 3c: reduced motion -------------------------------------------------- */
console.log('\nprefers-reduced-motion');
{
	const page = await open({ reducedMotion: 'reduce' });
	await page.waitForTimeout(2500);
	const s = await state(page);
	check('not armed', !s.live, s.fallback || '');
	check('all four acts legible', s.visibleStages === s.stageCount, `${s.visibleStages}/${s.stageCount}`);
	await page.close();
}

/* --- 4: the module never arrives ----------------------------------------- */
console.log('\nbroken module (the guess taken back)');
{
		/* Any scene module: the shipped si-hero-scene.js, and a draft's copy of it
   under another name (homepage-draft/hero-jasper runs hero-scene-jasper.js). */
	const page = await open({ block: '**/*hero-scene*.js*' });
	await page.waitForFunction(() => document.querySelector('.si-hero')?.dataset.siHeroFallback, null, { timeout: 30000 })
		.catch(() => {});
	const s = await state(page);
	check('disarmed', !s.live);
	check('failure recorded', /module failed/.test(s.fallback || ''), s.fallback || '');
	check('all four acts legible again', s.visibleStages === s.stageCount, `${s.visibleStages}/${s.stageCount}`);
	check('normal height again', s.heroH < s.viewportH * 2, `${s.heroH}px`);
	await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
