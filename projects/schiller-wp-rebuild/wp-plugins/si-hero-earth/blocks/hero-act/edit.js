/* si/hero-act — editor.
 *
 * Every visible string is a RichText attribute. That is the design decision
 * that makes this block translatable: the four fields live in the post
 * content as attributes on the block, so they show up in revisions, in the
 * REST API, and in WPML's translation editor (see wpml-config.xml) — while
 * the markup around them stays entirely under this plugin's control.
 *
 * `em` and `br` are the only formats allowed in the headline. The gold
 * italic is a designed element of the hero, not arbitrary styling, and a
 * headline that can carry links or colours is a headline that will.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var be = wp.blockEditor;
	var c = wp.components;

	var HEADING_FORMATS = [ 'core/italic', 'core/bold' ];
	var PLAIN_FORMATS = [ 'core/italic' ];

	wp.blocks.registerBlockType( 'si/hero-act', {
		edit: function ( props ) {
			var a = props.attributes;
			var set = props.setAttributes;
			var stage = a.stage || 0;

			var blockProps = be.useBlockProps( {
				className: 'si-hero__stage',
				'data-stage': String( stage )
			} );

			var inspector = el(
				be.InspectorControls,
				null,
				el(
					c.PanelBody,
					{ title: __( 'Act', 'si-hero-earth' ), initialOpen: true },
					el( 'p', { className: 'si-hero__help' },
						sprintf(
							/* translators: %d: act number, 1-4. */
							__( 'Act %d of 4. The order is fixed — it is the order the camera travels in.', 'si-hero-earth' ),
							stage + 1
						)
					),
					el( 'p', { className: 'si-hero__help' },
						0 === stage
							? __( 'This act carries the page’s <h1>.', 'si-hero-earth' )
							: __( 'This act renders as an <h2>.', 'si-hero-earth' )
					)
				),
				el(
					c.PanelBody,
					{ title: __( 'Invitation', 'si-hero-earth' ), initialOpen: 3 === stage },
					el( c.ToggleControl, {
						label: __( 'Show the sign-up', 'si-hero-earth' ),
						checked: !! a.ctaEnabled,
						onChange: function ( v ) { set( { ctaEnabled: v } ); },
						__nextHasNoMarginBottom: true
					} ),
					a.ctaEnabled && el( c.TextControl, {
						label: __( 'Form action URL', 'si-hero-earth' ),
						value: a.ctaAction,
						type: 'url',
						onChange: function ( v ) { set( { ctaAction: v } ); },
						help: __( 'Where the address is posted — the NationBuilder signup endpoint. Leave empty and the button becomes a plain link instead of a form that goes nowhere.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} ),
					a.ctaEnabled && a.ctaAction && el( c.TextControl, {
						label: __( 'Field name', 'si-hero-earth' ),
						value: a.ctaField,
						onChange: function ( v ) { set( { ctaField: v } ); },
						help: __( 'The name the endpoint expects for the email input.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} ),
					a.ctaEnabled && ! a.ctaAction && el( c.TextControl, {
						label: __( 'Button link', 'si-hero-earth' ),
						value: a.ctaLink,
						type: 'url',
						onChange: function ( v ) { set( { ctaLink: v } ); },
						__nextHasNoMarginBottom: true
					} ),
					a.ctaEnabled && el( c.TextControl, {
						label: __( 'Accessible label for the email field', 'si-hero-earth' ),
						value: a.ctaLabel,
						onChange: function ( v ) { set( { ctaLabel: v } ); },
						help: __( 'Read by screen readers. The placeholder is not a label.', 'si-hero-earth' ),
						__nextHasNoMarginBottom: true
					} )
				)
			);

			return el( Fragment, null,
				inspector,
				el( 'div', blockProps,
					el( be.RichText, {
						tagName: 'p',
						className: 'si-hero__kicker',
						value: a.kicker,
						allowedFormats: PLAIN_FORMATS,
						onChange: function ( v ) { set( { kicker: v } ); },
						placeholder: __( 'Kicker — a short line above the headline', 'si-hero-earth' )
					} ),
					el( be.RichText, {
						tagName: 0 === stage ? 'h1' : 'h2',
						className: 'si-hero__heading',
						value: a.heading,
						allowedFormats: HEADING_FORMATS,
						onChange: function ( v ) { set( { heading: v } ); },
						placeholder: __( 'Headline', 'si-hero-earth' )
					} ),
					el( be.RichText, {
						tagName: 'p',
						className: 'si-hero__lead',
						value: a.lead,
						allowedFormats: PLAIN_FORMATS,
						onChange: function ( v ) { set( { lead: v } ); },
						placeholder: __( 'One paragraph. Two sentences is usually one too many.', 'si-hero-earth' )
					} ),
					a.ctaEnabled && el( 'div', { className: 'si-hero__cta' },
						el( 'div', { className: 'si-hero__form' },
							el( be.RichText, {
								tagName: 'span',
								className: 'si-hero__form-placeholder',
								value: a.ctaPlaceholder,
								allowedFormats: [],
								onChange: function ( v ) { set( { ctaPlaceholder: v } ); },
								placeholder: __( 'Field placeholder', 'si-hero-earth' )
							} ),
							el( be.RichText, {
								tagName: 'span',
								className: 'si-hero__form-button',
								value: a.ctaButton,
								allowedFormats: [],
								onChange: function ( v ) { set( { ctaButton: v } ); },
								placeholder: __( 'Button', 'si-hero-earth' )
							} )
						),
						el( be.RichText, {
							tagName: 'p',
							className: 'si-hero__form-note',
							value: a.ctaNote,
							allowedFormats: PLAIN_FORMATS,
							onChange: function ( v ) { set( { ctaNote: v } ); },
							placeholder: __( 'Small print under the form', 'si-hero-earth' )
						} )
					)
				)
			);
		},

		save: function () {
			return null; // dynamic — render.php owns the markup
		}
	} );
} )( window.wp );
