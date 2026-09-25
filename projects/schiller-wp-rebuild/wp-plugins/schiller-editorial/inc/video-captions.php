<?php
/**
 * Captions for a Video — the file an editor uploads, and what the page makes of it.
 *
 * The no-API model (videos/README.md §10): nothing here asks YouTube anything. An
 * editor downloads the caption file from YouTube Studio and uploads it here; this
 * parses it into timed lines and stores them on the record. The page then has the
 * read-along, the second beside every name, and the timeline's marks.
 *
 * Stored on the post:
 *   si_caption_file    attachment ID of the .vtt/.srt the editor uploaded
 *   _si_caption_lines  JSON [[second, text], …] — what the page reads
 *   _si_caption_words  how many words, for the figures
 *   _si_duration       the last cue's end, in seconds
 *   transcript         the plain text (the Pods field the content model reserves)
 *   transcript_auto    1 — YouTube's captions are automatic until an editor says otherwise
 *
 * Nothing is corrected or generated here: the lines are the file's own words.
 *
 * @package schiller-editorial
 */

defined( 'ABSPATH' ) || exit;

const SI_CAPTION_META = [ 'si_caption_file', '_si_caption_lines', '_si_caption_words', '_si_duration' ];

add_action( 'init', static function () {
	register_post_meta( 'si_video', 'si_caption_file', [
		'type'          => 'integer',
		'single'        => true,
		'show_in_rest'  => false,
		'auth_callback' => static fn( $allowed, $meta_key, $post_id ) => current_user_can( 'edit_post', $post_id ),
	] );
} );

/* ---- the parser ------------------------------------------------------------
 * WebVTT and SubRip, and the rolling form YouTube's automatic captions come in,
 * where each cue repeats the line before it and adds the new words with their own
 * timestamps. Only the new words are kept, so the text does not triple.
 */

/**
 * @return array{lines: array<int, array{0: float, 1: string}>, duration: int}
 */
