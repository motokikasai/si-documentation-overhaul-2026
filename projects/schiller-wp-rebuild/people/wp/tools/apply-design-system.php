<?php
/**
 * Write the Jasper palette and typography INTO Blocksy's own settings — reversibly.
 *
 * Local → Open Site Shell (WSL cannot reach Local's DB):
 *   wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php            # dry run
 *   wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php apply
 *   wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php rollback
 *   wp eval-file wp-content/themes/blocksy-child/tools/apply-design-system.php refresh    # rebuild Blocksy CSS only
 *
 * Why theme mods and not CSS: these are the values Blocksy's header, footer, buttons,
 * forms and block presets are generated from. Setting them here means every Blocksy
 * module agrees with Jasper, and the Customizer remains the place to adjust them.
 *
 * Three groups of settings:
 *  1. global theme mods — palette, root/h1–h6/button type, container widths;
 *  2. hero (page title) fonts — `<prefix>_pageTitleFont` / `<prefix>_pageMetaFont` for
 *     every prefix Blocksy styles (same list as blocksy/inc/dynamic-styles/page-title/all.php);
 *  3. header/footer builder item fonts — inside `header_placements` / `footer_placements`,
 *     patched the way Blocksy's own patch_value_for() does it.
 *
 * Every write is read back; Blocksy's regenerated CSS is checked too. The value each
 * setting had before Jasper first touched it is kept in option `si_jasper_backup`, so
 * `rollback` restores exactly that — and for builder items only the font values, so
 * header/footer layout edits made after apply survive a rollback.
 * Requires the child theme to be active (si_jasper_palette() lives in inc/jasper.php).
 */

if (!defined('WP_CLI') || !WP_CLI) {
	echo "Run with wp eval-file.\n";
	return;
}
if (!function_exists('si_jasper_palette')) {
	WP_CLI::error('inc/jasper.php is not loaded — is blocksy-child the active theme?');
}
if (!function_exists('blocksy_manager')) {
	WP_CLI::error('Blocksy is not the parent theme of the active theme.');
}

$mode = $args[0] ?? 'dry-run';
$UNSET = '__unset__';

/**
 * Regenerate Blocksy's dynamic CSS from the values just written. Blocksy\Database caches
 * get_theme_mods() on first read and only re-reads it in admin/customizer/AJAX requests —
 * under WP-CLI it has already cached the OLD values, so without wipe_cache() the
 * regenerated global.css silently keeps the previous palette (seen on si-v4, 2026-09-17).
 */
$refresh = static function (): void {
	if (isset(blocksy_manager()->db) && method_exists(blocksy_manager()->db, 'wipe_cache')) {
		blocksy_manager()->db->wipe_cache();
	}
	do_action('blocksy:dynamic-css:refresh-caches');
};

// Read back from Blocksy's generated CSS file, where the regeneration actually lands.
$css_missing = static function (array $needles): array {
	$file = wp_upload_dir()['basedir'] . '/blocksy/css/global.css';
	if (!is_readable($file)) {
		return ['(no global.css — Blocksy may be printing its CSS inline; check the page source)'];
	}
	$css = (string) file_get_contents($file);
	return array_values(array_filter($needles, static fn($n) => strpos($css, $n) === false));
};
$css_needles = [
	'--theme-palette-color-1:#1F4A73',
	'--theme-font-family:var(--si-font-serif)',
	'--theme-font-family:var(--si-font-sans)',
];

$type = static function (array $v): array {
	// Blocksy's typography value shape (blocksy_typography_default_values). Plain strings,
	// as Blocksy's own defaults use: the sizes are already fluid, so no per-device values.
	return [
		'family'          => $v['family'],
		'variation'       => $v['variation'],
		'size'            => $v['size'],
		'line-height'     => $v['lh'] ?? 'CT_CSS_SKIP_RULE',
		'letter-spacing'  => $v['ls'] ?? '0em',
		'text-transform'  => $v['tt'] ?? 'none',
		'text-decoration' => 'none',
	];
};

$serif = 'var(--si-font-serif)';   // Blocksy passes var(--…) families through verbatim
$sans  = 'var(--si-font-sans)';    // and therefore loads no Google Font for them

