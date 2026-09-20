<?php
/**
 * Articles — the entry point the child theme's functions.php requires.
 *
 *   article-format.php     render-time hygiene, outline repair, footnotes, video facade
 *   article-data.php       one article's view model (byline, terms, translations, related)
 *   article-single.php     /blog/{y}/{m}/{d}/{slug}/ inside Blocksy's single canvas
 *   articles-archive.php   /blog/ inside Blocksy's posts-listing canvas
 *
 * Nothing here runs until the page is an Article or the Posts page, and the
 * archive does nothing at all until tools/create-blog-page.php has been run.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/* The articles' CSS and JS are versioned separately from the rest of Jasper, so
   a fix here can be shipped without touching the /people/ kit — and so that a
   browser actually fetches it. A stale `?ver=` is indistinguishable from a
   broken fix; this is the second time that cost a round trip. */
const SI_ARTICLES_VERSION = '1.0.1';

require_once __DIR__ . '/article-format.php';
require_once __DIR__ . '/article-data.php';
require_once __DIR__ . '/article-single.php';
require_once __DIR__ . '/articles-archive.php';
