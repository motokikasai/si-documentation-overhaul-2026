/* pavilion-motif.js — the Pavilion's title band when a page has no Featured image.
 *
 *   paper       cold-press paper: a watercolour sheet's tooth and its pulp
 *   fibre       fibre paper (kozo): long pulp fibres caught in the sheet
 *   craquelure  the crack network in an old painting's varnish
 *   silk        watered silk (moiré antique): two bent thread sets interfering
 *   engraving   burin lines swelling with an underlying tone
 *   marble      Calacatta: fine diagonal veins and hairlines
 *
 * Decorative only (aria-hidden), no motion, no image file: an inline SVG whose
 * colours are Jasper classes (.tx-*), so the CSS tokens decide every tone. The
 * drawing is a pure function of (kind, seed): the same page always gets the
 * same surface and two pages differ, with nobody choosing anything. That is
 * also why it is written plainly — it is meant to be ported to PHP.
 */

export function seedOf(id) {
	const s = String(id);
	let h = 2166136261;                     // FNV-1a
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}
const f = n => Math.round(n * 100) / 100;

/* ---- surfaces --------------------------------------------------------------
 * A texture is grown, not drawn: SVG noise (feTurbulence) seeded from the page,
 * shaped into a surface and coloured through CSS (flood-color / fill on .tx-*,
 * so the tokens decide every tone). Every one is built from several scales at
 * once — a fine grain, a middle structure, a slow drift — at low contrast, so it
 * reads as a calm ground at a glance and keeps something to find on a second
 * one. Noise is never symmetrical and never repeats; a light from the upper
 * right gives relief a direction. Each weighs one or two kilobytes. */
const lightFrom = '<feDistantLight azimuth="235" elevation="55"/>';
/* relief → two alphas: what the light misses (shadow) and what it catches */
const relief = (src, k, flat, gain = 3.2) => `
	<feDiffuseLighting in="${src}" surfaceScale="${k}" diffuseConstant="1" lighting-color="white" result="lit">${lightFrom}</feDiffuseLighting>
	<feColorMatrix in="lit" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${-gain} 0 0 0 ${f(flat * gain)}" result="sh"/>
	<feColorMatrix in="lit" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${gain} 0 0 0 ${f(-flat * gain)}" result="hi"/>`;
const paint = (pairs) => pairs.map(([cls, a], i) =>
	`<feFlood class="${cls}" result="c${i}"/><feComposite in="c${i}" in2="${a}" operator="in" result="p${i}"/>`).join('')
	+ `<feMerge>${pairs.map((_, i) => `<feMergeNode in="p${i}"/>`).join('')}</feMerge>`;
/* alpha from the red channel: a·R + b */
const alpha = (src, a, b, out) => `<feColorMatrix in="${src}" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${a} 0 0 0 ${b}" result="${out}"/>`;
const filt = (id, body, region = 'x="0" y="0" width="100%" height="100%"') =>
	`<filter id="${id}" ${region} color-interpolation-filters="sRGB">${body}</filter>`;
/* fine parallel lines, as a pattern the filters then bend */
const lines = (id, gap, weight, angle) =>
	`<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><rect class="tx-line" width="${gap}" height="${weight}"/></pattern>`;
const slab = (fill, filter) => `<rect x="-6%" y="-20%" width="112%" height="140%" fill="${fill}" filter="url(#${filter})"/>`;