// ---- 1 · global theme mods ------------------------------------------------------------
$target = [
	'colorPalette'         => si_jasper_palette(),   // Blocksy 2 keeps only color1…colorN here
	'rootTypography'       => $type(['family' => $serif, 'variation' => 'n4', 'size' => 'var(--si-step-0)', 'lh' => '1.62']),
	'h1Typography'         => $type(['family' => $serif, 'variation' => 'n3', 'size' => 'var(--si-step-5)', 'lh' => '1.08', 'ls' => '-0.012em']),
	'h2Typography'         => $type(['family' => $serif, 'variation' => 'n4', 'size' => 'var(--si-step-4)', 'lh' => '1.12', 'ls' => '-0.01em']),
	'h3Typography'         => $type(['family' => $serif, 'variation' => 'n5', 'size' => 'var(--si-step-3)', 'lh' => '1.2']),
	'h4Typography'         => $type(['family' => $serif, 'variation' => 'n5', 'size' => 'var(--si-step-2)', 'lh' => '1.25']),
	'h5Typography'         => $type(['family' => $serif, 'variation' => 'n6', 'size' => 'var(--si-step-1)', 'lh' => '1.3']),
	'h6Typography'         => $type(['family' => $sans,  'variation' => 'n6', 'size' => 'var(--si-step-n2)', 'lh' => '1.4', 'ls' => '0.14em', 'tt' => 'uppercase']),
	'buttons'              => $type(['family' => $sans,  'variation' => 'n6', 'size' => '15px', 'ls' => '0.02em']),
	'maxSiteWidth'         => 1240,
	'narrowContainerWidth' => 760,
];
$global_keys = array_keys($target);

// ---- 2 · hero fonts: page titles read (serif), post details signpost (sans caps) --------
$prefixes = ['single_blog_post', 'blog', 'categories', 'search', 'author', 'single_page'];
foreach (blocksy_manager()->post_types->get_supported_post_types() as $cpt) {
	$prefixes[] = $cpt . '_single';
	$prefixes[] = $cpt . '_archive';
}
$prefixes = array_values(array_unique(apply_filters('blocksy:hero:dynamic-styles:prefixes', $prefixes)));
$title_font = $type(['family' => $serif, 'variation' => 'n4', 'size' => 'var(--si-step-4)', 'lh' => '1.12', 'ls' => '-0.01em']);
$meta_font  = $type(['family' => $sans,  'variation' => 'n6', 'size' => 'var(--si-step-n2)', 'lh' => '1.3', 'ls' => '0.12em', 'tt' => 'uppercase']);
foreach ($prefixes as $prefix) {
	$target[$prefix . '_pageTitleFont'] = $title_font;
	$target[$prefix . '_pageMetaFont']  = $meta_font;
}

// ---- 3 · builder item fonts: navigation is signposting (sans) -------------------------
$menu_font     = $type(['family' => $sans, 'variation' => 'n5', 'size' => '15px', 'lh' => '1.3', 'ls' => '0.01em']);
$dropdown_font = $type(['family' => $sans, 'variation' => 'n4', 'size' => '14px', 'lh' => '1.4']);
$builder_fonts = [
	'header_placements' => [
		'menu'           => ['headerMenuFont' => $menu_font, 'headerDropdownFont' => $dropdown_font],
		'menu-secondary' => ['headerMenuFont' => $menu_font, 'headerDropdownFont' => $dropdown_font],
		'mobile-menu'    => ['mobileMenuFont' => $type(['family' => $sans, 'variation' => 'n5', 'size' => '20px', 'lh' => '1.3']),
		                     'mobileMenuDropdownFont' => $type(['family' => $sans, 'variation' => 'n4', 'size' => '15px', 'lh' => '1.4'])],
		'button'         => ['headerButtonFont' => $type(['family' => $sans, 'variation' => 'n6', 'size' => '14px', 'ls' => '0.02em'])],
	],
	'footer_placements' => [
		'menu'      => ['footerMenuFont' => $type(['family' => $sans, 'variation' => 'n5', 'size' => '13px', 'lh' => '1.3', 'ls' => '0.08em', 'tt' => 'uppercase'])],
		'copyright' => ['copyrightFont' => $type(['family' => $sans, 'variation' => 'n4', 'size' => '14px', 'lh' => '1.5'])],
	],
];
$builders = [
	'header_placements' => blocksy_manager()->header_builder,
	'footer_placements' => blocksy_manager()->footer_builder,
];

