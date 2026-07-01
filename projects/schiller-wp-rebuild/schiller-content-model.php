<?php
/**
 * Plugin Name: Schiller Institute — Content Model (CPTs, Taxonomies, Fields)
 * Description: Registers the rebuilt content model (8 CPTs + shared taxonomies + Pods fields) for schillerinstitute.com. Source of truth = schiller-cpt-model.xlsx / 01-data-model-schema.md.
 * Version:     1.0
 * Author:      Schiller Institute web team
 *
 * HOW TO USE
 *   Drop this file in wp-content/mu-plugins/ (auto-loads, no activation needed) OR
 *   wp-content/plugins/schiller-content-model/schiller-content-model.php and activate it.
 *   Requires the free Pods plugin (pods.io) to be active — it provides the field engine.
 *
 * DESIGN NOTES
 *   - 'storage' => 'meta' keeps fields in standard postmeta (portable, query-friendly, no extra tables).
 *   - Relationships are 'pick' fields stored on the CHILD; the Person profile reverse-queries them
 *     (matches 01-data-model-schema.md §5). To make a relationship bidirectional in the UI later,
 *     set its "Bi-directional Field" (sister_id) in Pods Admin, or register the reverse pick field.
 *   - Multi-column repeaters (label+url, name+affiliation, label+seconds) are modelled below as
 *     REPEATABLE simple fields with a documented text convention. If you need true multi-column
 *     rows, promote them to a related Pod (e.g. si_signatory) — flagged inline where it applies.
 *   - URL bases: si_presentation => /media/ (PRESERVED legacy Portfolio base), si_coverage => /coverage/
 *     (preserved section). Native Posts keep /blog/YYYY/MM/DD/ (WordPress core — not registered here).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', 'si_register_content_model', 11 );

function si_register_content_model() {

	// Pods must be active; bail quietly otherwise so the site never white-screens.
	if ( ! function_exists( 'pods_register_type' ) || ! function_exists( 'pods_register_group' ) ) {
		return;
	}

	/* =====================================================================
	 * 1. SHARED TAXONOMIES  (register first — referenced by every CPT)
	 * ===================================================================== */

	$content_objects = array(
		'post', // native Article participates in faceted search
		'si_conference',
		'si_presentation',
		'si_video',
		'si_forecast',
		'si_document',
		'si_statement',
		'si_coverage',
	);

	// Topic — the big idea themes.
	pods_register_type( 'taxonomy', 'si_topic', array(
		'label'             => 'Topics',
		'label_singular'    => 'Topic',
		'hierarchical'      => true,
		'public'            => true,
		'show_admin_column' => true,
		'rewrite'           => array( 'slug' => 'topic' ),
		'object_type'       => $content_objects,
	) );

	// Region — continent → country (hierarchical).
	pods_register_type( 'taxonomy', 'si_region', array(
		'label'             => 'Regions',
		'label_singular'    => 'Region',
		'hierarchical'      => true,
		'public'            => true,
		'show_admin_column' => true,
		'rewrite'           => array( 'slug' => 'region' ),
		'object_type'       => $content_objects,
	) );

	// Campaign — flagship organizing vehicles. ALSO powers the hand-built campaign landing Pages
	// (the v1 decision: Campaign is a taxonomy + Pages, NOT a CPT) — hence 'page' is included.
	pods_register_type( 'taxonomy', 'si_campaign', array(
		'label'             => 'Campaigns',
		'label_singular'    => 'Campaign',
		'hierarchical'      => false,
		'public'            => true,
		'show_admin_column' => true,
		'rewrite'           => array( 'slug' => 'campaign' ),
		'object_type'       => array_merge( $content_objects, array( 'page' ) ),
	) );

	// Format — auto-assigned per type so faceted search can filter ACROSS types.
	pods_register_type( 'taxonomy', 'si_format', array(
		'label'             => 'Formats',
		'label_singular'    => 'Format',
		'hierarchical'      => false,
		'public'            => true,
		'show_admin_column' => true,
		'show_in_nav_menus' => false,
		'rewrite'           => array( 'slug' => 'format' ),
		'object_type'       => $content_objects,
	) );

	// Series — light grouping for recurring broadcasts (replaces a free-text Series field).
	pods_register_type( 'taxonomy', 'si_series', array(
		'label'             => 'Series',
		'label_singular'    => 'Series',
		'hierarchical'      => false,
		'public'            => true,
		'show_admin_column' => true,
		'rewrite'           => array( 'slug' => 'series' ),
		'object_type'       => array( 'si_video', 'si_conference' ),
	) );

	$all_taxonomies = array( 'si_topic', 'si_region', 'si_campaign', 'si_format' );

	/* =====================================================================
	 * 2. CUSTOM POST TYPES + FIELD GROUPS
	 * ===================================================================== */

	/* ---- 2.1 PERSON (si_person) — relational hub ---------------------- */
	pods_register_type( 'post_type', 'si_person', array(
		'label'          => 'People',
		'label_singular' => 'Person',
		'public'         => true,
		'has_archive'    => true,
		'hierarchical'   => false,
		'menu_icon'      => 'dashicons-groups',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'revisions' ),
		'rewrite'        => array( 'slug' => 'people', 'with_front' => false ),
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'person-details', 'label' => 'Person Details' ),
		'si_person',
		array(
			'honorific'   => array( 'label' => 'Honorific', 'type' => 'text', 'description' => 'Dr., Sen., Amb. — optional prefix' ),
			'role'        => array( 'label' => 'Role / position', 'type' => 'text' ),
			'person_type' => array(
				'label'             => 'Person type',
				'type'              => 'pick',
				'pick_object'       => 'custom-simple',
				'pick_custom'       => "Founder\nLeadership\nStaff\nSpeaker\nAuthor\nGuest",
				'pick_format_type'  => 'multi',
				'pick_format_multi' => 'checkbox',
			),
			'short_bio'   => array( 'label' => 'Short bio', 'type' => 'paragraph', 'description' => 'For cards / bylines' ),
			'affiliation' => array( 'label' => 'Affiliation', 'type' => 'text', 'description' => 'External org if guest' ),
			// Repeatable URL list. Label is omitted by Pods repeatable simple fields — promote to a
			// related Pod (si_link) if label+url pairs are required.
			'links'       => array( 'label' => 'Links', 'type' => 'website', 'repeatable' => 1, 'description' => 'Site, social, Wikipedia' ),
		)
	);

	/* ---- 2.2 CONFERENCE (si_conference) ------------------------------- */
	pods_register_type( 'post_type', 'si_conference', array(
		'label'          => 'Conferences',
		'label_singular' => 'Conference',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-megaphone',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		'rewrite'        => array( 'slug' => 'conferences', 'with_front' => false ),
		'taxonomies'     => array_merge( $all_taxonomies, array( 'si_series' ) ),
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'conference-details', 'label' => 'Conference Details' ),
		'si_conference',
		array(
			'start_date'    => array( 'label' => 'Start date', 'type' => 'date', 'required' => 1 ),
			'end_date'      => array( 'label' => 'End date', 'type' => 'date' ),
			'location'      => array( 'label' => 'Location', 'type' => 'text', 'description' => 'Also tag with a Region term' ),
			'overview'      => array( 'label' => 'Overview', 'type' => 'wysiwyg' ),
			'program'       => array(
				'label' => 'Program / agenda (PDF)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_document',
				'pick_format_type' => 'single', 'description' => 'Promote the agenda PDF to a Document',
			),
			'featured_video' => array(
				'label' => 'Featured video', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_video',
				'pick_format_type' => 'single', 'description' => 'The "watch the whole thing" entry',
			),
			'speakers'      => array(
				'label' => 'Speakers', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'Often auto-aggregated from child presentations',
			),
			'_yt_playlist_id' => array( 'label' => 'YouTube playlist ID (idempotency key)', 'type' => 'text', 'description' => 'Set by the YouTube ingestion pipeline' ),
		)
	);

	/* ---- 2.3 PRESENTATION (si_presentation) — base /media/ ------------ */
	pods_register_type( 'post_type', 'si_presentation', array(
		'label'          => 'Presentations',
		'label_singular' => 'Presentation',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-microphone',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		// PRESERVE the legacy Portfolio URL base — do NOT change.
		'rewrite'        => array( 'slug' => 'media', 'with_front' => false ),
		'taxonomies'     => $all_taxonomies,
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'presentation-details', 'label' => 'Presentation Details' ),
		'si_presentation',
		array(
			'parent_conference' => array(
				'label' => 'Parent conference', 'type' => 'pick', 'required' => 1,
				'pick_object' => 'post_type', 'pick_val' => 'si_conference', 'pick_format_type' => 'single',
			),
			'panel_title'      => array( 'label' => 'Panel title', 'type' => 'text' ),
			'youtube_video_id' => array( 'label' => 'YouTube video ID', 'type' => 'text', 'description' => 'The PANEL video — shared across sibling presentations' ),
			'start_seconds'    => array( 'label' => 'Start seconds', 'type' => 'number', 'description' => 'Embed deep-link ?start=' ),
			'end_seconds'      => array( 'label' => 'End seconds', 'type' => 'number' ),
			'presentation_kind' => array(
				'label' => 'Presentation kind', 'type' => 'pick', 'required' => 1,
				'pick_object' => 'custom-simple', 'pick_custom' => "Talk\nChaptered talk\nFull session",
				'pick_format_type' => 'single', 'pick_format_single' => 'radio',
				'default_value' => 'Talk',
			),
			// Multi-column repeater (label + start_seconds). Convention: one line "SS Label" per chapter.
			// Promote to a related Pod (si_chapter) if structured rows are required.
			'chapters'         => array( 'label' => 'Chapters', 'type' => 'paragraph', 'description' => 'Case-2 internal sections. One per line as "start_seconds  Label".' ),
			'presenter'        => array(
				'label' => 'Presenter(s)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'Required for Talk / Chaptered; Full session lists all known speakers',
			),
			'abstract'    => array( 'label' => 'Abstract / summary', 'type' => 'wysiwyg' ),
			'transcript'  => array( 'label' => 'Transcript', 'type' => 'wysiwyg', 'description' => 'Auto-generated (Whisper/captions) → SEO + authority' ),
			'slides'      => array(
				'label' => 'Slides', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_document', 'pick_format_type' => 'single',
			),
			'_yt_video_id'      => array( 'label' => 'YouTube video ID (key)', 'type' => 'text' ),
			'_yt_segment_index' => array( 'label' => 'YouTube segment index (key)', 'type' => 'number' ),
		)
	);

	/* ---- 2.4 VIDEO / WEBCAST (si_video) ------------------------------- */
	pods_register_type( 'post_type', 'si_video', array(
		'label'          => 'Videos & Webcasts',
		'label_singular' => 'Video',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-video-alt3',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		'rewrite'        => array( 'slug' => 'videos', 'with_front' => false ),
		'taxonomies'     => array_merge( $all_taxonomies, array( 'si_series' ) ),
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'video-details', 'label' => 'Video Details' ),
		'si_video',
		array(
			'video_date'       => array( 'label' => 'Date', 'type' => 'date' ),
			'youtube_video_id' => array( 'label' => 'YouTube video ID', 'type' => 'text', 'required' => 1 ),
			'start_seconds'    => array( 'label' => 'Start seconds', 'type' => 'number' ),
			'description'      => array( 'label' => 'Description', 'type' => 'wysiwyg' ),
			'hosts'            => array(
				'label' => 'Speakers / hosts', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
			),
			'transcript'       => array( 'label' => 'Transcript', 'type' => 'wysiwyg' ),
		)
	);

	/* ---- 2.5 ECONOMIC FORECAST (si_forecast) -------------------------- */
	pods_register_type( 'post_type', 'si_forecast', array(
		'label'          => 'Economic Forecasts',
		'label_singular' => 'Forecast',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-chart-line',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		'rewrite'        => array( 'slug' => 'forecasts', 'with_front' => false ),
		'taxonomies'     => $all_taxonomies,
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'forecast-details', 'label' => 'Forecast Details' ),
		'si_forecast',
		array(
			'forecast_date' => array( 'label' => 'Date', 'type' => 'date' ),
			'authors'       => array(
				'label' => 'Authors', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
			),
			'key_claim'     => array( 'label' => 'Key claim / headline prediction', 'type' => 'text', 'description' => 'For cards & emphasis' ),
			'summary'       => array( 'label' => 'Summary / abstract', 'type' => 'wysiwyg' ),
			'horizon'       => array( 'label' => 'Forecast horizon', 'type' => 'text', 'description' => "Optional, e.g. '2026–2030'" ),
			'chart'         => array( 'label' => 'Featured chart / image', 'type' => 'file', 'file_format_type' => 'single', 'file_type' => 'images' ),
			'full_document' => array(
				'label' => 'Full document (PDF)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_document', 'pick_format_type' => 'single',
			),
		)
	);

	/* ---- 2.6 DOCUMENT / PUBLICATION (si_document) --------------------- */
	pods_register_type( 'post_type', 'si_document', array(
		'label'          => 'Documents',
		'label_singular' => 'Document',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-media-document',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'revisions' ),
		'rewrite'        => array( 'slug' => 'library', 'with_front' => false ),
		'taxonomies'     => $all_taxonomies,
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'document-details', 'label' => 'Document Details' ),
		'si_document',
		array(
			'document_date' => array( 'label' => 'Date', 'type' => 'date' ),
			'authors'       => array(
				'label' => 'Authors', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
			),
			'file'          => array( 'label' => 'File (PDF)', 'type' => 'file', 'file_format_type' => 'single', 'required' => 1 ),
			'document_type' => array(
				'label' => 'Document type', 'type' => 'pick',
				'pick_object' => 'custom-simple',
				'pick_custom' => "Report\nStatement\nPetition text\nStudy\nMemorandum\nProgram/Agenda",
				'pick_format_type' => 'single',
			),
			'cover'         => array( 'label' => 'Cover image', 'type' => 'file', 'file_format_type' => 'single', 'file_type' => 'images' ),
			'description'   => array( 'label' => 'Description', 'type' => 'wysiwyg' ),
			'related_items' => array(
				'label' => 'Related items', 'type' => 'pick',
				'pick_object' => 'post-types', // any public post type
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'Optional backlinks to Conference / Forecast / Presentation',
			),
		)
	);

	/* ---- 2.7 STATEMENT / APPEAL (si_statement) — NEW ------------------ */
	pods_register_type( 'post_type', 'si_statement', array(
		'label'          => 'Statements & Appeals',
		'label_singular' => 'Statement',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-edit-large',
		'supports'       => array( 'title', 'editor', 'thumbnail', 'excerpt', 'revisions' ),
		'rewrite'        => array( 'slug' => 'statements', 'with_front' => false ),
		'taxonomies'     => $all_taxonomies,
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'statement-details', 'label' => 'Statement Details' ),
		'si_statement',
		array(
			'statement_date' => array( 'label' => 'Date', 'type' => 'date', 'required' => 1 ),
			'statement_type' => array(
				'label' => 'Statement type', 'type' => 'pick',
				'pick_object' => 'custom-simple',
				'pick_custom' => "Declaration\nAppeal\nOpen Letter\nCall\nResolution\nPress Release",
				'pick_format_type' => 'single',
			),
			'lede'             => array( 'label' => 'Lede / summary', 'type' => 'paragraph', 'description' => 'For cards' ),
			'signatories_int'  => array(
				'label' => 'Signatories (internal)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'SI principals who signed',
			),
			// Multi-column repeater (name + affiliation + country). Convention: one signatory per line
			// as "Name — Affiliation, Country". Promote to a related Pod (si_signatory) for structured rows.
			'signatories_ext'  => array( 'label' => 'Signatories (external)', 'type' => 'paragraph', 'description' => 'One per line: Name — Affiliation, Country' ),
			'signatory_count'  => array( 'label' => 'Signatory count', 'type' => 'number', 'description' => 'Optional headline figure' ),
			'nb_petition'      => array( 'label' => 'Sign-this (NationBuilder petition URL/embed)', 'type' => 'website', 'description' => 'Embedded NB petition where applicable' ),
			'attached_document' => array(
				'label' => 'Attached document (PDF)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_document', 'pick_format_type' => 'single',
			),
		)
	);

	/* ---- 2.8 PRESS / MEDIA COVERAGE (si_coverage) — NEW --------------- */
	pods_register_type( 'post_type', 'si_coverage', array(
		'label'          => 'Press Coverage',
		'label_singular' => 'Coverage',
		'public'         => true,
		'has_archive'    => true,
		'menu_icon'      => 'dashicons-admin-links',
		'supports'       => array( 'title', 'thumbnail', 'excerpt' ),
		// Preserve the existing /coverage/ section base.
		'rewrite'        => array( 'slug' => 'coverage', 'with_front' => false ),
		'taxonomies'     => $all_taxonomies,
		'storage'        => 'meta',
	) );
	pods_register_group(
		array( 'name' => 'coverage-details', 'label' => 'Coverage Details' ),
		'si_coverage',
		array(
			'outlet'        => array( 'label' => 'Outlet / publication', 'type' => 'text', 'required' => 1 ),
			'ext_author'    => array( 'label' => 'External author', 'type' => 'text', 'description' => 'Journalist name' ),
			'published_date' => array( 'label' => 'Date published', 'type' => 'date', 'required' => 1 ),
			'external_url'  => array( 'label' => 'External URL', 'type' => 'website', 'required' => 1, 'description' => 'Canonical outbound link (rel=noopener)' ),
			'coverage_type' => array(
				'label' => 'Coverage type', 'type' => 'pick',
				'pick_object' => 'custom-simple',
				'pick_custom' => "Article\nInterview\nOp-ed\nMention\nTV/Broadcast\nRadio/Podcast",
				'pick_format_type' => 'single',
			),
			'excerpt_quote' => array( 'label' => 'Excerpt / pull-quote', 'type' => 'paragraph' ),
			'featured_people' => array(
				'label' => 'Featured SI people', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'Who is interviewed / quoted',
			),
		)
	);

	/* =====================================================================
	 * 3. NATIVE POST (ARTICLE) ADDITIONS
	 *    Posts stay at /blog/YYYY/MM/DD/ — only gain a byline + the shared taxonomies.
	 * ===================================================================== */
	pods_register_group(
		array( 'name' => 'article-extras', 'label' => 'Article Extras' ),
		'post',
		array(
			'byline' => array(
				'label' => 'Byline person(s)', 'type' => 'pick',
				'pick_object' => 'post_type', 'pick_val' => 'si_person',
				'pick_format_type' => 'multi', 'pick_limit' => 0,
				'description' => 'Content authorship ≠ WP login user',
			),
		)
	);
}

/* =========================================================================
 * 4. AUTO-ASSIGN the Format term per type (so faceted search filters across types)
 *    Runs on save; idempotent. Map: post_type => Format term.
 * ========================================================================= */
add_action( 'save_post', 'si_autoset_format_term', 20, 3 );

function si_autoset_format_term( $post_id, $post, $update ) {
	if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}
	if ( ! taxonomy_exists( 'si_format' ) ) {
		return;
	}

	$map = array(
		'post'            => 'Article',
		'si_conference'   => 'Conference',
		'si_presentation' => 'Presentation',
		'si_video'        => 'Video',
		'si_forecast'     => 'Forecast',
		'si_document'     => 'Document',
		'si_statement'    => 'Statement',
		'si_coverage'     => 'Coverage',
	);

	if ( ! isset( $map[ $post->post_type ] ) ) {
		return;
	}

	wp_set_object_terms( $post_id, $map[ $post->post_type ], 'si_format', false );
}
