/* pavilion-motif.js — the Pavilion's title-band motif, three candidates.
 *
 *   laurel-mosaic  a laurel sprig set in tesserae: a pattern at a glance, a
 *                  laurel on the second look
 *   mosaic         a field of tesserae laid in arcs (opus tessellatum), no figure
 *   sprig          the same laurel sprig drawn in one fine line
 *
 * Decorative only (aria-hidden), no motion, no image file: an inline SVG whose
 * colours are Jasper classes (.pm-*), so the CSS tokens decide every tone.
 * The drawing is a pure function of (kind, seed): the same page always gets the
 * same picture and two pages differ a little, with nobody choosing anything.
 * That is also why it is written plainly — it is meant to be ported to PHP.
 */

const W = 600, H = 320;                     // the viewBox

/* mulberry32 — small, fast, and the same in any language */
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function seedOf(id) {
	const s = String(id);
	let h = 2166136261;                     // FNV-1a
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}
const f = n => Math.round(n * 10) / 10;     // one decimal is plenty at this size

/* ---- the laurel ------------------------------------------------------------
 * A stem as a quadratic curve from the lower right toward the upper left, and
 * lanceolate leaves alternating along it, shrinking toward the tip, each
 * leaning toward the tip. A leaf is kept as (base, direction, length, width)
 * so the line drawing and the mosaic share exactly one shape. */
