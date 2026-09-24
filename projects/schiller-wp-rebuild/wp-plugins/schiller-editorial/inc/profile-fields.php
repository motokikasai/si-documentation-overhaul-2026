<?php
/**
 * The profile page's own fields — the editor side of /people/{slug}/ (refactor plan R8).
 *
 * Fields (post meta on si_person; WPML: this plugin's wpml-config.xml):
 *   si_descriptor      "Statesman & soldier"                     translate
 *   si_introduction    the one-sentence introduction             translate
 *   si_offices         one office per line: "Organisation | Role" translate
 *   si_quotes          JSON [{text, talk, t, hero, verified}]    copy (a quote stays in the language it was spoken)
 *   si_quote_context   one line per quote, same order            translate
 *   si_notable         "Public figure": named in other profiles' "Among them …" line   copy
 *
 * Here: the fields' registration, the "Profile page" box and its save, and the Profile guide
 * (People → Profile guide). Moved from blocksy-child/inc/profile-fields.php on 2026-09-24 with
 * every stored identifier unchanged — meta keys, form field names, nonce, admin page slug —
 * so existing profiles and their translations are untouched.
 *
 * What stays in the theme, on purpose: the "What the profile shows" status box and
 * si_profile_clock(), because they preview and format the theme's own view. The plugin never
 * calls a theme function: the one thing it needs from the view — which recordings are this
 * person's — arrives through the `si_profile_talks` filter, which the theme provides.
 *
 * Why not Pods fields and Block Bindings (the refactor plan's rung C4): the profile is a
 * server-rendered view, not block content, so there is nothing for a binding to bind; and
 * the quotes need their own editor (recording, time, hero, context). Revisit if the profile
 * is ever rebuilt from blocks.
 *
 * Helpers carry an si_editorial_ prefix so no name here can ever collide with the theme's.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

const SI_EDITORIAL_PROFILE_META = array( 'si_descriptor', 'si_introduction', 'si_offices', 'si_quotes', 'si_quote_context', 'si_notable' );

/* The handover: a theme that still carries its own copy of the box (before R8) keeps it, and
   this module stays out of the way — one box, one save, one menu entry, whichever side has it.
   after_setup_theme is the first hook at which the theme's functions exist. */
