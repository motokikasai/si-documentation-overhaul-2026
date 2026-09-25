<?php
/**
 * Videos — the entry point the child theme's functions.php requires.
 *
 *   video-data.php    one video's view model (the PHP twin of the payload builder)
 *   video-html.php    the pieces the page is built from
 *   video-single.php  /videos/{slug}/ inside Blocksy's single canvas
 *
 * Nothing here runs until the page is a single si_video.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/* Versioned separately from the rest of Jasper, so a fix here ships without
   touching the /people/ or Articles kits — and so a browser actually fetches
   it. It is also part of the view-model transient key: change a rule in
   video-data.php and every cached view model is rebuilt. */
const SI_VIDEOS_VERSION = '0.4.1';   // 0.4.1: a surname that is also an ordinary word cannot name a person ("the battle", German "diesen"); 0.4.0: colours and small type onto Jasper's tokens (R7/R7b); the review strip left the shipped sheet; 0.3.1: the captions are read for a unique surname too, as the text already is; 0.3.0: the captions an editor uploads — read-along, the second beside every name, the timeline's marks; 0.2.3: the end of a series is a terminus with the way to all episodes, not a line adrift; 0.2.2: the play button keeps one layer and one transform, so it does not resettle when the hover ends; 0.2.1: the people are ordered as the record names them (hosts field, then the title, then the text), not alphabetically; 0.2.0: the stage's second column takes chapters, else the names and places, else a capped tape; the timeline appears only when it has marks; 0.1.4: the long date format is translatable (German writes "1. Februar"); 0.1.3: the cached model holds the cadence weekday as a number, not a word; 0.1.2: a German page formats its dates in German; 0.1.1: a core Post is an Article in the fortnight; 0.1.0: the Programme, with what the records hold today (no captions yet)

require_once __DIR__ . '/video-data.php';
require_once __DIR__ . '/video-html.php';
require_once __DIR__ . '/video-single.php';
