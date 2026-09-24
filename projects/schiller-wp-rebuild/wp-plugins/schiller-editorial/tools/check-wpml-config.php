<?php
/**
 * check-wpml-config.php — does WPML hold exactly what wpml-config.xml declares?
 *
 * For every post type, taxonomy and custom field declared in this plugin's wpml-config.xml,
 * prints what WPML has STORED: the translation mode, and whether the setting is locked by a
 * config file (WPML rebuilds the lock list each time it re-reads the files, so an item whose
 * file WPML no longer finds comes back unlocked — that is the failure this check exists for).
 * Also lists the wpml-config.xml files WPML would read right now.
 *
 * Read-only. WPML re-reads config files only when certain admin pages load (Plugins, Themes,
 * WPML → Settings …), so load wp-admin → Plugins once after any change, THEN run this.
 *
 * Run in Local → Open Site Shell, from the site root:
 *   wp eval-file wp-content/plugins/schiller-editorial/tools/check-wpml-config.php [label]
 * With a label, the report is also saved as si-v4/backups/wpml-config-check-<label>.txt.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Run with: wp eval-file check-wpml-config.php [label]\n" );
}

global $sitepress, $iclTranslationManagement;
if ( ! $sitepress || ! $iclTranslationManagement ) {
	WP_CLI::error( 'WPML (and its translation management) is not loaded.' );
}

$label = isset( $args[0] ) ? preg_replace( '/[^a-z0-9-]/', '', strtolower( $args[0] ) ) : '';
$xml   = simplexml_load_file( dirname( __DIR__ ) . '/wpml-config.xml' );
if ( ! $xml ) {
	WP_CLI::error( 'Cannot read this plugin\'s wpml-config.xml.' );
}

$out  = [];
$bad  = 0;
$tm   = $iclTranslationManagement->settings;
$lock = static function ( $list, $key ) {
	return is_array( $list ) && array_key_exists( $key, $list ) ? 'locked' : 'UNLOCKED';
};

/* 1 · Which files WPML would read (same rules as WPML_Config::load_plugins/theme_wpml_config). */
$out[] = '# files';
foreach ( (array) get_option( 'active_plugins', [] ) as $p ) {
	$f = WP_PLUGIN_DIR . '/' . dirname( $p ) . '/wpml-config.xml';
	if ( dirname( $p ) !== '.' && file_exists( $f ) ) {
		$out[] = 'plugin  ' . dirname( $p ) . '/wpml-config.xml';
	}
}
if ( get_stylesheet_directory() !== get_template_directory() && file_exists( get_stylesheet_directory() . '/wpml-config.xml' ) ) {
	$out[] = 'theme   ' . get_stylesheet() . '/wpml-config.xml';
}
if ( file_exists( get_template_directory() . '/wpml-config.xml' ) ) {
	$out[] = 'theme   ' . get_template() . '/wpml-config.xml';
}

/* 2 · Post types and taxonomies: stored sync mode vs declared, and the lock. */
/* WPML 4.8 writes post types under both names (the config updater uses
   'custom-types_sync_option', the rest of WPML 'custom_posts_sync_option'): print both,
   accept either. */
$sections = [
	'custom-types' => [ 'custom-type', [ 'custom_posts_sync_option', 'custom-types_sync_option' ], 'custom-types_readonly_config' ],
	'taxonomies'   => [ 'taxonomy', [ 'taxonomies_sync_option' ], 'taxonomies_readonly_config' ],
];
foreach ( $sections as $plural => [ $singular, $sync_keys, $ro_key ] ) {
	$out[] = "# $plural";
	foreach ( $xml->{$plural}->{$singular} as $node ) {
		$name   = (string) $node;
		$want   = (int) $node['translate'];
		$stored = [];
		$match  = false;
		foreach ( $sync_keys as $k ) {
			$sync     = (array) $sitepress->get_setting( $k, [] );
			$have     = array_key_exists( $name, $sync ) ? (int) $sync[ $name ] : null;
			$stored[] = $k . '=' . ( $have === null ? '-' : $have );
			$match    = $match || $have === $want;
		}
		$locked = $lock( isset( $tm[ $ro_key ] ) ? $tm[ $ro_key ] : null, $name );
		$ok     = $match && $locked === 'locked';
		$bad   += $ok ? 0 : 1;
		$out[]  = sprintf( '%-4s %-22s declared=%d %s %s', $ok ? 'ok' : 'BAD', $name, $want, implode( ' ', $stored ), $locked );
	}
}

/* 3 · Custom fields: stored status vs declared action, and the lock. */
$out[]   = '# custom-fields';
$modes   = [ 'ignore' => 0, 'copy' => 1, 'translate' => 2, 'copy-once' => 3 ];
$factory = $iclTranslationManagement->settings_factory();
foreach ( $xml->{'custom-fields'}->{'custom-field'} as $node ) {
	$name    = (string) $node;
	$action  = (string) $node['action'];
	$want    = isset( $modes[ $action ] ) ? $modes[ $action ] : -1;
	$setting = $factory->post_meta_setting( $name );
	$have    = (int) $setting->status();
	$locked  = $setting->is_read_only() ? 'locked' : 'UNLOCKED';
	$ok      = $have === $want && $locked === 'locked';
	$bad    += $ok ? 0 : 1;
	$out[]   = sprintf( '%-4s %-22s declared=%s(%d) stored=%d %s', $ok ? 'ok' : 'BAD', $name, $action, $want, $have, $locked );
}

$report = implode( "\n", $out ) . "\n";
WP_CLI::log( $report );

if ( $label !== '' ) {
	$dir = dirname( ABSPATH, 2 ) . '/backups';
	if ( is_dir( $dir ) && file_put_contents( "$dir/wpml-config-check-$label.txt", $report ) !== false ) {
		WP_CLI::log( "saved: backups/wpml-config-check-$label.txt" );
	} else {
		WP_CLI::warning( "could not save to $dir" );
	}
}

$bad === 0
	? WP_CLI::success( 'Every declared type, taxonomy and field is stored as declared and locked.' )
	: WP_CLI::warning( "$bad declared item(s) differ from WPML's stored settings (BAD lines above)." );