function laurel(r) {
	const p0 = [W - 30 - r() * 40, H + 10];                 // enters from below the band
	const p2 = [W * (0.30 + r() * 0.08), 34 + r() * 30];    // the tip, upper left
	const p1 = [W * (0.78 + r() * 0.1), H * (0.22 + r() * 0.12)];  // the bow
	const at = t => [
		(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
		(1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
	];
	const tangent = t => {
		const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
		const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
		const l = Math.hypot(dx, dy) || 1;
		return [dx / l, dy / l];
	};
	const leaves = [];
	const n = 9 + Math.floor(r() * 4);
	for (let i = 0; i < n; i++) {
		const t = 0.16 + (i / n) * 0.8;
		const [bx, by] = at(t);
		const [tx, ty] = tangent(t);
		const side = i % 2 ? 1 : -1;
		const lean = (0.62 + r() * 0.22) * side;            // radians off the stem
		const c = Math.cos(lean), s = Math.sin(lean);
		const dir = [tx * c - ty * s, tx * s + ty * c];
		const len = (74 - 34 * (i / n)) * (0.9 + r() * 0.2);
		leaves.push({ base: [bx, by], dir, len, wid: len * (0.2 + r() * 0.04) });
	}
	const [ex, ey] = p2, [tx, ty] = tangent(1);
	leaves.push({ base: [ex - tx * 6, ey - ty * 6], dir: [tx, ty], len: 40, wid: 8 });  // the terminal leaf
	const berries = [];
	for (let i = 0, k = 2 + Math.floor(r() * 2); i < k; i++) {
		const [bx, by] = at(0.2 + r() * 0.25);
		berries.push([bx + (r() - 0.5) * 26, by + (r() - 0.5) * 26, 4 + r() * 1.6]);
	}
	return { p0, p1, p2, at, leaves, berries };
}
/* half-width of a leaf at fraction u of its length: widest a third of the way up */
const halfWidth = (leaf, u) => leaf.wid * Math.pow(Math.sin(Math.PI * u), 0.85) * (1 - 0.3 * u);
function inLeaf(leaf, x, y) {
	const dx = x - leaf.base[0], dy = y - leaf.base[1];
	const u = (dx * leaf.dir[0] + dy * leaf.dir[1]) / leaf.len;
	if (u <= 0 || u >= 1) return false;
	const v = -dx * leaf.dir[1] + dy * leaf.dir[0];
	return Math.abs(v) < halfWidth(leaf, u);
}
/* roughly how far (x, y) lies outside a leaf's edge */
function leafGap(leaf, x, y) {
	const dx = x - leaf.base[0], dy = y - leaf.base[1];
	const u = (dx * leaf.dir[0] + dy * leaf.dir[1]) / leaf.len;
	const v = Math.abs(-dx * leaf.dir[1] + dy * leaf.dir[0]);
	if (u < 0) return Math.hypot(u * leaf.len, v);
	if (u > 1) return Math.hypot((u - 1) * leaf.len, v);
	return v - halfWidth(leaf, u);
}
function leafPath(leaf) {
	const pts = [[], []];
	for (let i = 0; i <= 14; i++) {
		const u = i / 14, w = halfWidth(leaf, u);
		const cx = leaf.base[0] + leaf.dir[0] * leaf.len * u, cy = leaf.base[1] + leaf.dir[1] * leaf.len * u;
		pts[0].push([cx - leaf.dir[1] * w, cy + leaf.dir[0] * w]);
		pts[1].unshift([cx + leaf.dir[1] * w, cy - leaf.dir[0] * w]);
	}
	return 'M' + [...pts[0], ...pts[1]].map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
}

/* ---- the three drawings ---------------------------------------------------- */
function sprig(r) {
	const L = laurel(r);
	const stem = `M${f(L.p0[0])} ${f(L.p0[1])}Q${f(L.p1[0])} ${f(L.p1[1])} ${f(L.p2[0])} ${f(L.p2[1])}`;
	const ribs = L.leaves.map(l => `M${f(l.base[0])} ${f(l.base[1])}l${f(l.dir[0] * l.len * 0.86)} ${f(l.dir[1] * l.len * 0.86)}`).join('');
	return `<path class="pm-line" d="${stem}"/>`
		+ L.leaves.map(l => `<path class="pm-line" d="${leafPath(l)}"/>`).join('')
		+ `<path class="pm-rib" d="${ribs}"/>`
		+ L.berries.map(([x, y, rad]) => `<circle class="pm-line" cx="${f(x)}" cy="${f(y)}" r="${f(rad)}"/>`).join('');
}

function tile(x, y, size, rot, cls) {
	const h = size / 2;
	return `<rect class="${cls}" x="${f(x - h)}" y="${f(y - h)}" width="${f(size)}" height="${f(size)}" rx="1" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
}

function laurelMosaic(r) {
	const L = laurel(r);
	/* tesserae need a fuller leaf than a pen line does to read as a leaf */
	L.leaves = L.leaves.map(l => ({ ...l, len: l.len * 1.12, wid: l.wid * 1.45 }));
	const S = 6;                             // one tessera and its joint: small enough that a leaf is several across
	/* distance to the stem, by sampling the curve once */
	const stemPts = Array.from({ length: 80 }, (_, i) => L.at(i / 79));
	const nearStem = (x, y) => stemPts.reduce((m, [sx, sy]) => Math.min(m, Math.hypot(x - sx, y - sy)), 1e9);
	let out = '';
	for (let gy = S / 2; gy < H; gy += S) {
		for (let gx = S / 2; gx < W; gx += S) {
			const x = gx + (r() - 0.5) * 1.1, y = gy + (r() - 0.5) * 1.1, rot = (r() - 0.5) * 12;
			const leaf = L.leaves.find(l => inLeaf(l, x, y));
			if (leaf) { out += tile(x, y, S - 1.1, rot, r() < 0.28 ? 'pm-b' : 'pm-a'); continue; }
			if (nearStem(x, y) < 3.2) { out += tile(x, y, S - 1.4, rot, 'pm-b'); continue; }
			if (L.berries.some(([bx, by, br]) => Math.hypot(x - bx, y - by) < br + 1.5)) { out += tile(x, y, S - 1.1, rot, 'pm-b'); continue; }
			/* the ground: one close course of pale tesserae tracing the figure,
			   as a mosaicist outlines an image before filling the field, then a
			   few strays thinning out */
			const d = Math.min(nearStem(x, y) - 3.2, ...L.leaves.map(l => leafGap(l, x, y)));
			if (d < 5 ? r() < 0.92 : r() < Math.max(0, 0.22 - d / 160)) out += tile(x, y, S - 1.4, rot, r() < 0.55 ? 'pm-c' : 'pm-d');
		}
	}
	return out;
}

function mosaic(r) {
	/* rings of tesserae round a centre off the lower right, the way a floor is
	   laid outward from its emblem; every few rings a darker course */
	const cx = W + 40 + r() * 80, cy = H + 60 + r() * 60;
	const course = 4 + Math.floor(r() * 3);
	const S = 9;
	let out = '';
	for (let ring = 0, rad = 24; rad < 720; ring++, rad += S) {
		const n = Math.max(6, Math.floor((2 * Math.PI * rad) / S));
		const phase = r() * Math.PI * 2;
		for (let i = 0; i < n; i++) {
			const a = phase + (i / n) * Math.PI * 2;
			const x = cx + Math.cos(a) * rad + (r() - 0.5) * 1.2, y = cy + Math.sin(a) * rad + (r() - 0.5) * 1.2;
			if (x < -S || x > W + S || y < -S || y > H + S) continue;
			const dark = ring % course === 0;
			const cls = dark ? (r() < 0.8 ? 'pm-a' : 'pm-b') : (r() < 0.12 ? 'pm-a' : r() < 0.55 ? 'pm-c' : 'pm-d');
			out += tile(x, y, S - 1.8, (a * 180) / Math.PI + 90 + (r() - 0.5) * 8, cls);
		}
	}
	return out;
}

export const MOTIFS = [
	['laurel-mosaic', 'Laurel in mosaic'],
	['mosaic', 'Mosaic field'],
	['sprig', 'Laurel sprig, fine line'],
];

export function motifSVG(kind, seed) {
	const r = rng(seed);
	const body = kind === 'mosaic' ? mosaic(r) : kind === 'sprig' ? sprig(r) : laurelMosaic(r);
	/* the field is a texture and may be cropped; a laurel is a figure and is
	   always shown whole */
	const fit = kind === 'mosaic' ? 'xMaxYMid slice' : 'xMaxYMid meet';
	return `<svg class="pa-motif pa-motif--${kind}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${fit}" aria-hidden="true" focusable="false">${body}</svg>`;
}
