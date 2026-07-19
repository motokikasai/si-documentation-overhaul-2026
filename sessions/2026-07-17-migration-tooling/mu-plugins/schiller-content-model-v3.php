<?php
/**
 * Plugin Name: Schiller Content Model v3
 * Description: Registers the 7 si_* CPTs + 5 taxonomies of content-model v3 (sessions/2026-07-16-consolidation-roadmap/06-content-model-v3.md), seeds canonical terms, auto-assigns si_format. Types/taxonomies are registered with WP core APIs (bulletproof under WP-CLI); Pods extends them with the field groups below.
 * Version:     3.1.0
 * Author:      SI migration tooling (session 2026-07-17)
 *
 * INSTALL: drop into wp-content/mu-plugins/ (both files: this + si-migrate.php).
 * Requires Pods (free) active for the FIELD layer; the types themselves work without it.
 *
 * DESIGN DECISIONS baked in here (flagged for review):
 *   D1  Types/taxonomies via register_post_type()/register_taxonomy(), Pods in "extend
 *       existing" mode for fields. Rationale: registration must never depend on Pods
 *       bootstrap order or version; WP-CLI batch runs need the types present always.
 *   D2  Compound repeaters (Person links, Presentation chapters/agenda, Statement external
 *       signatories) are LINE-FORMAT paragraph fields, one entry per line, ` | `-separated
 *       (see SI_Model::LINE_FORMATS). Pods free has no compound repeater; line format keeps
 *       WP-CLI writes trivial (plain meta), renders parse it. Swap for ACF-style repeaters
 *       later without data loss (parser provided in si-migrate.php).
 *   D3  Relationship fields are Pods "pick" fields stored as post-meta IDs; profile pages
 *       reverse-query (WP_Query meta_query) — no bidirectional sister-field config in code
 *       (set in Pods UI later if wanted; reverse queries make it optional).
 *   D4  Slug seeds below are THE canonical taxonomy slugs — the CSV contracts
 *       (01-csv-contracts.md) and si-migrate.php reference them by these exact strings.
 *
 * Verify on Local at Stage P1 (playbook §3): create one sample record of each type, round-trip
 * every field through pods()->save()/field(), then adjust ONLY the Pods layer if the installed
 * Pods version wants different config keys. Field NAMES and meta keys here are the contract.
 */

defined('ABSPATH') || exit;

final class SI_Model {

    const VERSION = '3.1.0';            // bump to re-run term seeding (3.1.0: hierarchical
                                        // UI flip + closed-vocabulary caps + name self-heal)
    const SEED_OPTION = 'si_model_seeded';

    /** post types that carry each taxonomy */
    const TAX_MAP = [
        'si_topic'    => ['post', 'page', 'si_conference', 'si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'],
        'si_region'   => ['post', 'page', 'si_conference', 'si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'],
        'si_campaign' => ['post', 'page', 'si_conference', 'si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'],
        'si_series'   => ['post', 'si_video'],
        'si_format'   => ['post', 'si_conference', 'si_presentation', 'si_video', 'si_document', 'si_statement', 'si_coverage'],
    ];

    /** auto si_format term per type (never editor-set) */
    const FORMAT_MAP = [
        'post'            => 'article',
        'si_conference'   => 'conference',
        'si_presentation' => 'presentation',
        'si_video'        => 'video',
        'si_document'     => 'document',
        'si_statement'    => 'statement',
        'si_coverage'     => 'coverage',
    ];

    /** D2: line formats for pseudo-repeater fields (rendered + parsed by SI_Lines in si-migrate.php) */
    const LINE_FORMATS = [
        'si_person.links'                  => 'Label | https://url',
        'si_presentation.chapters'         => 'H:MM:SS | Chapter label',
        'si_presentation.agenda'           => 'Name | Affiliation | Country | Talk title',
        'si_statement.signatories_external'=> 'Name | Affiliation | Country',
    ];

    // ---------------------------------------------------------------- seeds (D4)

    const TOPICS = [
        'peace-strategy'     => 'Peace & Strategy',
        'physical-economy'   => 'Physical Economy',
        'great-projects'     => 'New Silk Road & Great Projects',
        'classical-culture'  => 'Classical Culture',
        'science-space'      => 'Science & Space',
        'health-food'        => 'Health & Food Security',
        'energy-environment' => 'Energy & Environment',
        'education-youth'    => 'Education & Youth',
        'history-method'     => 'History & Method',
        'new-paradigm'       => 'New Paradigm',
    ];

