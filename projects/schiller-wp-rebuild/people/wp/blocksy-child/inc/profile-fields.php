<?php
/**
 * The profile's editor aids that depend on this theme's view — the "What the profile shows"
 * status box, and si_profile_clock(), which the view template also uses.
 *
 * The profile page's own fields — their registration, the "Profile page" box and its save,
 * and People → Profile guide — moved to the schiller-editorial plugin in refactor plan R8
 * (2026-09-24): wp-plugins/schiller-editorial/inc/profile-fields.php. That plugin never calls
 * this theme; it asks for a person's recordings through the `si_profile_talks` filter, which
 * profile-data.php answers. (The invitation moved there in R5.)
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

/** Seconds → "1:07:12" / "4:05". */
function si_profile_clock(int $s): string {
	$h = intdiv($s, 3600);
	$m = intdiv($s % 3600, 60);
	$sec = str_pad((string) ($s % 60), 2, '0', STR_PAD_LEFT);
	return $h ? sprintf('%d:%02d:%s', $h, $m, $sec) : sprintf('%d:%s', $m, $sec);
}

/* The status box sits beside the plugin's "Profile page" box: it previews what THIS theme's
   view will print, so it stays with the view. */
add_action('add_meta_boxes_si_person', static function () {
	add_meta_box('si-profile-status', __('What the profile shows', 'si'), 'si_profile_status_box', 'si_person', 'side', 'high');
});

/* ==========================================================================
   2 · The status box: what the public profile shows, and what is missing
   ========================================================================== */

function si_profile_status_box(WP_Post $post): void {
	if ($post->post_status === 'auto-draft') {
		echo '<p>' . esc_html__('Save the person first.', 'si') . '</p>';
		return;
	}
	$d = si_profile_build($post->ID);   // uncached: editors see the effect of their last save
	$f = $d['figures'];
	$yes = static fn($ok, $text, $fix = '') => sprintf(
		'<li class="%s"><span class="dashicons dashicons-%s" aria-hidden="true"></span><span class="si-st__text">%s%s</span></li>',
		$ok ? 'is-ok' : 'is-gap', $ok ? 'yes-alt' : 'marker', esc_html($text), (!$ok && $fix) ? '<span class="si-st__fix">' . $fix . '</span>' : ''
	);
	$new_talk = admin_url('post-new.php?post_type=si_presentation');
	$guide = admin_url('edit.php?post_type=si_person&page=si-profile-guide');
	$quote_hint = '<a href="#si-profile-fields">' . esc_html__('add', 'si') . '</a>';
	echo '<ul class="si-st">';
	/* translators: %d: number of recordings */
	echo $yes($f['talks'] > 0, $f['talks'] ? sprintf(_n('%d recording', '%d recordings', $f['talks'], 'si'), $f['talks']) : __('No recording linked', 'si'),
		'<a href="' . esc_url($new_talk) . '">' . esc_html__('add a talk', 'si') . '</a>');
	/* translators: 1: fellow speakers, 2: conferences */
	echo $yes($f['network'] > 0, $f['network'] ? sprintf(__('%1$d fellow speakers at %2$d conferences', 'si'), $f['network'], $f['conferences']) : __('No conference programme', 'si'),
		esc_html__('set the talk’s Conference', 'si'));
	echo $yes((bool) $d['photo'], $d['photo'] ? __('Portrait', 'si') : __('No portrait', 'si'), esc_html__('featured image + Photo licence', 'si'));
	echo $yes($d['archetype'] !== '', $d['archetype'] !== '' ? __('Descriptor', 'si') : __('No descriptor', 'si'));
	echo $yes($d['standfirst'] !== '', $d['standfirst'] !== '' ? __('Introduction', 'si') : __('No introduction', 'si'));
	echo $yes((bool) $d['credentials'], $d['credentials'] ? sprintf(_n('%d office', '%d offices', count($d['credentials']), 'si'), count($d['credentials'])) : __('No offices or affiliation', 'si'));
	echo $yes($d['bio_source'] === 'written', $d['bio_source'] === 'written' ? __('Written biography', 'si') : ($d['bio'] ? __('Biography generated from the archive', 'si') : __('No biography', 'si')),
		esc_html__('write it in the main text', 'si'));
	/* translators: %d: number of quotes */
	echo $yes((bool) $d['quotes'], $d['quotes'] ? sprintf(_n('%d quote', '%d quotes', count($d['quotes']), 'si'), count($d['quotes'])) : __('No quotes', 'si'), $f['talks'] ? $quote_hint : '');
	/* translators: %d: number of articles, statements or press items */
	echo $yes((bool) $d['writing'], $d['writing'] ? sprintf(_n('%d article or press item', '%d articles or press items', count($d['writing']), 'si'), count($d['writing'])) : __('No writing or press linked', 'si'));
	echo '</ul>';
	printf('<p><a class="button" href="%s" target="_blank">%s</a> <a href="%s">%s</a></p>', esc_url(get_permalink($post)), esc_html__('View profile', 'si'), esc_url($guide), esc_html__('Profile guide', 'si'));
	?>
	<style>
		.si-st { margin: 0; }
		.si-st li { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: start; margin: 0 0 8px; }
		.si-st__text { display: grid; gap: 1px; line-height: 1.4; }
		.si-st .is-ok .dashicons { color: #1f7a3d; }
		.si-st .is-gap { color: #50575e; }
		.si-st .is-gap .dashicons { color: #a08040; }
		.si-st__fix { font-size: 12px; color: #646970; }
	</style>
	<?php
}
