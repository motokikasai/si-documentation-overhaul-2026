/* si/hero-earth — editor.
 *
 * Written against the `wp` globals rather than JSX on purpose: this plugin
 * deploys by copying a folder, and a build step would put a node toolchain
 * between the designer and the site. There is little enough UI here that
 * createElement is no hardship.
 *
 * The editor deliberately renders the STATIC hero, never the WebGL scene:
 *   - the scene is meaningless without a scroll runway, and the editor
 *     canvas has no such thing;
 *   - a second live WebGL context inside the iframed canvas is a real cost
 *     on the machines editors actually use;
 *   - the static hero is what most of the audience sees, so it is the thing
 *     that most deserves a WYSIWYG preview.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var c = wp.components;
	var cfg = window.SI_HERO_EARTH || {};

	/* The canonical v4 copy. Mirrored in patterns/homepage.php — if you
	 * change one, change the other (see README "Two copies of the copy"). */
	var TEMPLATE = [
		[ 'si/hero-act', {
			stage: 0,
			kicker: 'The Schiller Institute · Since 1984',
			heading: 'The old order is collapsing.<br>A new paradigm is ours to build.',
			lead: 'Economic breakdown, the danger of war, a culture in decay — none of it is inevitable. Mankind is the only creative species we know of in the universe. That changes everything.'
		} ],
		[ 'si/hero-act', {
			stage: 1,
			kicker: 'The New Silk Road · The Oasis Plan',
			heading: 'Build the <em>World Land-Bridge</em>',
			lead: 'Development corridors of rail, water and power connecting every continent — from the Bering Strait to the Gibraltar tunnel to a blooming Southwest Asia. Without the development of all nations, there can be no lasting peace.'
		} ],
		[ 'si/hero-act', {
			stage: 2,
			kicker: 'Fusion · Space · The Noösphere',
			heading: 'Then upward — the <em>extraterrestrial imperative</em>',
			lead: '“Lifting the human species out of its ordinary existence.” — Krafft Ehricke. Fusion power and the joint exploration of space are the common aims of mankind, and the proof that growth has no limits.'
		} ],
		[ 'si/hero-act', {
			stage: 3,
			kicker: 'A Movement of World Citizens',
			heading: 'The future needs <em>you</em>',
			lead: 'Join a worldwide movement for peace through development and a new renaissance of classical culture.',
			ctaEnabled: true,
			ctaPlaceholder: 'Your email address',
			ctaButton: 'Join the movement',
			ctaNote: 'Weekly ideas, webcasts & invitations. Double opt-in, unsubscribe anytime.'
		} ]
	];

	wp.blocks.registerBlockType( 'si/hero-earth', {
		edit: function ( props ) {
			var a = props.attributes;
			var set = props.setAttributes;

			var blockProps = be.useBlockProps( {
				className: 'si-hero si-hero--editor'
			} );

			var innerProps = be.useInnerBlocksProps(
				{ className: 'si-hero__stages' },
				{
					allowedBlocks: [ 'si/hero-act' ],
					template: TEMPLATE,
					templateLock: 'all'
				}
			);

			var poster = a.posterUrl || cfg.posterUrl;

			var inspector = el(
				be.InspectorControls,
				null,
				el(
					c.PanelBody,
					{ title: __( 'Motion & reach', 'si-hero-earth' ), initialOpen: true },
					el( c.SelectControl, {
						label: __( 'Animated scene', 'si-hero-earth' ),
						value: a.mode,
						options: [
							{ label: __( 'Where it is a good trade (recommended)', 'si-hero-earth' ), value: 'auto' },
							{ label: __( 'Never — static hero for everyone', 'si-hero-earth' ), value: 'static' }
						],
						onChange: function ( v ) { set( { mode: v } ); },
						help: __( 'On “auto”, the 3D scene loads only for visitors on an unmetered connection, a capable device and a wide enough screen. Everyone else gets the static hero — which is the whole hero, not a stripped-down one.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} ),
					a.mode === 'auto' && el( c.RangeControl, {
						label: __( 'Minimum viewport width for the scene', 'si-hero-earth' ),
						value: a.minWidth,
						onChange: function ( v ) { set( { minWidth: v || 768 } ); },
						min: 0,
						max: 1600,
						step: 32,
						help: __( 'Below this width the static hero is used. 0 means “any width”.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} ),
					a.mode === 'auto' && el( c.TextControl, {
						label: __( 'Scroll runway', 'si-hero-earth' ),
						value: a.runway,
						onChange: function ( v ) { set( { runway: v } ); },
						help: __( 'How much scrolling the four acts are spread over. 520vh ≈ five screens.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} )
				),
				el(
					c.PanelBody,
					{ title: __( 'Poster image', 'si-hero-earth' ), initialOpen: false },
					el( 'p', { className: 'si-hero__help' },
						__( 'Shown to every visitor before — and instead of — the 3D scene. This is the page’s largest image, so keep it light.', 'si-hero-earth' ) ),
					el( be.MediaUploadCheck, null,
						el( be.MediaUpload, {
							allowedTypes: [ 'image' ],
							value: a.posterId,
							onSelect: function ( media ) {
								set( { posterId: media.id, posterUrl: media.url } );
							},
							render: function ( o ) {
								return el( c.Button, {
									variant: 'secondary',
									onClick: o.open
								}, a.posterId
									? __( 'Replace poster', 'si-hero-earth' )
									: __( 'Choose poster', 'si-hero-earth' ) );
							}
						} )
					),
					a.posterId && el( c.Button, {
						variant: 'link',
						isDestructive: true,
						onClick: function () { set( { posterId: undefined, posterUrl: undefined } ); }
					}, __( 'Use the bundled Earth poster', 'si-hero-earth' ) ),
					el( c.TextControl, {
						label: __( 'Poster alt text', 'si-hero-earth' ),
						value: a.posterAlt,
						onChange: function ( v ) { set( { posterAlt: v } ); },
						help: __( 'Leave empty if the poster is purely decorative — the headline already carries the meaning.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} )
				)
			);

			return el( Fragment, null,
				inspector,
				el( 'section', blockProps,
					el( 'div', { className: 'si-hero__pin' },
						el( 'div', { className: 'si-hero__fallback', 'aria-hidden': 'true' },
							poster ? el( 'img', {
								className: 'si-hero__poster',
								src: poster,
								alt: ''
							} ) : null
						),
						el( 'div', { className: 'si-hero__vignette', 'aria-hidden': 'true' } ),
						el( 'div', innerProps )
					),
					el( 'p', { className: 'si-hero__editor-note' },
						a.mode === 'static'
							? __( 'Static hero for every visitor.', 'si-hero-earth' )
							: __( 'This is the static hero every visitor sees. On the front end it upgrades to the scroll-driven 3D scene where that is a good trade.', 'si-hero-earth' )
					)
				)
			);
		},

		// Dynamic block: the server renders it. Nothing to save but the
		// inner blocks, which InnerBlocks.Content handles.
		save: function () {
			return el( be.InnerBlocks.Content );
		}
	} );
} )( window.wp );