/** Item ids placed anywhere in a builder section. Header: desktop/mobile → rows →
 *  placements → items: ['menu', …]; footer: rows → columns: [['copyright'], …]. Either
 *  way a placed item is a string in a list, so collect strings under numeric keys. */
$placed_ids = static function (array $section): array {
	$ids = [];
	$walk = static function ($node) use (&$walk, &$ids) {
		if (!is_array($node)) {
			return;
		}
		foreach ($node as $k => $v) {
			if (is_int($k) && is_string($v)) {
				$ids[] = $v;
			} else {
				$walk($v);
			}
		}
	};
	foreach ($section as $k => $v) {
		if ($k !== 'items' && $k !== 'settings') {   // items[] holds item settings, not placements
			$walk($v);
		}
	}
	return array_values(array_unique($ids));
};

/** [path => [current, wanted]] for every builder font Jasper sets; path = mod|section|item|key. */
$builder_plan = static function () use ($builder_fonts, $builders, $placed_ids, $UNSET): array {
	$plan = [];
	foreach ($builder_fonts as $mod => $items) {
		$value = blocksy_get_theme_mod($mod, $builders[$mod]->get_default_value());
		foreach ($value['sections'] ?? [] as $section) {
			$present = [];
			foreach ($section['items'] ?? [] as $item) {
				$present[$item['id']] = $item;
			}
			$ids = array_unique(array_merge(array_keys($present), $placed_ids($section)));
			foreach ($items as $item_id => $fonts) {
				if (!in_array($item_id, $ids, true)) {
					continue;
				}
				foreach ($fonts as $key => $wanted) {
					$now = $present[$item_id]['values'][$key] ?? $UNSET;
					$plan["$mod|{$section['id']}|$item_id|$key"] = [$now, $wanted];
				}
			}
		}
	}
	return $plan;
};

/** Write values into the builder mods; $UNSET removes the key (Blocksy's default again). */
$builder_write = static function (array $values) use ($builders, $UNSET): void {
	$by_mod = [];
	foreach ($values as $path => $v) {
		[$mod, $section_id, $item_id, $key] = explode('|', $path);
		$by_mod[$mod][] = [$section_id, $item_id, $key, $v];
	}
	foreach ($by_mod as $mod => $changes) {
		$value = blocksy_get_theme_mod($mod, $builders[$mod]->get_default_value());
		foreach ($changes as [$section_id, $item_id, $key, $v]) {
			foreach ($value['sections'] as $si => $section) {
				if ($section['id'] !== $section_id) {
					continue;
				}
				$ii = null;
				foreach ($section['items'] ?? [] as $idx => $item) {
					if ($item['id'] === $item_id) {
						$ii = $idx;
						break;
					}
				}
				if ($ii === null) {
					if ($v === $UNSET) {
						continue;
					}
					$value['sections'][$si]['items'][] = ['id' => $item_id, 'values' => []];
					$ii = array_key_last($value['sections'][$si]['items']);
				}
				if ($v === $UNSET) {
					unset($value['sections'][$si]['items'][$ii]['values'][$key]);
					// an entry with no values is what apply created; Blocksy reads defaults either way
					if (empty($value['sections'][$si]['items'][$ii]['values'])) {
						unset($value['sections'][$si]['items'][$ii]);
						$value['sections'][$si]['items'] = array_values($value['sections'][$si]['items']);
					}
				} else {
					$value['sections'][$si]['items'][$ii]['values'][$key] = $v;
				}
			}
		}
		set_theme_mod($mod, $value);
	}
};

// ---- modes --------------------------------------------------------------------------------
$backup = get_option('si_jasper_backup');
$backup = is_array($backup) ? $backup : null;

if ($mode === 'rollback') {
	if (!$backup) {
		WP_CLI::error('No backup recorded — nothing to roll back.');
	}
	$builder_backup = $backup['__builder__'] ?? [];
	$backup_unset_mods = $backup['__builder_unset__'] ?? [];
	unset($backup['__builder__'], $backup['__builder_unset__']);
	foreach ($backup as $k => $v) {
		$v === $UNSET ? remove_theme_mod($k) : set_theme_mod($k, $v);
	}
	$builder_write($builder_backup);
	// builder mods that did not exist before apply go away again (Blocksy falls back to its default layout)
	foreach ($backup_unset_mods as $mod) {
		remove_theme_mod($mod);
	}
	$refresh();
	delete_option('si_jasper_backup');
	WP_CLI::success(sprintf('Restored %d Blocksy settings and %d builder fonts from the backup.', count($backup), count($builder_backup)));
	return;
}

