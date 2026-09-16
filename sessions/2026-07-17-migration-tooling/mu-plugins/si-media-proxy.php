<?php
/**
 * Plugin Name: SI Media Proxy (lab only)
 * Description: Serves uploads that are missing locally from the live site, so a rehearsal
 *              site renders its 66,994 attachments without mirroring ~50-80 GB of files.
 *
 * WHY
 * ---
 * A dump brings wp_posts and wp_postmeta. It does NOT bring wp-content/uploads. So a fresh
 * rehearsal site has every attachment ROW and no file behind any of them: featured images
 * break, the media library is a grid of placeholders, and PDFs 404. Mirroring the real
 * thing is ~37 GB of originals (measured, not guessed) before WordPress's generated sizes.
 *
 * For a lab site that is rebuilt from the dump repeatedly, copying tens of gigabytes each
 * time is the wrong trade. This rewrites the URL of any upload that is missing on disk to
 * the live host, and leaves files that ARE present alone — so a partial local mirror keeps
 * working and simply shrinks what gets proxied.
 *
 * SAFETY
 * ------
 * This must never run on production, where it would silently mask missing media and leak
 * traffic to another host. It therefore refuses to act unless the site URL looks like a
 * local development host, and it can be disabled outright with:
 *
 *     define('SI_MEDIA_PROXY', false);   // in wp-config.php
 *
 * It only ever rewrites URLs. It never writes files, never touches the database, and
 * removing this file restores the previous behaviour exactly.
 */

declare(strict_types=1);

if (!defined('ABSPATH')) { exit; }

final class SI_Media_Proxy {

    /** The canonical public host. NOT the dump's siteurl — that is the backup host
     *  (2.schillermeet.de) and its domain must not leak into anything (V6). */
    private const LIVE = 'https://schillerinstitute.com';

    /** Hosts this is allowed to run on. */
    private const LOCAL_SUFFIXES = ['.local', '.test', 'localhost', '127.0.0.1'];

    private static ?string $baseurl = null;
    private static ?string $basedir = null;
    private static array $exists = [];      // per-request memo for file_exists()

    public static function boot(): void {
        if (defined('SI_MEDIA_PROXY') && !SI_MEDIA_PROXY) { return; }
        if (!self::is_local()) { return; }

        add_filter('wp_get_attachment_url', [self::class, 'url'], 99);
        add_filter('wp_get_attachment_image_src', [self::class, 'image_src'], 99);
        add_filter('wp_calculate_image_srcset', [self::class, 'srcset'], 99);
        add_filter('the_content', [self::class, 'content'], 99);
        add_filter('wp_get_attachment_thumb_url', [self::class, 'url'], 99);
    }

    private static function is_local(): bool {
        $host = (string) wp_parse_url((string) get_option('siteurl'), PHP_URL_HOST);
        foreach (self::LOCAL_SUFFIXES as $s) {
            if ($host === $s || str_ends_with($host, $s)) { return true; }
        }
        return false;
    }

    private static function init_paths(): void {
        if (self::$baseurl !== null) { return; }
        $u = wp_get_upload_dir();
        self::$baseurl = rtrim((string) ($u['baseurl'] ?? ''), '/');
        self::$basedir = rtrim((string) ($u['basedir'] ?? ''), '/');
    }

    /**
     * Rewrite one uploads URL if — and only if — the file is not on disk here.
     */
    public static function url($url) {
        if (!is_string($url) || $url === '') { return $url; }
        self::init_paths();
        if (self::$baseurl === '' || !str_starts_with($url, self::$baseurl)) { return $url; }

        $rel = ltrim(substr($url, strlen(self::$baseurl)), '/');
        if ($rel === '') { return $url; }

        // Strip a query string before testing the path, keep it on the way out.
        $q = '';
        if (($pos = strpos($rel, '?')) !== false) { $q = substr($rel, $pos); $rel = substr($rel, 0, $pos); }

        $rel = str_replace('\\', '/', $rel);
        if (str_contains($rel, '../')) { return $url; }      // never proxy a traversal

        if (!isset(self::$exists[$rel])) {
            self::$exists[$rel] = is_file(self::$basedir . '/' . $rel);
        }
        if (self::$exists[$rel]) { return $url; }            // present locally: leave alone

        return self::LIVE . '/wp-content/uploads/' . $rel . $q;
    }

    public static function image_src($src) {
        if (is_array($src) && isset($src[0])) { $src[0] = self::url($src[0]); }
        return $src;
    }

    public static function srcset($sources) {
        if (is_array($sources)) {
            foreach ($sources as $k => $s) {
                if (isset($s['url'])) { $sources[$k]['url'] = self::url($s['url']); }
            }
        }
        return $sources;
    }

    /**
     * Images hard-coded in post_content were search-replaced to the local host at import,
     * so they never pass through the attachment filters. Rewrite them in the rendered
     * output. Cheap: one regex over content that is already being assembled.
     */
    public static function content($html) {
        if (!is_string($html) || $html === '') { return $html; }
        self::init_paths();
        if (self::$baseurl === '') { return $html; }

        return (string) preg_replace_callback(
            '~' . preg_quote(self::$baseurl, '~') . '/[^\s"\'<>)]+~',
            static fn(array $m): string => self::url($m[0]),
            $html
        );
    }
}

SI_Media_Proxy::boot();
