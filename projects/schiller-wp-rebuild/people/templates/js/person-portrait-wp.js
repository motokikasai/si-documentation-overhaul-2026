/* The Portrait in WordPress: behaviour for the server-rendered profile
 * (template-parts/people/profile.php). The page is complete without this file;
 * it adds the two-click player, the quote carousel, "show all", the conference
 * filter and the section nav. Everything it needs is in data attributes — no
 * payload, no strings of its own (the template prints them translated). */
import { playModal, setPlayerStrings, scrollSpy, reveal, settleImages, reduceMotion } from './person-core.js';

const root = document.querySelector('[data-profile]');
if (root) init(root);

function init(root) {
	try { setPlayerStrings(JSON.parse(document.getElementById('si-profile-strings')?.textContent || '{}')); } catch { /* keep English */ }
	settleImages(root);
	reveal(root);

	// every play control carries its own video, second, title and caption
	root.addEventListener('click', e => {
		const b = e.target.closest('[data-yt]');
		if (!b) return;
		e.preventDefault();
		playModal({ yt: b.dataset.yt, t: +b.dataset.t || 0, title: b.dataset.title || '', meta: b.dataset.meta || '' });
	});

	collapse(root.querySelector('.pa-rec-list'), root.querySelector('[data-more]'));
	company(root);
	carousel(root.querySelector('[data-quotes]'));

	const toc = root.querySelector('.pa-toc');
	if (toc) {
		scrollSpy(toc);
		new IntersectionObserver(([e]) => toc.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0))
			.observe(root.querySelector('.pa-name'));
	}
}

/** Show the first N items of a list, with a toggle whose labels the template translated. */
function collapse(list, btn) {
	if (!list || !btn) return;
	const show = +list.dataset.show || 5;
	const set = open => {
		[...list.children].forEach((li, i) => { li.hidden = !open && i >= show; });
		btn.setAttribute('aria-expanded', open);
		btn.textContent = open ? btn.dataset.labelLess : btn.dataset.labelMore;
	};
	set(false);
	btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
}

/** The company kept: first 12, or everyone at one conference. */
function company(root) {
	const list = root.querySelector('[data-people]');
	if (!list) return;
	const more = root.querySelector('[data-more-people]');
	const filter = root.querySelector('[data-conf-filter]');
	const show = +list.dataset.show || 12;
	let open = false;
	const apply = () => {
		const c = filter?.value || '';
		let shown = 0;
		for (const li of list.children) {
			const match = !c || li.dataset.confs.split(' ').includes(c);
			li.hidden = !match || (!open && !c && shown >= show);
			if (match) shown++;
		}
		if (more) {
			more.hidden = !!c;
			more.setAttribute('aria-expanded', open);
			more.textContent = open ? more.dataset.labelLess : more.dataset.labelMore;
		}
		settleImages(list);
	};
	apply();
	filter?.addEventListener('change', apply);
	more?.addEventListener('click', () => { open = !open; apply(); });
}

/** Quotes: one at a time, auto-advancing while in view (never with reduced motion). */
function carousel(box) {
	if (!box) return;
	const figs = [...box.querySelectorAll('.pa-quote')];
	if (figs.length < 2) return;
	const dots = [...box.querySelectorAll('[data-go]')];
	const DWELL = 9000;
	let cur = 0, timer = 0, inView = false, hover = false;
	const stop = () => { clearTimeout(timer); timer = 0; box.classList.remove('is-running'); };
	const schedule = () => {
		stop();
		if (reduceMotion || !inView || hover || box.dataset.paused) return;
		box.classList.add('is-running');
		timer = setTimeout(() => go(cur + 1), DWELL);
	};
	const go = (i, user) => {
		cur = (i + figs.length) % figs.length;
		figs.forEach((f, j) => { f.hidden = j !== cur; f.classList.toggle('is-in', j === cur); });
		dots.forEach((d, j) => j === cur ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
		if (user) stop();
		schedule();
	};
	box.style.setProperty('--dwell', `${DWELL}ms`);
	figs.forEach((f, j) => f.setAttribute('aria-label', `${j + 1} / ${figs.length}`));
	box.addEventListener('click', e => {
		const s = e.target.closest('[data-step]'); if (s) { box.dataset.paused = '1'; go(cur + +s.dataset.step, true); }
		const d = e.target.closest('[data-go]'); if (d) { box.dataset.paused = '1'; go(+d.dataset.go, true); }
	});
	box.addEventListener('pointerenter', () => { hover = true; stop(); });
	box.addEventListener('pointerleave', () => { hover = false; schedule(); });
	box.addEventListener('focusin', () => { hover = true; stop(); });
	new IntersectionObserver(([e]) => { inView = e.isIntersecting; schedule(); }, { threshold: 0.5 }).observe(box);
	go(0);
}