add_action( 'after_setup_theme', static function () {
	if ( function_exists( 'si_profile_fields_box' ) ) {
		return;
	}

	add_action( 'init', static function () {
		foreach ( SI_EDITORIAL_PROFILE_META as $key ) {
			register_post_meta( 'si_person', $key, array(
				'type'          => $key === 'si_notable' ? 'boolean' : 'string',
				'single'        => true,
				'show_in_rest'  => false,
				'auth_callback' => static fn( $allowed, $meta_key, $post_id ) => current_user_can( 'edit_post', $post_id ),
			) );
		}
	} );

	add_action( 'add_meta_boxes_si_person', static function () {
		add_meta_box( 'si-profile-fields', __( 'Profile page', 'si' ), 'si_editorial_profile_fields_box', 'si_person', 'normal', 'high' );
	} );

	add_action('save_post_si_person', static function (int $post_id) {
		if (!isset($_POST['si_profile_nonce']) || !wp_verify_nonce(sanitize_key($_POST['si_profile_nonce']), 'si_profile_fields')
			|| (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post', $post_id)) {
			return;
		}
		$in = wp_unslash($_POST);
		foreach (['si_descriptor' => 'sanitize_text_field', 'si_introduction' => 'sanitize_textarea_field', 'si_offices' => 'sanitize_textarea_field'] as $k => $clean) {
			$v = $clean($in[$k] ?? '');
			$v === '' ? delete_post_meta($post_id, $k) : update_post_meta($post_id, $k, $v);
		}

		if (!si_editorial_profile_is_original($post_id)) {
			// a translation: only the context lines are its own
			$v = sanitize_textarea_field($in['si_quote_context'] ?? '');
			$v === '' ? delete_post_meta($post_id, 'si_quote_context') : update_post_meta($post_id, 'si_quote_context', $v);
			return;
		}

		!empty($in['si_notable']) ? update_post_meta($post_id, 'si_notable', 1) : delete_post_meta($post_id, 'si_notable');

		if (isset($in['si_q']['text'])) {
			$q = $in['si_q'];
			$hero = isset($in['si_q_hero']) ? (int) $in['si_q_hero'] : -1;
			$quotes = [];
			$contexts = [];
			foreach ($q['text'] as $i => $text) {
				$text = trim(sanitize_textarea_field($text));
				$t = si_editorial_profile_parse_time((string) ($q['t'][$i] ?? ''));
				if ($text === '' || $t === null) {
					continue;   // a quote needs its words and its second
				}
				$quotes[] = ['text' => $text, 'talk' => (int) ($q['talk'][$i] ?? 0), 't' => $t, 'hero' => $i === $hero, 'verified' => !empty($q['verified'][$i])];
				$contexts[] = trim(sanitize_text_field($q['context'][$i] ?? ''));
			}
			$quotes ? update_post_meta($post_id, 'si_quotes', wp_slash(wp_json_encode($quotes, JSON_UNESCAPED_UNICODE))) : delete_post_meta($post_id, 'si_quotes');
			array_filter($contexts) ? update_post_meta($post_id, 'si_quote_context', implode("\n", $contexts)) : delete_post_meta($post_id, 'si_quote_context');
		}
	});

	add_action( 'admin_menu', static function () {
		add_submenu_page( 'edit.php?post_type=si_person', __( 'Profile guide', 'si' ), __( 'Profile guide', 'si' ), 'edit_posts', 'si-profile-guide', static function () {
			include dirname( __DIR__ ) . '/templates/profile-guide.php';
		} );
	} );
} );

/** The original (default-language) record of a WPML translation, or the post itself. */
function si_editorial_profile_original( int $id, string $type ): int {
	$default = apply_filters( 'wpml_default_language', null );
	return $default ? (int) apply_filters( 'wpml_object_id', $id, $type, true, $default ) : $id;
}

/** The stored quotes that have words and a recording. */
function si_editorial_profile_quotes( int $orig ): array {
	$raw = json_decode( (string) get_post_meta( $orig, 'si_quotes', true ), true );
	return array_values( array_filter( is_array( $raw ) ? $raw : array(), static fn( $q ) => is_array( $q ) && trim( $q['text'] ?? '' ) !== '' && ! empty( $q['talk'] ) ) );
}

/** "1:07:12" / "67:12" / "4032" -> seconds; '' when it cannot be read. */
function si_editorial_profile_parse_time(string $s): ?int {
	$s = trim($s);
	if (preg_match('/^\d+$/', $s)) {
		return (int) $s;
	}
	if (!preg_match('/^(?:(\d+):)?(\d{1,2}):(\d{2})$/', $s, $m)) {
		return null;
	}
	return (int) $m[1] * 3600 + (int) $m[2] * 60 + (int) $m[3];
}

function si_editorial_profile_clock(int $s): string {
	$h = intdiv($s, 3600);
	$m = intdiv($s % 3600, 60);
	$sec = str_pad((string) ($s % 60), 2, '0', STR_PAD_LEFT);
	return $h ? sprintf('%d:%02d:%s', $h, $m, $sec) : sprintf('%d:%s', $m, $sec);
}

/** Is this the original (default-language) record? Quotes are edited there only. */
function si_editorial_profile_is_original(int $post_id): bool {
	return si_editorial_profile_original($post_id, 'si_person') === $post_id;
}

function si_editorial_profile_fields_box(WP_Post $post): void {
	wp_nonce_field('si_profile_fields', 'si_profile_nonce');
	$get = static fn($k) => (string) get_post_meta($post->ID, $k, true);
	$original = si_editorial_profile_is_original($post->ID);
	$orig_id = si_editorial_profile_original($post->ID, 'si_person');
	$quotes = si_editorial_profile_quotes($orig_id);
	$contexts = preg_split('/\R/', $get('si_quote_context'));
	$talks = apply_filters('si_profile_talks', null, $orig_id);   // the theme's profile view knows which recordings are this person's
	$guide = admin_url('edit.php?post_type=si_person&page=si-profile-guide');
	?>
	<div class="si-pf">
		<p class="si-pf__intro"><?php
			/* translators: %s: link to the profile guide */
			printf(esc_html__('These fields fill the top of the public profile. Every one is optional: an empty field simply does not appear. %s', 'si'),
				'<a href="' . esc_url($guide) . '">' . esc_html__('Which field fills which line →', 'si') . '</a>');
		?></p>

		<p class="si-pf__row">
			<label for="si_descriptor"><?php esc_html_e('Descriptor', 'si'); ?></label>
			<input type="text" id="si_descriptor" name="si_descriptor" value="<?php echo esc_attr($get('si_descriptor')); ?>" placeholder="<?php esc_attr_e('e.g. Statesman & soldier · Scientist · Composer', 'si'); ?>">
			<span class="description"><?php esc_html_e('Two or three words, shown in small capitals above the name.', 'si'); ?></span>
		</p>

		<p class="si-pf__row">
			<label for="si_introduction"><?php esc_html_e('Introduction', 'si'); ?></label>
			<textarea id="si_introduction" name="si_introduction" rows="2" placeholder="<?php esc_attr_e('One sentence: who this person is and why their voice matters.', 'si'); ?>"><?php echo esc_textarea($get('si_introduction')); ?></textarea>
			<span class="description"><?php esc_html_e('One sentence, no pronouns needed. Shown large under the name.', 'si'); ?></span>
		</p>

		<p class="si-pf__row">
			<label for="si_offices"><?php esc_html_e('Offices held', 'si'); ?></label>
			<textarea id="si_offices" name="si_offices" rows="3" placeholder="<?php esc_attr_e("U.S. Marine Corps | Helicopter pilot · 269 combat missions\nThe Pentagon | Chief, Criminal Law Division", 'si'); ?>"><?php echo esc_textarea($get('si_offices')); ?></textarea>
			<span class="description"><?php esc_html_e('One per line: Organisation | Role. Up to three read best. Empty: the Affiliation field is shown instead.', 'si'); ?></span>
		</p>

		<p class="si-pf__row si-pf__row--check">
			<label><input type="checkbox" name="si_notable" value="1" <?php checked((bool) get_post_meta($orig_id, 'si_notable', true)); ?> <?php disabled(!$original); ?>>
			<?php esc_html_e('Public figure — name this person in the “Among them …” line on the profiles of people who shared a conference with them', 'si'); ?></label>
		</p>

		<h3 class="si-pf__h"><?php esc_html_e('Quotes', 'si'); ?></h3>
		<?php if (!$original): ?>
			<p class="description"><?php esc_html_e('Quotes are added on the original-language record and stay in the language they were spoken. Translate the context lines here, one per quote, in the same order:', 'si'); ?></p>
			<ol class="si-pf__ro"><?php foreach ($quotes as $q): ?><li>“<?php echo esc_html($q['text']); ?>”</li><?php endforeach; ?></ol>
			<p class="si-pf__row"><textarea name="si_quote_context" rows="<?php echo max(2, count($quotes)); ?>"><?php echo esc_textarea($get('si_quote_context')); ?></textarea></p>
		<?php elseif ($talks === null): ?>
			<p class="description"><?php esc_html_e('The list of recordings comes from the site theme’s profile view, which is not active. Quotes can be edited again once it is.', 'si'); ?></p>
		<?php elseif (!$talks): ?>
			<p class="description"><?php esc_html_e('Quotes need a recording. Link this person to a talk first (Presentation → Presenter(s)), then come back.', 'si'); ?></p>
		<?php else: ?>
			<p class="description"><?php esc_html_e('On youtube.com, open the talk, click “…more” → “Show transcript”, copy a sentence and the time beside it. Fix capitals and punctuation; mark any word you change in [brackets].', 'si'); ?></p>
			<div class="si-pf__quotes" data-quotes>
				<?php foreach (array_merge($quotes, [[]]) as $i => $q): $blank = !$q; ?>
				<fieldset class="si-pf__quote"<?php echo $blank ? ' data-template hidden' : ''; ?>>
					<textarea name="si_q[text][]" rows="3" placeholder="<?php esc_attr_e('The sentence, as spoken', 'si'); ?>"><?php echo esc_textarea($q['text'] ?? ''); ?></textarea>
					<div class="si-pf__qrow">
						<label><?php esc_html_e('Recording', 'si'); ?>
							<select name="si_q[talk][]">
								<?php foreach ($talks as $t): ?>
									<option value="<?php echo esc_attr($t['id']); ?>" <?php selected((string) ($q['talk'] ?? ''), $t['id']); ?>><?php echo esc_html(($t['year'] ? $t['year'] . ' · ' : '') . wp_trim_words($t['title'], 12)); ?></option>
								<?php endforeach; ?>
							</select></label>
						<label><?php esc_html_e('Time in the video', 'si'); ?>
							<input type="text" name="si_q[t][]" value="<?php echo isset($q['t']) ? esc_attr(si_editorial_profile_clock((int) $q['t'])) : ''; ?>" placeholder="1:07:12" size="8"></label>
						<label class="si-pf__hero"><input type="radio" name="si_q_hero" value="<?php echo (int) $i; ?>" <?php checked(!empty($q['hero'])); ?>> <?php esc_html_e('Use in the hero', 'si'); ?></label>
						<button type="button" class="button-link si-pf__remove" data-remove><?php esc_html_e('Remove', 'si'); ?></button>
					</div>
					<input type="text" name="si_q[context][]" value="<?php echo esc_attr($contexts[$i] ?? ''); ?>" placeholder="<?php esc_attr_e('Context (optional), e.g. Speaking after former U.S. Attorney General Ramsey Clark', 'si'); ?>">
					<input type="hidden" name="si_q[verified][]" value="<?php echo !empty($q['verified']) ? '1' : ''; ?>">
				</fieldset>
				<?php endforeach; ?>
				<button type="button" class="button" data-add><?php esc_html_e('Add a quote', 'si'); ?></button>
			</div>
		<?php endif; ?>
	</div>
	<style>
		.si-pf__intro { margin-top: 0; }
		.si-pf__row { display: grid; gap: 4px; margin: 0 0 14px; }
		.si-pf__row label { font-weight: 600; }
		.si-pf__row input[type=text], .si-pf__row textarea { width: 100%; }
		.si-pf__row--check label { font-weight: 400; }
		.si-pf__h { margin: 22px 0 4px; font-size: 14px; }
		.si-pf__quote { display: grid; gap: 8px; margin: 12px 0; padding: 12px; border: 1px solid #dcdcde; border-left: 3px solid #a08040; background: #fcfcfc; }
		.si-pf__quote textarea, .si-pf__quote input[type=text][name^="si_q[context]"] { width: 100%; }
		.si-pf__qrow { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: end; }
		.si-pf__qrow label { display: grid; gap: 2px; font-size: 12px; }
		.si-pf__qrow select { max-width: 360px; }
		.si-pf__hero { display: flex !important; align-items: center; gap: 4px; }
		.si-pf__remove { color: #b32d2e; margin-left: auto; }
		.si-pf__ro { font-style: italic; }
	</style>
	<script>
	(() => {
		const box = document.querySelector('[data-quotes]');
		if (!box) return;
		const tpl = box.querySelector('[data-template]');
		const renumber = () => box.querySelectorAll('.si-pf__quote:not([data-template]) input[name="si_q_hero"]').forEach((r, i) => r.value = i);
		box.addEventListener('click', e => {
			if (e.target.matches('[data-add]')) {
				const q = tpl.cloneNode(true);
				q.hidden = false; q.removeAttribute('data-template');
				box.insertBefore(q, tpl);
				renumber();
				q.querySelector('textarea').focus();
			}
			if (e.target.matches('[data-remove]')) { e.target.closest('.si-pf__quote').remove(); renumber(); }
		});
		// the hidden template row must not be submitted
		box.closest('form').addEventListener('submit', () => tpl.remove());
		renumber();
	})();
	</script>
	<?php
}
