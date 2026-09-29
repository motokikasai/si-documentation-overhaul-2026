<?php
/**
 * Pages — the entry point the child theme's functions.php requires.
 *
 *   page-pavilion.php   every Page (except the front page) inside Blocksy's single
 *                       canvas: the title band, the particulars card, the chapter
 *                       ribbon and the page's own sections
 *
 * The prototype is pages/templates/page-pavilion.html; its port sheet is
 * pages/README.md → "Page · The Pavilion".
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/* Versioned apart from the other kits so a fix here ships without touching
   them, and so a browser actually fetches it. */
const SI_PAGES_VERSION = '1.0.1';   // 1.0.1: own-layout pages (Legal, Join) keep Blocksy's frame; chip titles lose the parent prefix

require_once __DIR__ . '/page-pavilion.php';
