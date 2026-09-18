// Behaviour checks for the round-two drafts. Screenshots prove a footer looks
// right; these prove it works.
//
//   python3 -m http.server 8763 --directory projects/schiller-wp-rebuild
//   PW=<node_modules with playwright> node footer/build/interact.mjs [--engine chromium|webkit]
//
// Covers the two things the review asked for by name — a language switcher that
// interacts smoothly, and carousels that stop on hover — plus the progressive
// fallbacks, which are the easiest thing to break and the hardest to notice.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.PW || '.', 'x.js'));
const playwright = require('playwright');

const args = process.argv.slice(2);
const take = f => { const i = args.indexOf(f); return i >= 0 ? args.splice(i, 2)[1] : null; };
const only = take('--engine');
const engines = only ? [only] : ['chromium', 'webkit'];
const base = process.env.BASE || 'http://localhost:8763/footer/';

let pass = 0;
const failures = [];
const check = (name, ok, detail = '') => {
	if (ok) { pass++; return; }
	failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const langOpen = page => page.locator('.si-lang.is-open').count().then(n => n > 0);

async function languageSwitcher(page, label) {
	const button = page.locator('.si-lang__button').first();
	const list = page.locator('.si-lang__list').first();

	check(`${label} trigger exists`, await button.count() === 1);
	check(`${label} trigger names the current language`,
		(await button.textContent()).trim().startsWith('English'));
	check(`${label} popup starts closed`, await list.isHidden());
	check(`${label} aria-expanded starts false`,
		await button.getAttribute('aria-expanded') === 'false');

	// pointer
	await button.click();
	check(`${label} click opens`, await langOpen(page));
	check(`${label} aria-expanded becomes true`,
		await button.getAttribute('aria-expanded') === 'true');
	check(`${label} all eight languages are listed`,
		await list.locator('a').count() === 8);
	check(`${label} current language carries aria-current`,
		await list.locator('a[aria-current="true"]').count() === 1);
	check(`${label} untranslated languages are marked`,
		await list.locator('a[data-missing]').count() === 2);

	// the popup must not be clipped away by the footer's own overflow rules
	const box = await list.boundingBox();
	check(`${label} popup has a real box`, box && box.width > 120 && box.height > 120,
		box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'none');

	// keyboard
	await page.keyboard.press('ArrowDown');
	check(`${label} ArrowDown moves the active row`,
		await list.locator('a.is-active').count() === 1);
	await page.keyboard.press('End');
	const last = await list.locator('a').last().getAttribute('hreflang');
	check(`${label} End jumps to the last language`,
		await list.locator('a.is-active').getAttribute('hreflang') === last, last);
	// type-ahead runs on the NATIVE name, so "d" must find Deutsch
	await page.keyboard.press('d');
	check(`${label} type-ahead finds Deutsch`,
		await list.locator('a.is-active').getAttribute('hreflang') === 'de');
	await page.keyboard.press('Escape');
	check(`${label} Escape closes`, !(await langOpen(page)));
	check(`${label} Escape returns focus to the trigger`,
		await page.evaluate(() => document.activeElement?.classList.contains('si-lang__button')));

	// outside click
	await button.click();
	await page.mouse.click(5, 5);
	check(`${label} an outside click closes`, !(await langOpen(page)));
}

// `motionSel` is what actually moves, which differs between the two: the Rotunda
// writes one transform to the RING each frame and the 24 seats ride it with their
// own static transforms, while the Cabinet writes a transform per plate.
async function carousel(page, label, sel, faceSel, motionSel, { hasFront = true, namesOnHover = false } = {}) {
	const stage = page.locator(sel);
	check(`${label} carousel is present`, await stage.count() === 1);

	const read = () => page.evaluate(s =>
		getComputedStyle(document.querySelector(s)).transform, motionSel);

	// NOT scrollIntoViewIfNeeded(): it waits for the element to be stable, and a
	// face on a carousel never is. Scroll the static stage instead.
	await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
	await page.waitForTimeout(400);
	const a = await read();
	await page.waitForTimeout(900);
	const b = await read();
	check(`${label} moves on its own`, a !== b, 'transform unchanged after 900ms');

	// Nothing may interpolate a transform the script writes every frame. Blocksy
	// styles every <a> with `transition: all .12s`, which turned the loop's wrap
	// into a flight across the strip and made pausing jerk. Deterministic guard:
	const anim = await page.evaluate(s => getComputedStyle(document.querySelector(s)).transitionProperty, motionSel);
	check(`${label} nothing interpolates the per-frame transform`,
		!/\btransform\b|\ball\b/.test(anim), anim);

	// The seam must never be visible: a face wraps by the whole loop length, so
	// half of it has to sit outside the stage plus one pitch of margin.
	const seam = await page.evaluate(([s, f]) => {
		const all = [...document.querySelectorAll(`${s} ${f}`)];
		// VISIBLE faces only: a culled one keeps the transform it had when it left
		// the stage, and those stale values wreck the pitch estimate
		const xs = all
			.filter(a => getComputedStyle(a).visibility !== 'hidden')
			.map(a => new DOMMatrixReadOnly(getComputedStyle(a).transform).m41)
			.sort((a, b) => a - b);
		const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter(d => d > 1).sort((a, b) => a - b);
		const pitch = gaps[Math.floor(gaps.length / 2)];   // median: robust to an odd edge
		const half = all.length * pitch / 2;
		const span = document.querySelector(s).clientWidth / 2;
		return { half: Math.round(half), edge: Math.round(span + pitch) };
	}, [sel, faceSel]);
	check(`${label} the loop's seam falls off-stage`, seam.half > seam.edge,
		`wrap at ${seam.half}px, stage edge at ${seam.edge}px`);

	// hover must stop it — the explicit ask, and a moving link cannot be clicked
	await stage.hover({ position: { x: 10, y: 10 } });
	await page.waitForTimeout(30);
	const c = await read();          // sampled early: an interpolated transform
	await page.waitForTimeout(700);  // would still be settling here
	check(`${label} stops on hover`, c === await read(), 'kept moving while hovered');

	await page.mouse.move(0, 0);
	await page.waitForTimeout(600);
	check(`${label} resumes when the pointer leaves`, c !== await read());

	const captionSel = label === 'rotunda' ? '.rotunda__caption' : '.cabinet__caption';

	if (hasFront) {
		check(`${label} exactly one face is at the front`,
			await page.locator(`${sel} .is-front`).count() === 1);
		const name = await page.locator(`${sel} .is-front`).getAttribute('data-name');
		const shown = (await page.locator(`${captionSel} [data-name]`).textContent()).trim();
		check(`${label} the caption names the front face`, name === shown, `${shown} ≠ ${name}`);
	}

	// the subheader is ALWAYS a role, never a year-span fallback
	const roles = await page.locator(`${sel} ${faceSel}`).evaluateAll(
		els => els.map(e => e.dataset.role));
	check(`${label} every face carries a role`, roles.every(r => r && r.trim().length > 3));
	check(`${label} no face falls back to a year span`,
		!roles.some(r => /^In the archive/.test(r)), roles.find(r => /^In the archive/.test(r)) || '');
	const shownRole = (await page.locator(`${captionSel} [data-role]`).textContent()).trim();
	check(`${label} the caption's second line is a role`,
		roles.includes(shownRole), shownRole);

	// --- the hover contract -------------------------------------------------
	// Pointing at a face must change the PORTRAIT and nothing else: no ring, no
	// border, no lift. This is the review's instruction, and exactly the kind of
	// thing a screenshot of a paused carousel will not catch.
	//
	// The mouse is driven directly rather than through locator.hover(), which
	// waits for the element to be stable — a face on a carousel never is. The
	// pointer is first parked inside the stage but above the faces, which pauses
	// the strip (loop.js) without hovering anything.
	const stageBox = await stage.boundingBox();
	const park = async () => {
		await page.mouse.move(stageBox.x + 12, stageBox.y + 4);
		await page.waitForTimeout(600);
	};
	await park();

	// Ask the page what is actually hittable rather than computing a point from a
	// bounding box: E's plates are rotated in Y, so their axis-aligned box and the
	// shape the browser hit-tests are not the same thing, and a computed centre
	// lands on the track between two plates.
	const target = await page.evaluate(([s, f]) => {
		const stage = document.querySelector(s);
		const sb = stage.getBoundingClientRect();
		// scan at a FACE's vertical centre, not the wrapper's: both wrappers also
		// contain the caption, so their middle sits below the portraits
		const any = [...document.querySelectorAll(`${s} ${f}`)]
			.map(a => a.getBoundingClientRect())
			.find(r => r.width > 0 && r.height > 0);
		if (!any) return null;
		const y = any.top + any.height / 2;
		const mid = sb.left + sb.width / 2;
		const hits = [];
		for (let x = sb.left + 4; x < sb.right - 4; x += 6) {
			const face = document.elementFromPoint(x, y)?.closest(f);
			// not the front one: in E it is already in colour by design, so it
			// could never demonstrate the grey -> colour change
			if (face && !face.classList.contains('is-front')) hits.push({ x, face });
		}
		if (!hits.length) return null;
		hits.sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
		const { x, face } = hits[0];
		face.dataset.probe = '1';
		return { x, y, name: face.dataset.name };
	}, [sel, faceSel]);
	check(`${label} a face is reachable while paused`, !!target);

	const probe = page.locator(`${sel} [data-probe]`);
	const styles = () => probe.evaluate(a => {
		const med = a.querySelector('.si-medallion') || a.querySelector('.si-plate');
		const img = a.querySelector('.si-medallion__img');
		const m = getComputedStyle(med);
		return {
			shadow: m.boxShadow, border: m.borderColor,
			transform: getComputedStyle(a).transform,
			filter: getComputedStyle(img).filter,
			transition: getComputedStyle(img).transitionProperty,
		};
	});

	const rest = await styles();
	await page.mouse.move(target.x, target.y);
	await page.waitForTimeout(700);
	const hot = await styles();

	check(`${label} hover leaves the ring alone`, rest.shadow === hot.shadow,
		`${rest.shadow} -> ${hot.shadow}`);
	check(`${label} hover leaves the border alone`, rest.border === hot.border);
	check(`${label} hover does not move the face`, rest.transform === hot.transform);
	check(`${label} hover colours the portrait`, hot.filter === 'none' && rest.filter !== 'none',
		`${rest.filter} -> ${hot.filter}`);
	check(`${label} the portrait fades rather than snapping`, rest.transition.includes('filter'),
		rest.transition);
	// D names the face you point at (pointing also stops the strip). E names
	// whichever plate is at the lit centre, which is a different contract.
	if (namesOnHover) {
		check(`${label} hovering a face names that face`,
			(await page.locator(`${captionSel} [data-name]`).textContent()).trim() === target.name);
	}

	await page.evaluate(s => document.querySelector(`${s} [data-probe]`)?.removeAttribute('data-probe'), sel);
	await page.mouse.move(0, 0);

	// every face is a real link to a real person
	const hrefs = await page.locator(`${sel} ${faceSel}`).evaluateAll(
		els => els.map(e => e.getAttribute('href')));
	check(`${label} all 24 faces link to /people/`,
		hrefs.length === 24 && hrefs.every(h => /^\/people\/[a-z0-9-]+\/$/.test(h)));
}

async function reducedMotion(browser, label, page404) {
	const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(`${base}${page404}.html#si-footer`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
	const sel = page404 === 'footer-rotunda' ? '.rotunda' : '.cabinet';
	const moving = `${sel} [class$="__face"]`;
	const a = await page.evaluate(s => getComputedStyle(document.querySelector(s)).transform, moving);
	await page.waitForTimeout(900);
	const b = await page.evaluate(s => getComputedStyle(document.querySelector(s)).transform, moving);
	check(`${label} is still under reduced motion`, a === b);
	check(`${label} is still composed, not blank`,
		await page.locator(`${sel} [class$="__face"]`).first().isVisible());
	await ctx.close();
}

async function noScript(browser, label) {
	const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(`${base}footer-quiet.html`, { waitUntil: 'load' });
	const links = page.locator('.si-lang__list a');
	check(`${label} without JS every language is still a link`, await links.count() === 8);
	check(`${label} without JS the list is visible`, await links.first().isVisible());
	check(`${label} without JS no trigger is injected`, await page.locator('.si-lang__button').count() === 0);
	check(`${label} no flags anywhere`, await page.locator('.si-flag, [href^="#flag-"]').count() === 0);
	await ctx.close();
}

for (const engine of engines) {
	const browser = await playwright[engine].launch();
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	page.on('pageerror', e => failures.push(`${engine} pageerror: ${e.message}`));

	await page.goto(`${base}footer-rotunda.html#si-footer`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	await languageSwitcher(page, `${engine} rotunda`);
	await carousel(page, 'rotunda', '.rotunda', '.rotunda__face', '.rotunda__face', { hasFront: false, namesOnHover: true });

	await page.goto(`${base}footer-cabinet.html#si-footer`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	await carousel(page, 'cabinet', '.cabinet', '.cabinet__face', '.cabinet__face');

	await page.goto(`${base}footer-quiet.html#si-footer`, { waitUntil: 'networkidle' });
	await languageSwitcher(page, `${engine} quiet`);

	await page.close();
	await reducedMotion(browser, `${engine} rotunda`, 'footer-rotunda');
	await reducedMotion(browser, `${engine} cabinet`, 'footer-cabinet');
	await noScript(browser, engine);
	await browser.close();
}

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log('  ✗ ' + f);
process.exit(failures.length ? 1 : 0);
