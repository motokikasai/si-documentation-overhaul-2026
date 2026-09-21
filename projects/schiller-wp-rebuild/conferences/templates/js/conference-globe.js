/* conference-globe.js — "the gathering", as a slowly turning globe.
 *
 * Where a conference met and where its voices came from, drawn on a dot-matrix
 * globe in Jasper's own colours: land in jasper, the speakers' countries in
 * brass (sized by how many spoke), great-circle arcs rising from each country
 * and landing on the host city, then a small light travelling each arc for as
 * long as the page is open. An online conference has no host city, so its
 * voices pulse where they are, with no arcs.
 *
 * Nothing here is configured per conference. The globe reads three things
 * from the payload — rec.geo.venue, rec.geo.countries, rec.geo.online — and
 * the payload builder fills them from the GeoNames gazetteer. A conference in
 * Cape Town with speakers from Bolivia draws itself.
 *
 * Progressive: the page ships the flat map (gatheringSVG) and this module
 * replaces it with a canvas only when a 2D canvas is available. Reduced motion:
 * no spin and no travelling lights; the globe faces the host city with every
 * arc drawn. Drag turns it by hand; it resumes turning on its own afterwards.
 */
const D2R = Math.PI / 180;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** lat/lon → unit vector (y up, z toward the viewer at lon 0) */
const vec = (lat, lon) => {
	const p = lat * D2R, l = lon * D2R;
	return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** spherical interpolation between two unit vectors */
function slerp(a, b, t, omega) {
	if (omega < 1e-6) return a;
	const s = Math.sin(omega), k1 = Math.sin((1 - t) * omega) / s, k2 = Math.sin(t * omega) / s;
	return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

/* colours come from the page, so the night ground re-points them for free */
function palette(el) {
	const cs = getComputedStyle(el);
	const v = (name, fb) => (cs.getPropertyValue(name).trim() || fb);
	return {
		land: v('--si-jasper', '#8FA7BF'),
		brass: v('--si-gather-brass', v('--si-brass', '#A08040')),
		venue: v('--si-accent-deep', '#163754'),
		ink: v('--si-ink', '#121A24'),
		ground: v('--si-ground', '#F6F6F3'),
		sphere: v('--si-panel', '#E9EDF1'),
		rule: v('--si-rule', '#D8DDE3'),
		font: v('--si-font-sans', 'system-ui, sans-serif'),
	};
}

export function mountGlobe(figure, rec, land) {
	const svg = figure.querySelector('svg.si-gather');
	if (!land || !svg) return;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext && canvas.getContext('2d');
	if (!ctx) return;                                      // keep the flat map
	canvas.className = 'si-globe';
	canvas.setAttribute('role', 'img');
	canvas.setAttribute('aria-label', svg.getAttribute('aria-label') || '');
	svg.replaceWith(canvas);
	figure.classList.add('has-globe');

	const g = rec.geo || { countries: [], venue: null, online: false };
	const venueV = g.venue ? vec(g.venue.lat, g.venue.lon) : null;
	const maxN = Math.max(1, ...g.countries.map(c => c.n));
	const origins = g.countries.map((c, i) => ({
		...c, i, v: vec(c.lat, c.lon), r: 2.2 + 3.4 * Math.sqrt(c.n / maxN),
	}));
	const arcs = venueV ? origins.map(o => {
		const omega = Math.acos(Math.max(-1, Math.min(1, dot(o.v, venueV))));
		return omega < 2 * D2R ? null : { o, omega, lift: 0.08 + 0.22 * (omega / Math.PI) };
	}).filter(Boolean) : [];

	/* the land: points spread evenly over the sphere (a Fibonacci lattice),
	   kept where the mask says land — no rows, no crowding at the poles */
	const pts = [];
	const N = 14000, GOLD = Math.PI * (3 - Math.sqrt(5));
	const nRows = land.rows.length, nCols = land.rows[0].length;
	for (let i = 0; i < N; i++) {
		const y = 1 - 2 * (i + 0.5) / N;
		const lat = Math.asin(y) / D2R;
		const lon = ((i * GOLD / D2R) % 360 + 540) % 360 - 180;
		const ri = Math.floor((land.north - lat) / land.step);
		const ci = Math.floor((lon - land.west) / land.step);
		if (ri < 0 || ri >= nRows || ci < 0 || ci >= nCols) continue;
		if (land.rows[ri][ci] === '1') pts.push(vec(lat, lon));
	}

	/* the view: turn to the host city (or the voices' centre), tilted toward it */
	let centre = g.venue ? g.venue.lon : (() => {
		let x = 0, y = 0;
		for (const c of g.countries) { x += c.n * Math.cos(c.lon * D2R); y += c.n * Math.sin(c.lon * D2R); }
		return g.countries.length ? Math.atan2(y, x) / D2R : 10;
	})();
	const focusLat = g.venue ? g.venue.lat
		: (g.countries.length ? g.countries.reduce((s, c) => s + c.lat * c.n, 0) / g.countries.reduce((s, c) => s + c.n, 0) : 20);
	const tilt = Math.max(-28, Math.min(32, focusLat * 0.6)) * D2R;
	let lon0 = reduce ? centre : centre + 34;                // start with the city just left of centre
	const SPEED = 4.2;                                     // degrees per second: ~86 s a turn

	/* rotate a world vector into the view */
	let cy0 = 1, sy0 = 0;
	const ct = Math.cos(tilt), st = Math.sin(tilt);
	const view = w => {
		const x = w[0] * cy0 - w[2] * sy0;
		const z1 = w[0] * sy0 + w[2] * cy0;
		const y = w[1] * ct - z1 * st;
		const z = w[1] * st + z1 * ct;
		return [x, y, z];
	};

	let W = 0, H = 0, R = 0, CX = 0, CY = 0, dpr = 1, col = palette(figure);
	function size() {
		const rect = canvas.getBoundingClientRect();
		dpr = Math.min(2, devicePixelRatio || 1);
		W = rect.width; H = rect.height;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		R = Math.min(W, H) * 0.43; CX = W / 2; CY = H / 2;
		col = palette(figure);
	}
	const ro = new ResizeObserver(() => { size(); if (!running) draw(performance.now()); });
	ro.observe(canvas);
	size();

	const P = v => [CX + R * v[0], CY - R * v[1]];
	const visible = v => v[2] > 0 || (v[0] * v[0] + v[1] * v[1]) > 1;

	let t0 = null;                                          // set when the globe first comes into view
	function draw(now) {
		const t = t0 == null ? 0 : (now - t0) / 1000;
		cy0 = Math.cos(lon0 * D2R); sy0 = Math.sin(lon0 * D2R);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		/* the sphere: a quiet disc and one hairline */
		const grad = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R);
		grad.addColorStop(0, col.ground);
		grad.addColorStop(1, col.sphere);
		ctx.fillStyle = grad;
		ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = col.rule; ctx.lineWidth = 1;
		ctx.stroke();

		/* land: four depth bands, so the limb falls away */
		ctx.fillStyle = col.land;
		const bands = [[], [], [], []];
		for (const w of pts) {
			const v = view(w);
			if (v[2] <= 0.02) continue;
			bands[Math.min(3, Math.floor(v[2] * 4))].push(v);
		}
		bands.forEach((b, i) => {
			ctx.globalAlpha = 0.28 + i * 0.2;
			const r = R * (0.0062 + i * 0.0011);
			ctx.beginPath();
			for (const v of b) { const [x, y] = P(v); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
			ctx.fill();
		});
		ctx.globalAlpha = 1;

		/* arcs: great circles lifted off the surface, drawn in one by one */
		ctx.lineWidth = 1.1; ctx.strokeStyle = col.brass;
		for (const a of arcs) {
			const p = reduce ? 1 : Math.max(0, Math.min(1, (t - 0.5 - a.o.i * 0.12) / 1.5));
			if (p <= 0) continue;
			const ease = 1 - Math.pow(1 - p, 3);
			const steps = 48;
			ctx.globalAlpha = 0.78;
			ctx.beginPath();
			let pen = false;
			for (let s = 0; s <= steps * ease; s++) {
				const u = s / steps;
				const k = 1 + a.lift * Math.sin(Math.PI * u);
				const w = slerp(a.o.v, venueV, u, a.omega);
				const v = view([w[0] * k, w[1] * k, w[2] * k]);
				if (!visible(v)) { pen = false; continue; }
				const [x, y] = P(v);
				if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
			}
			ctx.stroke();
			/* the travelling light, once the arc is complete */
			if (!reduce && p >= 1) {
				const period = 3.2 + (a.o.i % 3) * 0.4;
				const u = ((t - 2 - a.o.i * 0.37) % period) / period;
				if (u > 0) {
					const k = 1 + a.lift * Math.sin(Math.PI * u);
					const w = slerp(a.o.v, venueV, u, a.omega);
					const v = view([w[0] * k, w[1] * k, w[2] * k]);
					if (visible(v)) {
						const [x, y] = P(v);
						ctx.globalAlpha = Math.sin(Math.PI * u);
						ctx.fillStyle = col.brass;
						ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill();
					}
				}
			}
		}
		ctx.globalAlpha = 1;

		/* origins */
		for (const o of origins) {
			const v = view(o.v);
			if (v[2] <= 0) continue;
			const appear = reduce ? 1 : Math.max(0, Math.min(1, (t - o.i * 0.11) / 0.5));
			if (!appear) continue;
			const [x, y] = P(v);
			const fade = Math.min(1, v[2] * 3) * appear;
			const pulse = g.online && !reduce ? 1 + 0.35 * Math.sin(t * 2.2 + o.i) : 1;
			ctx.globalAlpha = 0.18 * fade;
			ctx.fillStyle = col.brass;
			ctx.beginPath(); ctx.arc(x, y, o.r * 2.3 * pulse, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = fade;
			ctx.beginPath(); ctx.arc(x, y, o.r, 0, Math.PI * 2); ctx.fill();
		}
		ctx.globalAlpha = 1;

		/* the host city */
		if (venueV) {
			const v = view(venueV);
			if (v[2] > 0) {
				const [x, y] = P(v);
				const fade = Math.min(1, v[2] * 3);
				if (!reduce) {
					const ph = ((t - 1.6) % 3.2) / 3.2;
					if (t > 1.6) {
						ctx.globalAlpha = (1 - ph) * 0.8 * fade;
						ctx.strokeStyle = col.venue; ctx.lineWidth = 1;
						ctx.beginPath(); ctx.arc(x, y, 4 + ph * 16, 0, Math.PI * 2); ctx.stroke();
					}
				}
				ctx.globalAlpha = fade;
				ctx.fillStyle = col.venue;
				ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = col.venue; ctx.lineWidth = 1;
				ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
				ctx.font = `600 12px ${col.font}`;
				ctx.lineWidth = 4; ctx.strokeStyle = col.ground; ctx.fillStyle = col.ink;
				ctx.strokeText(g.venue.name, x + 12, y + 4);
				ctx.fillText(g.venue.name, x + 12, y + 4);
				ctx.globalAlpha = 1;
			}
		}
	}

	/* ---- the turning ------------------------------------------------------ */
	let running = false, raf = 0, last = 0, held = false, resumeAt = 0;
	function frame(now) {
		raf = 0;
		const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
		last = now;
		if (!reduce && !held && now >= resumeAt) lon0 -= SPEED * dt;
		draw(now);
		if (running) raf = requestAnimationFrame(frame);
	}
	function start() {
		if (running) return;
		running = true; last = 0;
		if (t0 == null) t0 = performance.now();
		raf = requestAnimationFrame(frame);
	}
	function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

	draw(performance.now());
	/* Run only while the globe is on screen AND the tab is visible, and
	   re-decide whenever EITHER changes. (It used to stop when the tab was
	   hidden and wait for the IntersectionObserver to restart it — which never
	   fires on returning to a tab, because the globe never left the viewport.
	   The globe stayed frozen until it was scrolled out and back.) */
	let inView = false;
	const sync = () => (inView && !document.hidden && !reduce ? start() : stop());
	const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; sync(); }, { threshold: 0.05 });
	io.observe(canvas);
	document.addEventListener('visibilitychange', sync);
	addEventListener('pageshow', sync);          // back/forward cache restores

	/* ---- drag to turn ------------------------------------------------------ */
	let dragX = null;
	canvas.addEventListener('pointerdown', e => {
		dragX = e.clientX; held = true;
		canvas.setPointerCapture(e.pointerId);
		canvas.classList.add('is-dragging');
	});
	canvas.addEventListener('pointermove', e => {
		if (dragX == null) return;
		lon0 -= (e.clientX - dragX) * (180 / (Math.PI * R));
		dragX = e.clientX;
		if (!running) draw(performance.now());       // a drag always answers, loop or not
	});
	const release = () => {
		if (dragX == null) return;
		dragX = null; held = false;
		resumeAt = performance.now() + 2500;
		canvas.classList.remove('is-dragging');
	};
	canvas.addEventListener('pointerup', release);
	canvas.addEventListener('pointercancel', release);

	return { stop, start };
}