    /** slug => [label, parent slug|null]  (05 §6: country children only ≥15 posts) */
    const REGIONS = [
        'africa'         => ['Africa', null],
        'asia-pacific'   => ['Asia & Pacific', null],
        'china'          => ['China', 'asia-pacific'],
        'india'          => ['India', 'asia-pacific'],
        'eurasia'        => ['Eurasia', null],
        'russia'         => ['Russia', 'eurasia'],
        'europe'         => ['Europe', null],
        'germany'        => ['Germany', 'europe'],
        'ukraine'        => ['Ukraine', 'europe'],
        'southwest-asia' => ['Southwest Asia', null],
        'afghanistan'    => ['Afghanistan', 'southwest-asia'],
        'north-america'  => ['North America', null],
        'united-states'  => ['United States', 'north-america'],
        'ibero-america'  => ['Ibero-America', null],
        'haiti'          => ['Haiti', 'ibero-america'],
        'global'         => ['Global / International', null],
    ];

    const CAMPAIGNS = [
        'international-peace-coalition' => 'International Peace Coalition',
        'oasis-plan'                    => 'Oasis Plan',
        'world-land-bridge'             => 'World Land-Bridge',
        'stop-green-fascism'            => 'Stop Green Fascism',
        'coincidence-of-opposites'      => 'Coincidence of Opposites',
        'operation-ibn-sina'            => 'Operation Ibn Sina',
        'larouche-youth-movement'       => 'LaRouche Youth Movement',
    ];

    const SERIES = [
        'weekly-webcast-hzl'             => 'Weekly Webcast with Helga Zepp-LaRouche',
        'schlanger-daily-update'         => 'Harley Schlanger Daily Update',
        'daily-beethoven'                => 'Daily Beethoven — Sparks of Joy',
        'ipc-meeting'                    => 'IPC Weekly Meeting',
        'youth-class-series'             => 'Youth Class Series',
        'fundamentals-larouche-economics'=> "Fundamentals of LaRouche's Economics",
    ];

    const FORMATS = [
        'article'      => 'Article',
        'conference'   => 'Conference',
        'presentation' => 'Presentation',
        'video'        => 'Video',
        'document'     => 'Document',
        'statement'    => 'Statement',
        'coverage'     => 'Coverage',
    ];

    // ---------------------------------------------------------------- bootstrap

    public static function boot(): void {
        add_action('init', [self::class, 'register_taxonomies'], 4);   // before CPTs
        add_action('init', [self::class, 'register_post_types'], 5);
        add_action('init', [self::class, 'seed_terms'], 20);
        add_action('init', [self::class, 'register_pods_fields'], 30); // after Pods bootstrap
        add_action('save_post', [self::class, 'auto_format'], 20, 2);
    }

    // ---------------------------------------------------------------- taxonomies

    public static function register_taxonomies(): void {
        $common = [
            'public'            => true,
            'show_ui'           => true,
            'show_in_rest'      => true,
            'show_admin_column' => true,
            // Closed vocabulary (user decision 2026-07-19, editorial rule 05 §11): editors
            // assign terms, only admins create/edit/delete them.
            'capabilities'      => [
                'manage_terms' => 'manage_options',
                'edit_terms'   => 'manage_options',
                'delete_terms' => 'manage_options',
                'assign_terms' => 'edit_posts',
            ],
        ];
        // hierarchical=>true on conceptually FLAT taxonomies (topic/campaign/series) is
        // deliberate and UI-only: Gutenberg renders hierarchical taxonomies as a checkbox
        // list of existing terms instead of a free-text token field that auto-creates
        // whatever an editor types (user decision 2026-07-19). Never seed child terms.
        register_taxonomy('si_topic', self::TAX_MAP['si_topic'], $common + [
            'labels'       => self::labels('Topic', 'Topics'),
            'hierarchical' => true,
            'rewrite'      => ['slug' => 'topic', 'with_front' => false],
        ]);
        register_taxonomy('si_region', self::TAX_MAP['si_region'], $common + [
            'labels'       => self::labels('Region', 'Regions'),
            'hierarchical' => true,
            'rewrite'      => ['slug' => 'region', 'with_front' => false, 'hierarchical' => true],
        ]);
        register_taxonomy('si_campaign', self::TAX_MAP['si_campaign'], $common + [
            'labels'       => self::labels('Campaign', 'Campaigns'),
            'hierarchical' => true,
            'rewrite'      => ['slug' => 'campaign', 'with_front' => false],
        ]);
        register_taxonomy('si_series', self::TAX_MAP['si_series'], $common + [
            'labels'       => self::labels('Series', 'Series'),
            'hierarchical' => true,
            'rewrite'      => ['slug' => 'series', 'with_front' => false],
        ]);
        register_taxonomy('si_format', self::TAX_MAP['si_format'], [
            'labels'            => self::labels('Format', 'Formats'),
            'public'            => true,
            'show_ui'           => false,          // AUTO-assigned, never editor-set (06 §1)
            'show_in_rest'      => true,
            'show_admin_column' => true,
            'hierarchical'      => false,
            'rewrite'           => ['slug' => 'format', 'with_front' => false],
            'capabilities'      => [                // belt-and-braces: nobody edits terms in UI
                'manage_terms' => 'manage_options',
                'edit_terms'   => 'manage_options',
                'delete_terms' => 'manage_options',
                'assign_terms' => 'edit_posts',
            ],
        ]);
    }

