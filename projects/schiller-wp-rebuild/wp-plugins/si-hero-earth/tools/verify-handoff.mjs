/* verify-handoff.mjs — the hero's four load paths, measured in a real browser.
 *
 *   # against the preview harness
 *   python3 articles/build/serve.py 8761   (from projects/schiller-wp-rebuild/)
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

const BASE = process.env.SI_BASE || 'http://127.0.0.1:8761';
const PATH = process.env.SI_PATH || '/wp-plugins/si-hero-earth/tools/preview.html';
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

/* --- 1b: the hold, the release, the chapter dots (0.3.1) ----------------- */
console.log('\nhold and release (desktop, WebGL)');
{
	const page = await open();
	await page.waitForFunction(() => document.querySelector('.si-hero')?.classList.contains('is-scene'), null, { timeout: 40000 })
		.catch(() => {});
	const geo = await page.evaluate(() => {
		const el = document.querySelector('.si-hero');
		const vh = window.innerHeight;
		const v = getComputedStyle(el).getPropertyValue('--si-hero-hold').trim();
		const hold = v.endsWith('px') ? parseFloat(v) : parseFloat(v) / 100 * vh;
		const top = el.getBoundingClientRect().top + window.scrollY;
		/* Every ancestor that would capture a position:fixed child. */
		const traps = [];
		for (let a = el.parentElement; a; a = a.parentElement) {
			const c = getComputedStyle(a);
			if (c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none'
				|| (c.contain && c.contain !== 'none') || /transform|filter|perspective/.test(c.willChange)
				|| (c.backdropFilter && c.backdropFilter !== 'none'))
				traps.push(a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + '.' + a.className);
		}
		return { vh, hold, top, h: el.offsetHeight, clip: getComputedStyle(el).clipPath, traps };
	});
	const sceneEnd = geo.top + geo.h - geo.vh - geo.hold;
	const release = geo.top + geo.h - geo.vh;
	const at = async (y) => {
		await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
		await page.waitForTimeout(1800); /* the scene eases into position */
		return page.evaluate(() => {
			const el = document.querySelector('.si-hero');
			const stages = Array.from(el.querySelectorAll('.si-hero__stage'));
			const chapters = el.querySelector('.si-hero__chapters');
			const active = chapters && chapters.querySelector('button.is-active');
			return {
				op: stages.map((s) => +parseFloat(getComputedStyle(s).opacity).toFixed(2)),
				pinTop: Math.round(el.querySelector('.si-hero__pin').getBoundingClientRect().top),
				canvasTop: Math.round(el.querySelector('.si-hero__canvas').getBoundingClientRect().top),
				canvasPos: getComputedStyle(el.querySelector('.si-hero__canvas')).position,
				stage3Top: Math.round(stages[3].getBoundingClientRect().top),
				chapter: chapters && chapters.style.getPropertyValue('--si-hero-chapter'),
				activeIdx: active ? Array.from(chapters.children).indexOf(active) : -1,
				pulse: active ? getComputedStyle(active, '::after').animationName : '',
			};
		});
	};

	check('hold added to the runway', Math.abs(geo.h - (geo.hold + 5.2 * geo.vh)) < 4, `${geo.h}px = 520vh + ${Math.round(geo.hold)}px hold`);
	const mid = await at(Math.round(sceneEnd + geo.hold / 2));
	check('act 4 held at full opacity mid-hold', mid.op[3] > 0.95 && mid.op.slice(0, 3).every((o) => o === 0), mid.op.join(' '));
	check('still pinned mid-hold', mid.pinTop === 0, `pin top ${mid.pinTop}px`);
	check('thread full, last dot active', mid.chapter === '1.0000' && mid.activeIdx === 3, `--si-hero-chapter ${mid.chapter}, dot ${mid.activeIdx}`);
	check('active dot breathes', mid.pulse === 'si-hero-chapter-breathe', mid.pulse || 'none');

	const rel = await at(Math.round(release + 300));
	check('clipped to its own box', /inset/.test(geo.clip), geo.clip);
	check('no ancestor captures the fixed scene', geo.traps.length === 0, geo.traps.join(', ') || 'none');
	check('scene stays put after release', rel.canvasPos === 'fixed' && rel.canvasTop === 0, `canvas ${rel.canvasPos}, top ${rel.canvasTop}px`);
	check('words scroll away with the page', rel.pinTop <= -290 && rel.pinTop >= -310, `pin top ${rel.pinTop}px`);
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