function si_captions_parse( string $raw ): array {
	$raw  = str_replace( [ "\r\n", "\r" ], "\n", $raw );
	$time = '(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}';
	/* Word-timed or not is a property of the FILE, not of a cue. YouTube's automatic
	   captions roll: a plain cue repeats the line before it, and the next cue carries
	   the new words with their own timestamps. In such a file the plain cues are the
	   repetition and must be skipped entirely — reading them too doubles the
	   transcript (10,925 words where the record holds 5,448). */
	$worded = str_contains( $raw, '<c>' );
	$cues   = [];
	$last_end = 0.0;

	foreach ( preg_split( '/\n{2,}/', $raw ) as $block ) {
		if ( ! preg_match( "/($time)\s*-->\s*($time)/", $block, $m ) ) {
			continue;
		}
		$start    = si_captions_secs( $m[1] );
		$last_end = max( $last_end, si_captions_secs( $m[3] ) );
		$text     = trim( (string) preg_replace( "/^.*$time\s*-->.*$/m", '', $block ) );
		if ( $text === '' ) {
			continue;
		}
		if ( $worded ) {
			foreach ( explode( "\n", $text ) as $line ) {
				if ( ! str_contains( $line, '<c>' ) ) {
					continue;   // the rolling repetition
				}
				$head = trim( (string) preg_replace( '/<.*$/s', '', $line ) );
				if ( $head !== '' ) {
					$cues[] = [ $start, $head ];
				}
				if ( preg_match_all( "/<($time)><c>(.*?)<\/c>/", $line, $w, PREG_SET_ORDER ) ) {
					foreach ( $w as $one ) {
						$tok = trim( wp_strip_all_tags( $one[3] ) );
						if ( $tok !== '' ) {
							$cues[] = [ si_captions_secs( $one[1] ), $tok ];
						}
					}
				}
			}
			continue;
		}
		$text = trim( (string) preg_replace( '/\s+/u', ' ',
			wp_strip_all_tags( html_entity_decode( $text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) ) );
		if ( $text !== '' ) {
			$cues[] = [ $start, $text ];
		}
	}
	if ( ! $cues ) {
		return [ 'lines' => [], 'duration' => 0 ];
	}
	// word-timed input arrives one word at a time: gather it into readable lines
	$lines = $worded ? si_captions_lines_from_words( $cues ) : si_captions_dedupe( $cues );

	return [ 'lines' => $lines, 'duration' => (int) ceil( $last_end ) ];
}

function si_captions_secs( string $ts ): float {
	$ts = str_replace( ',', '.', trim( $ts ) );
	$parts = array_reverse( explode( ':', $ts ) );
	$s = 0.0;
	foreach ( $parts as $i => $v ) {
		$s += (float) $v * ( 60 ** $i );
	}
	return $s;
}

/**
 * Words with their own seconds → lines. A line closes on sentence punctuation, on a
 * pause of more than 1.6 seconds, or at 32 words — the older tracks carry no
 * punctuation at all, so the pause has to do the work.
 */
function si_captions_lines_from_words( array $words ): array {
	$out = [];
	$cur = [];
	$t0 = null;
	$last = null;
	foreach ( $words as [ $t, $w ] ) {
		if ( $cur && $last !== null && $t - $last > 1.6 && count( $cur ) >= 8 ) {
			$out[] = [ round( (float) $t0, 1 ), implode( ' ', $cur ) ];
			$cur = [];
			$t0 = null;
		}
		if ( ! $cur ) {
			$t0 = $t;
		}
		$cur[] = $w;
		$last = $t;
		$endish = in_array( substr( $w, -1 ), [ '.', '?', '!' ], true );
		if ( ( $endish && count( $cur ) >= 5 ) || count( $cur ) >= 32 ) {
			$out[] = [ round( (float) $t0, 1 ), implode( ' ', $cur ) ];
			$cur = [];
			$t0 = null;
		}
	}
	if ( $cur ) {
		$out[] = [ round( (float) $t0, 1 ), implode( ' ', $cur ) ];
	}
	return $out;
}

/** Plain cues: drop a line that only repeats the one before it (the rolling form). */
function si_captions_dedupe( array $cues ): array {
	$out = [];
	foreach ( $cues as [ $t, $text ] ) {
		$prev = $out ? $out[ count( $out ) - 1 ][1] : '';
		if ( $prev !== '' && ( $text === $prev || str_starts_with( $text, $prev ) ) ) {
			$add = trim( substr( $text, strlen( $prev ) ) );
			if ( $add === '' ) {
				continue;
			}
			$out[] = [ round( (float) $t, 1 ), $add ];
			continue;
		}
		$out[] = [ round( (float) $t, 1 ), $text ];
	}
	return $out;
}

/* ---- storing ---------------------------------------------------------------- */

/** Parse whatever is attached and write what the page reads. Returns the line count. */
function si_captions_rebuild( int $post_id ): int {
	$file_id = (int) get_post_meta( $post_id, 'si_caption_file', true );
	$path    = $file_id ? get_attached_file( $file_id ) : '';
	if ( ! $path || ! file_exists( $path ) ) {
		foreach ( [ '_si_caption_lines', '_si_caption_words', '_si_duration' ] as $k ) {
			delete_post_meta( $post_id, $k );
		}
		delete_post_meta( $post_id, 'transcript' );
		delete_post_meta( $post_id, 'transcript_auto' );
		return 0;
	}
	$parsed = si_captions_parse( (string) file_get_contents( $path ) );
	if ( ! $parsed['lines'] ) {
		return 0;
	}
	$text  = implode( ' ', array_column( $parsed['lines'], 1 ) );
	$words = str_word_count( $text );
	update_post_meta( $post_id, '_si_caption_lines', wp_slash( wp_json_encode( $parsed['lines'], JSON_UNESCAPED_UNICODE ) ) );
	update_post_meta( $post_id, '_si_caption_words', $words );
	update_post_meta( $post_id, '_si_duration', $parsed['duration'] );
	update_post_meta( $post_id, 'transcript', wp_slash( $text ) );
	update_post_meta( $post_id, 'transcript_auto', 1 );
	return count( $parsed['lines'] );
}

/* ---- the edit screen ---------------------------------------------------------- */

add_action( 'add_meta_boxes_si_video', static function () {
	/* `normal`/`high` puts the box directly under the content. In the block editor a
	   `side` box is pushed to the foot of the settings sidebar, where editors do not
	   find it. */
	add_meta_box( 'si-video-captions', __( 'Captions & chapters', 'si' ), 'si_captions_box', 'si_video', 'normal', 'high' );
} );

/** The picker needs the media library; the block editor does not always load it. */
add_action( 'admin_enqueue_scripts', static function ( $hook ) {
	if ( in_array( $hook, [ 'post.php', 'post-new.php' ], true ) && get_post_type() === 'si_video' ) {
		wp_enqueue_media();
	}
} );

function si_captions_box( WP_Post $post ): void {
	wp_nonce_field( 'si_captions', 'si_captions_nonce' );
	$file_id = (int) get_post_meta( $post->ID, 'si_caption_file', true );
	$lines   = (int) count( (array) json_decode( (string) get_post_meta( $post->ID, '_si_caption_lines', true ), true ) );
	$words   = (int) get_post_meta( $post->ID, '_si_caption_words', true );
	$dur     = (int) get_post_meta( $post->ID, '_si_duration', true );
	$name    = $file_id ? basename( (string) get_attached_file( $file_id ) ) : '';

	// chapters come from the post text, not from the caption file
	$chapters = si_captions_count_timestamps( $post->post_content );
	?>
	<div class="si-captions-box" style="display:grid;gap:1.2em;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);align-items:start">
		<p style="margin-top:0">
			<strong><?php esc_html_e( 'Caption file', 'si' ); ?></strong><br>
			<span class="si-cap-name" style="word-break:break-all"><?php
				echo $name ? esc_html( $name ) : '<em>' . esc_html__( 'none uploaded', 'si' ) . '</em>';
			?></span>
		</p>
		<input type="hidden" name="si_caption_file" id="si_caption_file" value="<?php echo esc_attr( (string) $file_id ); ?>">
		<p>
			<button type="button" class="button" id="si-cap-pick"><?php esc_html_e( 'Choose file…', 'si' ); ?></button>
			<button type="button" class="button-link si-cap-clear" id="si-cap-clear" style="color:#b32d2e<?php echo $file_id ? '' : ';display:none'; ?>"><?php esc_html_e( 'Remove', 'si' ); ?></button>
		</p>
		<?php if ( $lines ) : ?>
			<p style="color:#1F4A73">
				<?php
				printf(
					/* translators: 1: how many caption lines, 2: how many words, 3: the length, m:ss. */
					esc_html__( '%1$s lines · %2$s words · %3$s', 'si' ),
					esc_html( number_format_i18n( $lines ) ),
					esc_html( number_format_i18n( $words ) ),
					esc_html( $dur ? sprintf( '%d:%02d', intdiv( $dur, 60 ), $dur % 60 ) : '—' )
				);
				?>
			</p>
		<?php endif; ?>

		<div>
		<p style="margin-bottom:.4em"><strong><?php esc_html_e( 'What each thing switches on', 'si' ); ?></strong></p>
		<ol style="margin:0 0 .8em 1.2em;padding:0">
			<li style="margin-bottom:.5em">
				<strong><?php esc_html_e( 'The YouTube link', 'si' ); ?></strong> —
				<?php esc_html_e( 'paste it into the text. It gives the player, the people and places named in your text, the series and the fortnight around it.', 'si' ); ?>
			</li>
			<li style="margin-bottom:.5em">
				<strong><?php esc_html_e( 'The description with its timestamps', 'si' ); ?></strong> —
				<?php esc_html_e( 'paste lines like “12:09 Question on the situation in Germany” into the text. They become the chapter list beside the video, and are not shown twice.', 'si' ); ?>
				<br><em><?php
					echo $chapters >= 3
						? esc_html( sprintf(
							/* translators: %d: how many chapter lines were found. */
							_n( '%d chapter line found in this text.', '%d chapter lines found in this text.', $chapters, 'si' ),
							$chapters
						) )
						: esc_html__( 'No chapter lines in this text yet.', 'si' );
				?></em>
			</li>
			<li>
				<strong><?php esc_html_e( 'The caption file', 'si' ); ?></strong> —
				<?php esc_html_e( 'in YouTube Studio open Subtitles, then the video, then Download under the language, and upload the .vtt or .srt here. It gives the read-along text, the moment each person is named, and the timeline.', 'si' ); ?>
			</li>
		</ol>
		<p style="color:#646970;margin-bottom:0"><?php esc_html_e( 'Everything is recomputed when you press Update, so a file added months later works the same way.', 'si' ); ?></p>
		</div>
	</div>
	<script>
	jQuery(function ($) {
		var frame;
		$('#si-cap-pick').on('click', function (e) {
			e.preventDefault();
			frame = frame || wp.media({
				title: <?php echo wp_json_encode( __( 'Choose a caption file', 'si' ) ); ?>,
				button: { text: <?php echo wp_json_encode( __( 'Use this file', 'si' ) ); ?> },
				multiple: false
			});
			frame.off('select').on('select', function () {
				var a = frame.state().get('selection').first().toJSON();
				$('#si_caption_file').val(a.id);
				$('.si-cap-name').text(a.filename || a.title);
				$('#si-cap-clear').show();
			});
			frame.open();
		});
		$('#si-cap-clear').on('click', function (e) {
			e.preventDefault();
			$('#si_caption_file').val('');
			$('.si-cap-name').html('<em><?php echo esc_js( __( 'none uploaded', 'si' ) ); ?></em>');
			$(this).hide();
		});
	});
	</script>
	<?php
}

/** How many lines of the post text look like "12:09 Something" (three make chapters). */
function si_captions_count_timestamps( string $html ): int {
	$text = preg_replace( '~(?i)<br\s*/?>|</(p|div|h\d|li|blockquote)>~', "\n", $html );
	$text = html_entity_decode( wp_strip_all_tags( (string) $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	$n = 0;
	foreach ( preg_split( '/\R/u', $text ) as $line ) {
		if ( preg_match( '/^\s*[\(\[]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\)\]]?\s*[-–—:·|]?\s*\S.{1,140}$/u', trim( $line ) ) ) {
			$n++;
		}
	}
	return $n;
}

add_action( 'save_post_si_video', static function ( int $post_id ) {
	if ( ! isset( $_POST['si_captions_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['si_captions_nonce'] ), 'si_captions' )
		|| ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$file = isset( $_POST['si_caption_file'] ) ? (int) $_POST['si_caption_file'] : 0;
	$file ? update_post_meta( $post_id, 'si_caption_file', $file ) : delete_post_meta( $post_id, 'si_caption_file' );
	si_captions_rebuild( $post_id );
}, 20 );

/** The media library must accept a caption file. */
add_filter( 'upload_mimes', static function ( array $mimes ) {
	$mimes['vtt'] = 'text/vtt';
	$mimes['srt'] = 'text/plain';
	return $mimes;
} );
add_filter( 'wp_check_filetype_and_ext', static function ( array $info, $file, $filename ) {
	if ( preg_match( '/\.(vtt|srt)$/i', (string) $filename ) && ! $info['ext'] ) {
		$info['ext']  = strtolower( pathinfo( (string) $filename, PATHINFO_EXTENSION ) );
		$info['type'] = $info['ext'] === 'vtt' ? 'text/vtt' : 'text/plain';
	}
	return $info;
}, 10, 3 );