    // ---------------------------------------------------------------- post types
    // Registration order (06 §2): Person → Conference → Presentation → Video →
    // Document → Statement → Coverage (relationship targets exist first).

    public static function register_post_types(): void {
        $base = [
            'public'       => true,
            'show_in_rest' => true,
            'has_archive'  => true,
            'map_meta_cap' => true,
            'supports'     => ['title', 'editor', 'thumbnail', 'excerpt', 'revisions', 'custom-fields'],
        ];

        register_post_type('si_person', $base + [
            'labels'      => self::labels('Person', 'People'),
            'menu_icon'   => 'dashicons-groups',
            'rewrite'     => ['slug' => 'people', 'with_front' => false],
            'taxonomies'  => [],   // people are not topic-tagged; aggregation is by relationship
        ]);
        register_post_type('si_conference', $base + [
            'labels'      => self::labels('Conference', 'Conferences'),
            'menu_icon'   => 'dashicons-megaphone',
            'rewrite'     => ['slug' => 'conferences', 'with_front' => false],
        ]);
        register_post_type('si_presentation', $base + [
            'labels'      => self::labels('Presentation', 'Presentations'),
            'menu_icon'   => 'dashicons-video-alt3',
            // Base /media/ KEPT deliberately (06 change #5): preserves the 333 public EN
            // legacy /media/{slug}/ URLs verbatim — zero redirects for legacy presentations.
            'rewrite'     => ['slug' => 'media', 'with_front' => false],
        ]);
        register_post_type('si_video', $base + [
            'labels'      => self::labels('Video', 'Videos'),
            'menu_icon'   => 'dashicons-format-video',
            'rewrite'     => ['slug' => 'videos', 'with_front' => false],
        ]);
        register_post_type('si_document', $base + [
            'labels'      => self::labels('Document', 'Documents'),
            'menu_icon'   => 'dashicons-media-document',
            'rewrite'     => ['slug' => 'library', 'with_front' => false],
        ]);
        register_post_type('si_statement', $base + [
            'labels'      => self::labels('Statement', 'Statements'),
            'menu_icon'   => 'dashicons-testimonial',
            'rewrite'     => ['slug' => 'statements', 'with_front' => false],
        ]);
        register_post_type('si_coverage', $base + [
            'labels'      => self::labels('Press Coverage', 'Press Coverage'),
            'menu_icon'   => 'dashicons-rss',
            'rewrite'     => ['slug' => 'coverage', 'with_front' => false],
        ]);
    }

    private static function labels(string $singular, string $plural): array {
        return [
            'name'          => $plural,
            'singular_name' => $singular,
            'add_new_item'  => "Add New $singular",
            'edit_item'     => "Edit $singular",
            'search_items'  => "Search $plural",
            'not_found'     => "No " . strtolower($plural) . " found",
        ];
    }

    // ---------------------------------------------------------------- term seeding (idempotent)

    public static function seed_terms(): void {
        if (get_option(self::SEED_OPTION) === self::VERSION) {
            return;
        }
        foreach (self::TOPICS as $slug => $label) {
            self::ensure_term('si_topic', $slug, $label);
        }
        foreach (self::REGIONS as $slug => [$label, $parent]) {
            $parent_id = 0;
            if ($parent) {
                $p = get_term_by('slug', $parent, 'si_region');
                $parent_id = $p ? (int) $p->term_id : 0;
            }
            self::ensure_term('si_region', $slug, $label, $parent_id);
        }
        foreach (self::CAMPAIGNS as $slug => $label) {
            self::ensure_term('si_campaign', $slug, $label);
        }
        foreach (self::SERIES as $slug => $label) {
            self::ensure_term('si_series', $slug, $label);
        }
        foreach (self::FORMATS as $slug => $label) {
            self::ensure_term('si_format', $slug, $label);
        }
        update_option(self::SEED_OPTION, self::VERSION, false);
    }

