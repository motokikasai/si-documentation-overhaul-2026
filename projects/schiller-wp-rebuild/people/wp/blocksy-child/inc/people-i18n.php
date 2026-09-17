<?php
/**
 * Strings the /people/ JavaScript writes (counts, empty states, the profile sheet …),
 * translated server-side and sent in the payload as `i18n`.
 *
 * Every entry is a literal __() / _x() call in text domain `si`, so WPML String
 * Translation (theme scan) and languages/si.pot see them like any theme string.
 * Plurals are split by CLDR category (one / few / many / other): English uses one +
 * other, Russian also few + many; the JS picks the category with Intl.PluralRules for
 * the page's <html lang>.
 *
 * GENERATED from STRINGS in people-core.js by build/make-i18n.py — edit STRINGS, rerun.
 * build/render-test.php fails if the two drift.
 *
 * @package blocksy-child
 */

defined('ABSPATH') || exit;

function si_people_i18n(): array {
	return [
		/* translators: numbered placeholders may be reordered */
		'count.filtered' => __('%1$s of %2$s', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'register.empty' => __('No one in the register matches “%s”.', 'si'),
		/* translators: numbered placeholders may be reordered */
		'register.empty_country' => __('No one in the register matches “%1$s” in %2$s.', 'si'),
		'register.clear' => __('Clear the search', 'si'),
		'register.ranked_heard' => __('Most heard in the archive', 'si'),
		'register.ranked_recent' => __('Most recently heard', 'si'),
		'sheet.close' => __('Close', 'si'),
		'sheet.eyebrow' => __('Person', 'si'),
		'sheet.conferences' => __('Conferences in the archive', 'si'),
		'sheet.no_conferences' => __('Appearances are listed on the full profile.', 'si'),
		'sheet.cta' => __('Full profile, talks & writings', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'sheet.photo_credit' => __('Photograph: %s', 'si'),
		'sheet.default_credit' => __('Schiller Institute', 'si'),
		'gallery.everyone' => __('Everyone', 'si'),
		'gallery.with_portrait' => __('With portrait', 'si'),
		'gallery.returning' => __('Heard more than once', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'gallery.decade' => __('The %ss', 'si'),
		/* translators: numbered placeholders may be reordered */
		'gallery.shown' => __('Showing %1$s of %2$s', 'si'),
		'gallery.empty' => __('No one matches these filters.', 'si'),
		'gallery.show_everyone' => __('Show everyone', 'si'),
		'chronicle.archive_begins' => __('the archive begins', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'chronicle.also_heard_in' => __('Also heard in %s', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'chronicle.heard_in' => __('Heard in %s', 'si'),
		'chronicle.unlinked_note' => __('In articles and recordings not yet tied to a conference', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'chronicle.empty' => __('Nothing in the chronicle matches “%s”.', 'si'),
		'chronicle.first' => __('first', 'si'),
		'chronicle.first_title' => __('First year in the archive', 'si'),
		/* translators: %s is replaced as shown in the English text */
		'chronicle.also_years' => __('Also %s', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'count.all.one' => _x('%s person', 'plural: one', 'si'),
		'count.all.few' => _x('%s people', 'plural: few', 'si'),
		'count.all.many' => _x('%s people', 'plural: many', 'si'),
		'count.all.other' => _x('%s people', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'names.one' => _x('%s name', 'plural: one', 'si'),
		'names.few' => _x('%s names', 'plural: few', 'si'),
		'names.many' => _x('%s names', 'plural: many', 'si'),
		'names.other' => _x('%s names', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'appearances.one' => _x('%s appearance', 'plural: one', 'si'),
		'appearances.few' => _x('%s appearances', 'plural: few', 'si'),
		'appearances.many' => _x('%s appearances', 'plural: many', 'si'),
		'appearances.other' => _x('%s appearances', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'more.one' => _x('and %s more', 'plural: one', 'si'),
		'more.few' => _x('and %s more', 'plural: few', 'si'),
		'more.many' => _x('and %s more', 'plural: many', 'si'),
		'more.other' => _x('and %s more', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'chronicle.voices.one' => _x('%s voice', 'plural: one', 'si'),
		'chronicle.voices.few' => _x('%s voices', 'plural: few', 'si'),
		'chronicle.voices.many' => _x('%s voices', 'plural: many', 'si'),
		'chronicle.voices.other' => _x('%s voices', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'chronicle.debuts.one' => _x('%s heard for the first time', 'plural: one', 'si'),
		'chronicle.debuts.few' => _x('%s heard for the first time', 'plural: few', 'si'),
		'chronicle.debuts.many' => _x('%s heard for the first time', 'plural: many', 'si'),
		'chronicle.debuts.other' => _x('%s heard for the first time', 'plural: other', 'si'),
		/* translators: plural forms — fill the categories your language uses (CLDR: one/few/many/other); %s is the number */
		'chronicle.speakers.one' => _x('%s speaker in the archive', 'plural: one', 'si'),
		'chronicle.speakers.few' => _x('%s speakers in the archive', 'plural: few', 'si'),
		'chronicle.speakers.many' => _x('%s speakers in the archive', 'plural: many', 'si'),
		'chronicle.speakers.other' => _x('%s speakers in the archive', 'plural: other', 'si'),
	];
}