if ($mode === 'refresh') {
	$refresh();
	$missing = $css_missing($css_needles);
	$missing ? WP_CLI::error('Still missing in global.css: ' . implode('; ', $missing)) : WP_CLI::success('Blocksy CSS regenerated with Jasper.');
	return;
}

$current = [];
foreach (array_keys($target) as $k) {
	$current[$k] = get_theme_mod($k, $UNSET);
}
$plan = $builder_plan();

$state = static fn($now, $want) => $now === $want ? 'already set' : ($now === $UNSET ? 'unset → set' : 'differs → set');
foreach ($global_keys as $k) {
	WP_CLI::log(sprintf('%-46s %s', $k, $state($current[$k], $target[$k])));
}
$hero_changes = count(array_filter($prefixes, static fn($p) => $current[$p . '_pageTitleFont'] !== $title_font || $current[$p . '_pageMetaFont'] !== $meta_font));
WP_CLI::log(sprintf('%-46s %d of %d content types change', 'page title + meta fonts', $hero_changes, count($prefixes)));
WP_CLI::log('    ' . implode(', ', $prefixes));
foreach ($plan as $path => [$now, $want]) {
	WP_CLI::log(sprintf('%-46s %s', str_replace('|', ' › ', $path), $state($now, $want)));
}
if (!$plan) {
	WP_CLI::log('(no header/footer builder items with fonts to set)');
}
if ($mode !== 'apply') {
	WP_CLI::log("\nDry run. Re-run with `apply` to write, `rollback` to undo, `refresh` to rebuild Blocksy's CSS.");
	return;
}

// Backup = the value each setting had before Jasper FIRST touched it. Keys added in later
// versions of this script are recorded by the apply that first writes them.
$backup = $backup ?? [];
foreach ($current as $k => $v) {
	if (!array_key_exists($k, $backup)) {
		$backup[$k] = $v;
	}
}
$backup['__builder__'] = $backup['__builder__'] ?? [];
$backup['__builder_unset__'] = $backup['__builder_unset__'] ?? [];
foreach (array_keys($builder_fonts) as $mod) {
	$known = array_filter(array_keys($backup['__builder__']), static fn($p) => str_starts_with($p, "$mod|"));
	if (!$known && get_theme_mod($mod, $UNSET) === $UNSET) {
		$backup['__builder_unset__'][] = $mod;   // first touch, and Blocksy has never saved this builder
	}
}
foreach ($plan as $path => [$now]) {
	if (!array_key_exists($path, $backup['__builder__'])) {
		$backup['__builder__'][$path] = $now;
	}
}
update_option('si_jasper_backup', $backup, false);

foreach ($target as $k => $v) {
	set_theme_mod($k, $v);
}
$builder_write(array_map(static fn($pair) => $pair[1], $plan));
blocksy_manager()->db->wipe_cache();

// Read back — a setup script that does not verify what it wrote has not finished.
$bad = [];
foreach ($target as $k => $v) {
	if (get_theme_mod($k) !== $v) {
		$bad[] = $k;
	}
}
foreach ($builder_plan() as $path => [$now, $want]) {
	if ($now !== $want) {
		$bad[] = $path;
	}
}
if ($bad) {
	WP_CLI::error('Read-back mismatch: ' . implode(', ', $bad) . ' (backup kept; run `rollback`).');
}

$refresh();
$missing = $css_missing($css_needles);
if ($missing) {
	WP_CLI::error("Settings are saved, but Blocksy's CSS does not show them yet: " . implode('; ', $missing));
}
WP_CLI::success(sprintf(
	'Jasper written to Blocksy (%d global settings, title/meta fonts for %d content types, %d builder fonts); Blocksy CSS regenerated. Check the front end makes no request to fonts.googleapis.com.',
	count($global_keys), count($prefixes), count($plan)
));