    private static function ensure_term(string $tax, string $slug, string $label, int $parent = 0): void {
        $existing = get_term_by('slug', $slug, $tax);
        if (!$existing) {
            wp_insert_term($label, $tax, ['slug' => $slug, 'parent' => $parent]);
            return;
        }
        // Self-heal drifted names — rehearsal 2026-07-18 left seeded names entity-encoded
        // ("Peace &amp; Strategy"; encoder unidentified, suspected WPML insert hook).
        // Compare decoded so an encoder that also mangles wp_update_term can't loop us.
        if (html_entity_decode($existing->name, ENT_QUOTES) !== $label) {
            wp_update_term($existing->term_id, $tax, ['name' => $label]);
        }
    }

    // ---------------------------------------------------------------- auto si_format

    public static function auto_format(int $post_id, \WP_Post $post): void {
        if (wp_is_post_revision($post_id) || $post->post_status === 'auto-draft') {
            return;
        }
        $slug = self::FORMAT_MAP[$post->post_type] ?? null;
        if ($slug) {
            wp_set_object_terms($post_id, $slug, 'si_format', false);
        }
    }

    // ---------------------------------------------------------------- Pods field layer (D1/D3)

    public static function register_pods_fields(): void {
        if (!function_exists('pods_register_type')) {
            return;   // Pods inactive: types still work; fields appear when Pods returns
        }
        foreach (self::pods_definitions() as $type => $def) {
            pods_register_type('post_type', $type, [
                'storage' => 'meta',
                'label'   => $def['label'],
                'groups'  => [[
                    'name'   => $type . '_fields',
                    'label'  => $def['label'] . ' fields',
                    'fields' => $def['fields'],
                ]],
            ]);
        }
    }

