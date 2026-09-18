/* rotunda.js — D's carousel: a plain right-to-left slide.
 *
 * Deliberately ordinary. No perspective, no rotation, no depth: the faces travel
 * left at a constant speed, all the same size, evenly spaced. The earlier turning
 * ring was replaced because the 3D read as an effect rather than as a row of
 * people.
 *
 * It loops by folding each position into (−total/2, total/2], so the strip is
 * seamless with no cloned nodes — which also means no duplicate links for a
 * keyboard or a screen reader to walk through twice.
 *
 * SPEED is very low on purpose: one face passes a fixed point about every eight
 * seconds. A footer marquee that asks to be watched is one that irritates.
 */
import { createLoop, eagerWhenSeen, reduceMotion } from './loop.js';

const SPEED = 12;           // pixels per second

export function initRotunda(root = document) {
	root.querySelectorAll('[data-rotunda]').forEach(setup);
}

function setup(el) {
	const track = el.querySelector('.rotunda__track');
	const faces = [...track.querySelectorAll('.rotunda__face')];
	const caption = el.querySelector('[data-rotunda-caption]');
	if (faces.length < 2) return;

	let pitch = 0;
	let span = 0;
	let offset = 0;
	let centre = -1;         // the face crossing the middle
	let hovered = null;      // the face under the pointer, which wins the caption

	function measure() {
		const cs = getComputedStyle(el);
		const size = faces[0].getBoundingClientRect().width || 76;
		// the gap is a stylesheet decision, so it can change in a media query
		const gap = parseFloat(cs.getPropertyValue('--gap')) || 46;
		pitch = size + gap;
		span = Math.max(el.clientWidth, 1) / 2;
	}

	function paint() {
		const total = faces.length * pitch;
		const half = total / 2;
		let best = 0;
		let bestD = Infinity;

		for (let i = 0; i < faces.length; i++) {
			let x = (((i * pitch - offset) % total) + total) % total;
			if (x > half) x -= total;

			const face = faces[i];
			const d = Math.abs(x);
			if (d > span + pitch) {                // off the strip entirely
				if (face.style.visibility !== 'hidden') face.style.visibility = 'hidden';
				continue;
			}
			if (face.style.visibility === 'hidden') face.style.visibility = '';
			face.style.transform = `translateX(${x.toFixed(1)}px)`;

			if (d < bestD) { bestD = d; best = i; }
		}

		if (best !== centre) {
			centre = best;
			if (!hovered) name(faces[best]);
		}
	}

	/* The caption is the ONLY thing that reacts to a face. Nothing about the
	   medallion itself changes — no ring, no border, no lift — except the
	   portrait going from grey to colour, and that is components.css's own rule
	   for a hovered link, not one of ours. */
	function name(face) {
		if (!caption) return;
		const slot = caption.querySelector('[data-name]');
		if (slot.textContent === face.dataset.name) return;
		slot.textContent = face.dataset.name;
		caption.querySelector('[data-role]').textContent = face.dataset.role;
		caption.classList.remove('is-changed');
		void caption.offsetWidth;                  // restart the fade
		caption.classList.add('is-changed');
	}

	/* Pointing at a face holds the strip still (loop.js), so name the face being
	   pointed at rather than whichever one happens to be nearest the middle. */
	for (const face of faces) {
		const take = () => { hovered = face; name(face); };
		const release = () => { if (hovered === face) { hovered = null; name(faces[centre]); } };
		face.addEventListener('pointerenter', take);
		face.addEventListener('focus', take);
		face.addEventListener('pointerleave', release);
		face.addEventListener('blur', release);
	}

	measure();
	const remeasure = () => { measure(); paint(); };
	addEventListener('resize', remeasure);
	if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(el);

	eagerWhenSeen(el);
	createLoop(el, dt => {
		offset += SPEED * dt;
		paint();
	});

	if (reduceMotion.matches) el.dataset.still = '';
}