const SURFACES = {
	/* cold-press paper: the tooth of a watercolour sheet, and the pulp's clouding */
	paper: sd => ({ defs: filt('tx-a', `
		<feTurbulence type="fractalNoise" baseFrequency="0.52" numOctaves="2" seed="${sd}" result="tooth"/>
		<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="${sd + 1}" result="grain"/>
		<feComposite in="tooth" in2="grain" operator="arithmetic" k2="0.55" k3="0.45" result="n"/>
		${relief('n', 1.3, 0.82, 2.6)}
		<feTurbulence type="fractalNoise" baseFrequency="0.0035 0.006" numOctaves="4" seed="${sd + 2}" result="pulp"/>
		${alpha('pulp', 1.5, -0.62, 'cloud')}
		${paint([['tx-cloud', 'cloud'], ['tx-shade', 'sh'], ['tx-light', 'hi']])}`),
		body: slab('black', 'tx-a') }),

	/* fibre paper (kozo / washi): long pulp fibres caught in the sheet — the
	   deepest creases of a turbulence field, so they come out as short curved
	   strands rather than a net */
	fibre: sd => ({ defs: filt('tx-a', `
		<feTurbulence type="turbulence" baseFrequency="0.018" numOctaves="3" seed="${sd}" result="t1"/>
		<feComponentTransfer in="t1" result="k1"><feFuncR type="table" tableValues="1 0.25 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		<feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="${sd + 4}" result="t2"/>
		<feComponentTransfer in="t2" result="k2"><feFuncR type="table" tableValues="0.55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		${alpha('k1', 1, 0, 'crack')}${alpha('k2', 1, 0, 'fine')}
		<feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="${sd + 5}" result="age"/>
		${alpha('age', 1.4, -0.55, 'cloud')}
		${paint([['tx-cloud', 'cloud'], ['tx-hair', 'fine'], ['tx-vein', 'crack']])}`),
		body: slab('black', 'tx-a') }),

	/* craquelure: the crack network in an old painting's varnish — a single
	   octave's creases, which join into closed cells, with a finer net inside */
	craquelure: sd => ({ defs: filt('tx-a', `
		<feTurbulence type="turbulence" baseFrequency="0.034" numOctaves="1" seed="${sd}" result="t1"/>
		<feComponentTransfer in="t1" result="k1"><feFuncR type="table" tableValues="0.75 0.05 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		<feTurbulence type="turbulence" baseFrequency="0.09" numOctaves="1" seed="${sd + 4}" result="t2"/>
		<feComponentTransfer in="t2" result="k2"><feFuncR type="table" tableValues="0.45 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		${alpha('k1', 1, 0, 'crack')}${alpha('k2', 1, 0, 'fine')}
		<feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="${sd + 5}" result="age"/>
		${alpha('age', 1.4, -0.55, 'cloud')}
		${paint([['tx-cloud', 'cloud'], ['tx-hair', 'fine'], ['tx-vein', 'crack']])}`),
		body: slab('black', 'tx-a') }),

	/* watered silk (moiré antique): two sets of fine threads, each bent by its
	   own slow current; where they cross, the shimmering bands appear by
	   themselves — nothing draws them */
	silk: sd => ({ defs: lines('tx-l1', 3.2, 0.7, -3) + lines('tx-l2', 3.4, 0.7, 4)
		+ filt('tx-a', `<feTurbulence type="fractalNoise" baseFrequency="0.0022 0.009" numOctaves="3" seed="${sd}" result="w"/>
			<feDisplacementMap in="SourceGraphic" in2="w" scale="34" xChannelSelector="R" yChannelSelector="G"/>`, '')
		+ filt('tx-b', `<feTurbulence type="fractalNoise" baseFrequency="0.0028 0.011" numOctaves="3" seed="${sd + 11}" result="w"/>
			<feDisplacementMap in="SourceGraphic" in2="w" scale="40" xChannelSelector="G" yChannelSelector="R"/>`, ''),
		body: slab('url(#tx-l1)', 'tx-a') + slab('url(#tx-l2)', 'tx-b') }),

	/* engraving: burin lines on the diagonal, swelling and fading with an
	   underlying tone, like the shading of an old copperplate */
	engraving: sd => ({ defs: lines('tx-l1', 4.2, 1, -34)
		+ filt('tx-a', `<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="${sd}" result="w"/>
			<feDisplacementMap in="SourceGraphic" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G" result="bent"/>
			<feTurbulence type="fractalNoise" baseFrequency="0.0045 0.008" numOctaves="4" seed="${sd + 3}" result="tone"/>
			${alpha('tone', 2.4, -0.95, 'shade')}
			<feComposite in="bent" in2="shade" operator="in"/>`, ''),
		body: slab('url(#tx-l1)', 'tx-a') }),

	/* Calacatta marble: fine veins on the diagonal, a main set and hairlines */
	marble: sd => ({ defs: filt('tx-a', `
		<feTurbulence type="turbulence" baseFrequency="0.0022 0.0068" numOctaves="6" seed="${sd}" result="t"/>
		<feComponentTransfer in="t" result="v"><feFuncR type="table" tableValues="1 0.4 0.08 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		<feTurbulence type="turbulence" baseFrequency="0.006 0.016" numOctaves="4" seed="${sd + 9}" result="t2"/>
		<feComponentTransfer in="t2" result="h"><feFuncR type="table" tableValues="0.8 0.15 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>
		${alpha('v', 1, 0, 'vein')}${alpha('h', 1, 0, 'hair')}
		<feTurbulence type="fractalNoise" baseFrequency="0.003 0.008" numOctaves="3" seed="${sd + 5}" result="n"/>
		${alpha('n', 1.6, -0.66, 'cloud')}
		${paint([['tx-cloud', 'cloud'], ['tx-hair', 'hair'], ['tx-vein', 'vein']])}`),
		body: `<g transform="rotate(-26 640 160)"><rect x="-40%" y="-160%" width="180%" height="420%" filter="url(#tx-a)"/></g>` }),
};

function surfaceSVG(kind, seed) {
	const { defs, body } = SURFACES[kind](seed % 997);
	/* a jasper wash under the grain, so the band deepens toward the right as the
	   mask lets it: darker at the edge, lighter and clearer toward the title */
	return `<svg class="pa-motif pa-tex pa-tex--${kind}" aria-hidden="true" focusable="false"><defs>${defs}</defs>`
		+ `<rect class="tx-wash" width="100%" height="100%"/>${body}</svg>`;
}

export const MOTIFS = [
	['paper', 'Texture: cold-press paper'],
	['fibre', 'Texture: fibre paper'],
	['craquelure', 'Texture: craquelure'],
	['silk', 'Texture: watered silk'],
	['engraving', 'Texture: engraving'],
	['marble', 'Texture: Calacatta marble'],
];

export function motifSVG(kind, seed) {
	return surfaceSVG(kind in SURFACES ? kind : 'paper', seed);
}
