<?php
/**
 * The homepage pattern.
 *
 * A pattern rather than a page template, because the front page's words have
 * to be editable by the people who write them. Inserting this gives a
 * complete, publishable homepage; everything in it is an ordinary block
 * afterwards.
 *
 * The hero's copy is mirrored in blocks/hero-earth/edit.js (the insert
 * template). If you change one, change the other.
 *
 * LOCKING (0.3.3, refactor plan R3). Each core-block section is a Group with
 * templateLock "contentOnly": editors change words, links and images, not the
 * structure (docs/block-conventions.md §3). The hero is NOT inside such a
 * Group, on purpose: it locks its own structure (its four acts are
 * templateLock "all", and it allows one instance per page), and a
 * contentOnly ancestor would hide its settings panel and — since its
 * attributes carry no "content" role — its act text too. A new core-block
 * section added here gets its own contentOnly Group.
 *
 * THE PAGE IT GOES ON needs four Blocksy page settings (sidebar → Blocksy's
 * page settings), or Blocksy frames it with its own title band — a second
 * <h1> above the hero's. setup-homepage.php writes them for the front page;
 * on any other page an editor sets them:
 *   Page Title                      → Disabled      (has_hero_section)
 *   Page Structure                  → no sidebar    (page_structure_type type-4)
 *   Content Area Style              → Custom, Wide  (content_style)
 *   Content Area Vertical Spacing   → Custom, None  (content_area_spacing)
 *
 * @package si-hero-earth
 */

defined( 'ABSPATH' ) || exit;

$si_content = <<<'HTML'
<!-- wp:si/hero-earth {"align":"full"} -->
<!-- wp:si/hero-act {"stage":0,"kicker":"The Schiller Institute · Since 1984","heading":"The old order is collapsing.<br>A new paradigm is ours to build.","lead":"Economic breakdown, the danger of war, a culture in decay — none of it is inevitable. Mankind is the only creative species we know of in the universe. That changes everything."} /-->
<!-- wp:si/hero-act {"stage":1,"kicker":"The New Silk Road · The Oasis Plan","heading":"Build the <em>World Land-Bridge</em>","lead":"Development corridors of rail, water and power connecting every continent — from the Bering Strait to the Gibraltar tunnel to a blooming Southwest Asia. Without the development of all nations, there can be no lasting peace."} /-->
<!-- wp:si/hero-act {"stage":2,"kicker":"Fusion · Space · The Noösphere","heading":"Then upward — the <em>extraterrestrial imperative</em>","lead":"“Lifting the human species out of its ordinary existence.” — Krafft Ehricke. Fusion power and the joint exploration of space are the common aims of mankind, and the proof that growth has no limits."} /-->
<!-- wp:si/hero-act {"stage":3,"kicker":"A Movement of World Citizens","heading":"The future needs <em>you</em>","lead":"Join a worldwide movement for peace through development and a new renaissance of classical culture.","ctaEnabled":true,"ctaPlaceholder":"Your email address","ctaButton":"Join the movement","ctaNote":"Weekly ideas, webcasts &amp; invitations. Double opt-in, unsubscribe anytime."} /-->
<!-- /wp:si/hero-earth -->

<!-- wp:group {"tagName":"section","align":"full","templateLock":"contentOnly","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}},"layout":{"type":"constrained"}} -->
<section class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)">
<!-- wp:heading {"textAlign":"center","level":2} -->
<h2 class="wp-block-heading has-text-align-center">Four ideas, one method</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">The Schiller Institute works for a new paradigm of sovereign nations united by development. Start anywhere.</p>
<!-- /wp:paragraph -->

<!-- wp:columns {"style":{"spacing":{"margin":{"top":"var:preset|spacing|50"}}}} -->
<div class="wp-block-columns" style="margin-top:var(--wp--preset--spacing--50)">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":3,"fontSize":"medium"} -->
<h3 class="wp-block-heading has-medium-font-size">The World Land-Bridge</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Rail, water and power corridors connecting every continent — and the economics that make them pay for themselves.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="#">Read the programme →</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":3,"fontSize":"medium"} -->
<h3 class="wp-block-heading has-medium-font-size">The Oasis Plan</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Peace in Southwest Asia through water, energy and reconstruction rather than through another ceasefire.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="#">Read the programme →</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":3,"fontSize":"medium"} -->
<h3 class="wp-block-heading has-medium-font-size">Fusion &amp; space</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>The extraterrestrial imperative: why the common aims of mankind are the only durable basis for peace among nations.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="#">Read the programme →</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:heading {"level":3,"fontSize":"medium"} -->
<h3 class="wp-block-heading has-medium-font-size">A classical renaissance</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Poetry, music and the scientific method — the culture a society needs before it can solve anything else.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p><a href="#">Read the programme →</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
</section>
<!-- /wp:group -->
HTML;

return array(
	'title'      => __( 'Schiller Institute homepage', 'si-hero-earth' ),
	'categories' => array( 'si-pages' ),
	'postTypes'  => array( 'page' ),
	'content'    => $si_content,
);
