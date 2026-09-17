<?php
/**
 * Jasper — the Schiller Institute design system, wired into the Blocksy child theme.
 *
 * What this file does, and deliberately does not do:
 *  - enqueues the self-hosted fonts, the token layer and the component layer AFTER
 *    Blocksy's own stylesheet ('ct-main-styles'), so Jasper reads Blocksy's variables;
 *  - offers the Jasper palette as a preset in Customizer → Colors (Blocksy's own filter);
 *  - loads the same fonts/tokens into the block editor so authors see the real type;
 *  - does NOT write any Customizer value. Palette and typography are written once, on
 *    purpose, by tools/apply-design-system.php (reversible), and stay editable in the
 *    Customizer afterwards. Nothing here overrides a Blocksy setting at runtime.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

const SI_JASPER_VERSION = '1.0.0';

function si_jasper_uri(string $path): string {
	return get_stylesheet_directory_uri() . '/assets/jasper/' . ltrim($path, '/');
}

add_action('wp_enqueue_scripts', static function () {
	$after = wp_style_is('ct-main-styles', 'registered') ? ['ct-main-styles'] : [];
	wp_enqueue_style('si-jasper-fonts', si_jasper_uri('fonts.css'), [], SI_JASPER_VERSION);
	wp_enqueue_style('si-jasper-tokens', si_jasper_uri('tokens.css'), array_merge($after, ['si-jasper-fonts']), SI_JASPER_VERSION);
	wp_enqueue_style('si-jasper-components', si_jasper_uri('components.css'), ['si-jasper-tokens'], SI_JASPER_VERSION);
}, 20);

/* html.js before first paint: .si-js-only controls appear only when they can work. */
add_action('wp_head', static function () {
	echo "<script>document.documentElement.classList.add('js')</script>\n";
}, 1);

/* The reading face is on every page: fetch its Latin cut with the HTML. */
add_action('wp_head', static function () {
	printf(
		'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
		esc_url(si_jasper_uri('fonts/source-serif-4-normal-latin.woff2'))
	);
}, 2);

/* Customizer → Colors → Global palette → presets. Blocksy's own extension point. */
add_filter('blocksy:options:colors:palette:palettes', static function (array $palettes): array {
	array_unshift($palettes, si_jasper_palette() + ['id' => 'si-jasper']);
	return $palettes;
});

/** The eight Blocksy slots. Single source for the preset AND the apply script. */
function si_jasper_palette(): array {
	$hex = ['#1F4A73', '#163754', '#3D4550', '#121A24', '#D8DDE3', '#E9EDF1', '#F6F6F3', '#FFFFFF'];
	$names = ['Berliner Blau', 'Berliner Blau, deep', 'Slate', 'Iron-gall', 'Hairline', 'Jasper mist', 'Limestone', 'Paper'];
	$out = [];
	foreach ($hex as $i => $color) {
		$out['color' . ($i + 1)] = ['color' => $color, 'title' => $names[$i]];
	}
	return $out;
}

/* Block editor: same faces and tokens, so what authors see is what readers get. */
add_action('after_setup_theme', static function () {
	add_editor_style([
		'assets/jasper/fonts.css',
		'assets/jasper/tokens.css',
		'assets/jasper/components.css',
	]);
});
