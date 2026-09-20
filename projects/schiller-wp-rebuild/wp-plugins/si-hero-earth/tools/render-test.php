<?php
/**
 * Execute both block render files with the WordPress surface stubbed.
 *
 *     php tools/render-test.php
 *
 * Needs no WordPress, no database and no browser, so it is the cheapest
 * check that the blocks still emit the markup assets/css/si-hero.css and
 * assets/js/si-hero-scene.js are written against. Exit code is non-zero if
 * any assertion fails, so it can go in CI.
 *
 * @package si-hero-earth
 */
/* Execute the block render files with the WP surface stubbed, to prove they
 * emit the markup the preview harness was verified against. */
define( 'ABSPATH', '/tmp/' );
define( 'SI_HERO_EARTH_VERSION', '0.1.0' );
define( 'SI_HERO_EARTH_DIR', dirname( __DIR__ ) . '/' );
define( 'SI_HERO_EARTH_URL', 'https://si-v4.local/wp-content/plugins/si-hero-earth/' );

function esc_url( $u ) { return htmlspecialchars( $u, ENT_QUOTES ); }
function esc_attr( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
function esc_html( $s ) { return htmlspecialchars( (string) $s, ENT_QUOTES ); }
function esc_html_e( $s, $d = null ) { echo esc_html( $s ); }
function esc_attr_e( $s, $d = null ) { echo esc_attr( $s ); }
function __( $s, $d = null ) { return $s; }
function wp_strip_all_tags( $s ) { return strip_tags( (string) $s ); }
function wp_kses_post( $s ) { return $s; }
function wp_json_encode( $d, $f = 0 ) { return json_encode( $d, $f ); }
function add_query_arg( $k, $v, $url ) { return $url . '?' . $k . '=' . $v; }
function wp_get_attachment_image() { return '<img class="si-hero__poster" alt="">'; }
function get_block_wrapper_attributes( $extra = array() ) {
	$c = isset( $extra['class'] ) ? $extra['class'] : '';
	$s = isset( $extra['style'] ) ? ' style="' . $extra['style'] . '"' : '';
	return 'class="' . $c . ' alignfull"' . $s;
}
/* The gate is not echoed by the block: the block emits a marker, and a
 * the_content filter swaps the script in at priority 99. The test does the
 * same thing, with wptexturize's ampersand pass in between — which is the
 * whole reason the marker exists. wptexturize rewrites a bare `&` to
 * `&#038;` even inside a <script>, so an echoed gate reached the browser
 * with `&#038;&#038;` where it had written `&&`, and died on a SyntaxError
 * while the hero silently stayed static. */
const SI_HERO_EARTH_BOOT_MARKER = '<!--si-hero-boot-->';
function si_hero_earth_boot_marker() { return SI_HERO_EARTH_BOOT_MARKER; }
function si_hero_earth_boot_script() {
	/* The MINIFIED gate: that is the file production inlines. */
	return '<script id="si-hero-boot">' . file_get_contents( SI_HERO_EARTH_DIR . 'assets/js/si-hero-boot.min.js' ) . '</script>';
}
function si_hero_earth_inject_boot( $content ) {
	if ( false === strpos( $content, SI_HERO_EARTH_BOOT_MARKER ) ) { return $content; }
	$pos = strpos( $content, SI_HERO_EARTH_BOOT_MARKER );
	return str_replace( SI_HERO_EARTH_BOOT_MARKER, '', substr_replace( $content, si_hero_earth_boot_script(), $pos, strlen( SI_HERO_EARTH_BOOT_MARKER ) ) );
}
/* wp-includes/formatting.php, wptexturize(): "Replace each & with &#038;". */
function si_hero_earth_texturize_amp( $content ) {
	return preg_replace( '/&(?!#(?:\d+|x[a-f0-9]+);|[a-z1-4]{1,8};)/i', '&#038;', $content );
}

function si_hero_earth_tex( $name ) {
	return array(
		'webp' => SI_HERO_EARTH_URL . "assets/img/{$name}.webp",
		'jpg'  => SI_HERO_EARTH_URL . "assets/img/{$name}.jpg",
	);
}

/* ---- render the four acts, exactly as the parent would receive them ---- */
$acts = array(
	array( 'stage' => 0, 'kicker' => 'The Schiller Institute', 'heading' => 'The old order is collapsing.<br>A new paradigm is ours to build.', 'lead' => 'Economic breakdown...' ),
	array( 'stage' => 1, 'kicker' => 'The New Silk Road', 'heading' => 'Build the <em>World Land-Bridge</em>', 'lead' => 'Development corridors...' ),
	array( 'stage' => 2, 'kicker' => 'Fusion', 'heading' => 'Then upward', 'lead' => 'Lifting the human species...' ),
	array( 'stage' => 3, 'kicker' => 'A Movement', 'heading' => 'The future needs <em>you</em>', 'lead' => 'Join a worldwide movement.',
	       'ctaEnabled' => true, 'ctaAction' => 'https://example.org/signup', 'ctaField' => 'email',
	       'ctaPlaceholder' => 'Your email address', 'ctaButton' => 'Join the movement', 'ctaNote' => 'Double opt-in.' ),
);

$inner_html = '';
foreach ( $acts as $a ) {
	$attributes = $a; $content = ''; $block = null;
	ob_start();
	include SI_HERO_EARTH_DIR . 'blocks/hero-act/render.php';
	$inner_html .= ob_get_clean();
}

/* ---- render the parent ---- */
$attributes = array( 'mode' => 'auto', 'minWidth' => 768, 'runway' => '520vh', 'posterAlt' => '' );
$content    = $inner_html;
$block      = (object) array( 'parsed_block' => array( 'innerBlocks' => array_map(
	function ( $a ) { return array( 'blockName' => 'si/hero-act', 'attrs' => $a ); }, $acts ) ) );
ob_start();
include SI_HERO_EARTH_DIR . 'blocks/hero-earth/render.php';
$html = ob_get_clean();

/* the_content, abbreviated to the part that has bitten us. */
$html = si_hero_earth_inject_boot( si_hero_earth_texturize_amp( $html ) );

echo $html;
echo "\n\n===== CHECKS =====\n";
$checks = array(
	'section.si-hero'      => 'class="si-hero alignfull"',
	'pin'                  => 'si-hero__pin',
	'poster picture'       => 'si-hero__poster',
	'canvas'               => 'si-hero__canvas',
	'stages wrapper'       => 'si-hero__stages',
	'act 0 is h1'          => '<h1 class="si-hero__heading">',
	'act 1 is h2'          => '<h2 class="si-hero__heading">',
	'act 3 present'        => 'data-stage="3"',
	'form action'          => 'action="https://example.org/signup"',
	'sr label'             => 'screen-reader-text',
	'chapter dots'         => 'si-hero__chapters',
	'config json'          => 'si-hero__config',
	'runway var'           => '--si-hero-runway:520vh',
	'gate attrs'           => 'data-si-hero-min-width="768"',
	'gate inlined'         => '<script id="si-hero-boot">',
	'gate arms the layout' => '"is-live"',
	'gate can import'      => 'import(',
	'gate operators live'  => '&&',
);
$fail = 0;
foreach ( $checks as $label => $needle ) {
	$ok = false !== strpos( $html, $needle );
	printf( "  %-20s %s\n", $label, $ok ? 'ok' : 'FAIL' );
	if ( ! $ok ) { $fail++; }
}
preg_match_all( '/aria-label="([^"]*)"/', $html, $m );
echo "  chapter labels: " . json_encode( $m[1] ) . "\n";
preg_match( '/<script type="application\/json" class="si-hero__config">\s*(\{.*?\})\s*<\/script>/s', $html, $cm );
$cfg = $cm ? json_decode( $cm[1], true ) : null;
echo "  config parses: " . ( $cfg ? 'yes, keys=' . implode( ',', array_keys( $cfg ) ) : 'NO' ) . "\n";
echo "  h1 count: " . substr_count( $html, '<h1' ) . "\n";

/* The gate has to come AFTER the hero (it reads the element) and INSIDE the
 * block's own output (so it runs before the hero is painted). Printing it in
 * wp_footer is what made the hero visibly change shape 1.9 s in. */
$gate_at = strpos( $html, '<script id="si-hero-boot">' );
$end_at  = strpos( $html, '</section>' );
$ordered = false !== $gate_at && false !== $end_at && $gate_at > $end_at;
printf( "  %-20s %s\n", 'gate after </section>', $ordered ? 'ok' : 'FAIL' );
if ( ! $ordered ) { $fail++; }

exit( $fail ? 1 : 0 );
