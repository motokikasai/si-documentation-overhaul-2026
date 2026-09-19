/* cabinet.js — E's carousel: framed portraits passing a lit window.
 *
 * Where D turns a ring, this travels in a straight line and lets perspective do
 * the bending: each plate is rotated about its own Y axis in proportion to how
 * far it is from the centre, and pushed back in Z, so the strip reads as a
 * curved wall of pictures seen from in front of the middle one. The plate at the
 * centre comes fully forward, loses the archive's grey treatment, and is named.
 *
 * All plates are the same size. Distance from the centre is the only thing that
 * varies, and it means position, not importance.
 */
import { createLoop, eagerWhenSeen, reduceMotion } from './loop.js';

const SPEED = 22;           // pixels per second — about one plate every 8s
const TURN = 34;            // degrees at the edge of the stage
const DEPTH = 130;          // pixels pushed back at the edge
const FADE = 0.62;          // opacity lost at the edge

export function initCabinet(root = document) {
	root.querySelectorAll('[data-cabinet]').forEach(setup);
}

function setup(el) {
	const track = el.querySelector('.cabinet__track');
	const faces = [...track.querySelectorAll('.cabinet__face')];
	const caption = el.querySelector('[data-cabinet-caption]');
	if (faces.length < 2) return;

	let pitch = 0;
	let span = 0;
	let offset = 0;
	let front = -1;

	function measure() {
		const face = faces[0].getBoundingClientRect();
		pitch = face.width * 1.14;               // plate plus air
		span = Math.max(el.clientWidth, 1) / 2;  // half the visible stage
	}

	function paint() {
		const total = faces.length * pitch;
		const half = total / 2;
		let best = 0;
		let bestD = Infinity;

		for (let i = 0; i < faces.length; i++) {
			// fold the running position into (-total/2, total/2] so the strip
			// loops with no seam and no cloned nodes
			let x = (((i * pitch - offset) % total) + total) % total;
			if (x > half) x -= total;

			const face = faces[i];
			const d = Math.abs(x);
			if (d > span + pitch) {              // off the stage entirely
				if (face.style.visibility !== 'hidden') {
					face.style.visibility = 'hidden';
					face.style.opacity = '0';
				}
				continue;
			}
			if (face.style.visibility === 'hidden') face.style.visibility = '';

			const u = Math.max(-1, Math.min(1, x / span));
			const a = Math.abs(u);
			face.style.transform =
				`translate3d(${x.toFixed(1)}px, 0, ${(-a * DEPTH).toFixed(1)}px) rotateY(${(-u * TURN).toFixed(2)}deg)`;
			face.style.opacity = (1 - a * FADE).toFixed(3);
			face.style.zIndex = String(1000 - Math.round(d));

			if (d < bestD) { bestD = d; best = i; }
		}

		if (best !== front) {
			front = best;
			faces.forEach(f => f.classList.remove('is-front'));
			faces[best].classList.add('is-front');
			if (caption) {
				caption.querySelector('[data-name]').textContent = faces[best].dataset.name;
				caption.querySelector('[data-role]').textContent = faces[best].dataset.role;
				caption.classList.remove('is-changed');
				void caption.offsetWidth;
				caption.classList.add('is-changed');
			}
		}
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
