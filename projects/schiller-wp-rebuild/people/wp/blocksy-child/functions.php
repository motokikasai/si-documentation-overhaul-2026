<?php
/**
 * Blocksy Child Theme functions — Schiller Institute.
 *
 * Replaces the stub on si-v4 (which enqueued the parent's style.css: Blocksy loads its
 * own CSS, so that enqueue only added a request for an empty-ish file).
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

require_once __DIR__ . '/inc/jasper.php';           // design system: fonts, tokens, components, palette preset
require_once __DIR__ . '/inc/people-payload.php';   // /people/ data contract
require_once __DIR__ . '/inc/people-archive.php';   // /people/ inside Blocksy's archive canvas

// Which /people/ draft is live: register | gallery | chronicle
add_filter('si_people_view', static fn() => 'register');
