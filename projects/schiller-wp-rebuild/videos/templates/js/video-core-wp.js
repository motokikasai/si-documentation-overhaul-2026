/* video-core-wp.js — the shared behaviour of the video views, inside WordPress.
 *
 * The page arrives complete from template-parts/videos/programme.php. This adds
 * only what needs a browser: the two-click player, the bridge that tells the
 * page what second the tape is at, the reveal, and the portraits fading in.
 *
 * The bridge is the same as the prototype's: the privacy-enhanced player with
 * enablejsapi=1, and the player's own postMessage "infoDelivery" events read
 * for the current time — no iframe_api script, no cookie, no extra request.
 * Every follower listens to one event on document: `si:time` {t, playing}.
 */
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hms(sec) {
	sec = Math.max(0, Math.round(sec || 0));
	const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** The payload the template prints for this page. */
export function videoData() {
	const el = document.getElementById('si-video-data');
	try { return el ? JSON.parse(el.textContent) : null; } catch { return null; }
}

/** The reader's hand wins: a wheel, touch or key in the last five seconds
 *  pauses every auto-follow, so nothing is yanked from under them. */
let lastHand = 0;
for (const ev of ['wheel', 'touchmove', 'keydown', 'pointerdown']) {
	addEventListener(ev, () => { lastHand = Date.now(); }, { passive: true, capture: true });
}
export const handIsBusy = () => Date.now() - lastHand < 5000;

export class Tape {
	constructor(fig) {
		this.fig = fig;
		this.id = fig.dataset.yt;
		this.t = 0;
		this.duration = null;
		this.frame = null;
		this.playing = false;
		fig.addEventListener('click', e => {
			const btn = e.target.closest('.si-vid-embed__btn');
			if (!btn || e.metaKey || e.ctrlKey || e.shiftKey) return;
			e.preventDefault();
			this.seek(this.t || 0);
		});
		addEventListener('message', e => this.#onMessage(e));
		document.addEventListener('si:simulate-time', e => this.#tick(e.detail.t, true));   // test hook
	}
	#post(msg) { this.frame?.contentWindow?.postMessage(JSON.stringify(msg), '*'); }
	#onMessage(e) {
		if (!this.frame || e.source !== this.frame.contentWindow) return;
		let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
		if (d?.event !== 'infoDelivery' || !d.info) return;
		if (typeof d.info.playerState === 'number') this.playing = d.info.playerState === 1;
		if (typeof d.info.duration === 'number' && d.info.duration > 0 && this.duration !== Math.round(d.info.duration)) {
			this.duration = Math.round(d.info.duration);
			document.dispatchEvent(new CustomEvent('si:duration', { detail: { duration: this.duration } }));
		}
		if (typeof d.info.currentTime === 'number') this.#tick(d.info.currentTime, this.playing);
	}
	#tick(t, playing) {
		this.t = t;
		document.dispatchEvent(new CustomEvent('si:time', { detail: { t, playing, tape: this } }));
	}
	seek(t) {
		t = Math.max(0, Math.floor(t));
		if (!this.frame) {
			const p = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1', origin: location.origin, start: String(t) });
			const f = document.createElement('iframe');
			f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.id)}?${p}`;
			f.title = document.title;
			f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen';
			f.allowFullscreen = true;
			f.addEventListener('load', () => {
				this.#post({ event: 'listening', id: 1, channel: 'widget' });
				this.#post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' });
			});
			this.fig.replaceChildren(f);
			this.fig.classList.add('is-playing');
			this.frame = f;
		} else {
			this.#post({ event: 'command', func: 'seekTo', args: [t, true], id: 1, channel: 'widget' });
			this.#post({ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' });
		}
		this.#tick(t, true);
		document.dispatchEvent(new CustomEvent('si:seek', { detail: { t } }));
	}
}

/** Mount the page's tape, and wire every [data-seek] control to it. Each one is
 *  a real link to YouTube at that second, so with JS off it still goes somewhere true. */
export function mountTape(root = document) {
	const fig = root.querySelector('.si-vid-embed[data-yt]');
	if (!fig) return null;
	const tape = new Tape(fig);
	document.addEventListener('si:want', e => tape.seek(e.detail.t));
	document.addEventListener('click', e => {
		const a = e.target.closest('[data-seek]');
		if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
		e.preventDefault();
		tape.seek(+a.dataset.seek);
		const r = fig.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight) fig.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
	});
	return tape;
}

/** ?t=754 — the second a shared link points at. */
export const wantedTime = () => {
	const t = new URLSearchParams(location.search).get('t');
	return t != null && /^\d+$/.test(t) ? +t : null;
};

export function reveal(root = document, sel = '.si-reveal') {
	const els = root.querySelectorAll(sel);
	if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(e => e.classList.add('is-in')); return; }
	const io = new IntersectionObserver(es => es.forEach(e => {
		if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
	}), { rootMargin: '0px 0px -8% 0px' });
	els.forEach(e => io.observe(e));
}

document.addEventListener('load', e => {
	if (e.target.classList?.contains('si-medallion__img')) e.target.classList.add('is-loaded');
}, true);
export function settleImages(root = document) {
	root.querySelectorAll('.si-medallion__img:not(.is-loaded)').forEach(img => {
		if (img.complete && img.naturalWidth) img.classList.add('is-loaded');
	});
}