    /** Field vocabulary: text · paragraph · wysiwyg · number · date · file · website ·
     *  boolean · pick(post_type) · pick(custom-simple). Meta keys = field names (storage=meta). */
    private static function pods_definitions(): array {
        $pick = static fn(string $target, bool $multi = true) => [
            'type'             => 'pick',
            'pick_object'      => 'post_type',
            'pick_val'         => $target,
            'pick_format_type' => $multi ? 'multi' : 'single',
        ];
        $select = static fn(string $options) => [
            'type'             => 'pick',
            'pick_object'      => 'custom-simple',
            'pick_custom'      => $options,       // one per line: value|Label
            'pick_format_type' => 'single',
        ];

        return [
            'si_person' => [
                'label'  => 'Person',
                'fields' => [
                    ['name' => 'honorific',   'label' => 'Honorific',   'type' => 'text'],
                    ['name' => 'role',        'label' => 'Role',        'type' => 'text'],
                    ['name' => 'affiliation', 'label' => 'Affiliation', 'type' => 'text'],
                    ['name' => 'person_type', 'label' => 'Person type', 'type' => 'pick',
                        'pick_object' => 'custom-simple', 'pick_format_type' => 'multi',
                        'pick_custom' => "founder|Founder\nleadership|Leadership\nspeaker|Speaker\nauthor|Author\nguest|Guest"],
                    ['name' => 'short_bio',   'label' => 'Short bio',   'type' => 'paragraph'],
                    // Full bio = post_content; photo = featured image.
                    ['name' => 'links',       'label' => 'Links (one per line: Label | URL)', 'type' => 'paragraph'],
                ],
            ],
            'si_conference' => [
                'label'  => 'Conference',
                'fields' => [
                    ['name' => 'start_date',       'label' => 'Start date', 'type' => 'date'],
                    ['name' => 'end_date',         'label' => 'End date',   'type' => 'date'],
                    ['name' => 'location',         'label' => 'Location',   'type' => 'text'],
                    ['name' => 'featured_video',   'label' => 'Featured video / playlist ID', 'type' => 'text'],
                    ['name' => 'registration_url', 'label' => 'Registration link (NationBuilder)', 'type' => 'website'],
                    ['name' => 'program_document', 'label' => 'Program / agenda document'] + $pick('si_document', false),
                    // Overview = post_content; hero = featured image; _yt_playlist_id = hidden meta.
                ],
            ],
            'si_presentation' => [
                'label'  => 'Presentation',
                'fields' => [
                    ['name' => 'parent_conference', 'label' => 'Conference'] + $pick('si_conference', false),
                    ['name' => 'panel_title',   'label' => 'Panel title', 'type' => 'text'],
                    ['name' => 'yt_video_id',   'label' => 'YouTube video ID', 'type' => 'text'],
                    ['name' => 'start_seconds', 'label' => 'Start (seconds)', 'type' => 'number'],
                    ['name' => 'end_seconds',   'label' => 'End (seconds)',   'type' => 'number'],
                    ['name' => 'kind',          'label' => 'Kind'] + $select("talk|Talk\nchaptered|Chaptered talk\nfull_session|Full session"),
                    ['name' => 'chapters',      'label' => 'Chapters (one per line: H:MM:SS | Label)', 'type' => 'paragraph'],
                    ['name' => 'agenda',        'label' => 'Agenda (Full session; one per line: Name | Affiliation | Country | Talk title)', 'type' => 'paragraph'],
                    ['name' => 'presenters',    'label' => 'Presenter(s)'] + $pick('si_person'),
                    ['name' => 'abstract',      'label' => 'Abstract', 'type' => 'wysiwyg'],
                    ['name' => 'transcript',    'label' => 'Transcript', 'type' => 'wysiwyg'],
                    ['name' => 'transcript_auto', 'label' => 'Transcript is auto-generated', 'type' => 'boolean'],
                    ['name' => 'slides_document', 'label' => 'Slides / paper'] + $pick('si_document', false),
                    // Embeds derived, never stored: youtube-nocookie.com/embed/{ID}?start=&end=&rel=0
                ],
            ],
            'si_video' => [
                'label'  => 'Video',
                'fields' => [
                    ['name' => 'yt_video_id', 'label' => 'YouTube video ID', 'type' => 'text'],
                    ['name' => 'hosts',       'label' => 'Host / speakers'] + $pick('si_person'),
                    ['name' => 'transcript',  'label' => 'Transcript', 'type' => 'paragraph'],
                    ['name' => 'transcript_auto', 'label' => 'Transcript is auto-generated', 'type' => 'boolean'],
                    // Description = post_content; date = post_date; Series term is the key taxonomy.
                ],
            ],
            'si_document' => [
                'label'  => 'Document',
                'fields' => [
                    ['name' => 'file',     'label' => 'File (PDF)', 'type' => 'file', 'file_format_type' => 'single'],
                    ['name' => 'doc_type', 'label' => 'Document type'] + $select("report|Report\nstudy|Study\nprogram|Program/Agenda\npamphlet|Pamphlet\nmemorandum|Memorandum"),
                    ['name' => 'authors',  'label' => 'Authors'] + $pick('si_person'),
                    ['name' => 'related_conference',   'label' => 'Related conference'] + $pick('si_conference', false),
                    ['name' => 'related_presentations','label' => 'Related presentations'] + $pick('si_presentation'),
                    ['name' => 'related_statements',   'label' => 'Related statements'] + $pick('si_statement'),
                    // Cover = featured image; description = excerpt.
                ],
            ],
            'si_statement' => [
                'label'  => 'Statement',
                'fields' => [
                    ['name' => 'statement_type', 'label' => 'Statement type'] + $select("declaration|Declaration\nappeal|Appeal\nopen-letter|Open Letter\ncall|Call\nresolution|Resolution\npress-release|Press Release"),
                    ['name' => 'lede',            'label' => 'Lede', 'type' => 'paragraph'],
                    ['name' => 'signatories_internal', 'label' => 'Signatories (SI people)'] + $pick('si_person'),
                    ['name' => 'signatories_external', 'label' => 'External signatories (one per line: Name | Affiliation | Country)', 'type' => 'paragraph'],
                    ['name' => 'signatory_count', 'label' => 'Signatory count', 'type' => 'number'],
                    ['name' => 'sign_url',        'label' => 'Sign-this URL (NationBuilder)', 'type' => 'website'],
                    ['name' => 'attached_document', 'label' => 'Attached document (PDF)'] + $pick('si_document', false),
                    // Body = post_content.
                ],
            ],
            'si_coverage' => [
                'label'  => 'Press Coverage',
                'fields' => [
                    ['name' => 'outlet',          'label' => 'Outlet', 'type' => 'text', 'required' => true],
                    ['name' => 'external_author', 'label' => 'External author', 'type' => 'text'],
                    ['name' => 'external_url',    'label' => 'External URL', 'type' => 'website', 'required' => true],
                    ['name' => 'coverage_type',   'label' => 'Coverage type'] + $select("article|Article\ninterview|Interview\nop-ed|Op-ed\nmention|Mention\ntv|TV/Broadcast\nradio|Radio/Podcast"),
                    ['name' => 'pull_quote',      'label' => 'Excerpt / pull-quote', 'type' => 'paragraph'],
                    ['name' => 'featured_people', 'label' => 'Featured SI people'] + $pick('si_person'),
                ],
            ],
        ];
    }
}

SI_Model::boot();
