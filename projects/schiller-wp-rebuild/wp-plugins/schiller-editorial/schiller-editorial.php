<?php
/**
 * Plugin Name:       Schiller Institute — Editorial Toolkit
 * Plugin URI:        https://schillerinstitute.com/
 * Description:       How editors write and present content: page patterns, block styles, field bindings, and the site's WPML translation settings. What the content is (types, taxonomies, fields) lives in the mu-plugin schiller-content-model-v3.
 * Version:           0.3.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Schiller Institute site rebuild
 * License:           GPL-2.0-or-later
 * Text Domain:       si
 *
 * @package schiller-editorial
 *
 * WHY THIS PLUGIN
 * Content structure does not belong in the theme (docs/block-conventions.md). This is where
 * it goes: the theme stays presentation, and a theme change can never take the site's
 * translation settings or its page patterns with it.
 *
 * 0.1.0 wpml-config.xml (refactor plan R2). 0.2.0 the first block style variations (R4).
 * 0.3.0 the profile invitation's synced pattern, moved out of the theme (R5).
 *
 * WPML reads wpml-config.xml from the root of an ACTIVE plugin — deactivating this plugin
 * un-declares every si_* type, taxonomy and field for WPML. Keep it active.
 */

defined( 'ABSPATH' ) || exit;

define( 'SCHILLER_EDITORIAL_VERSION', '0.3.0' );
define( 'SCHILLER_EDITORIAL_FILE', __FILE__ );

require_once __DIR__ . '/inc/block-styles.php';
require_once __DIR__ . '/inc/profile-invitation.php';
