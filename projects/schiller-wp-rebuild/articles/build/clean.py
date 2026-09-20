#!/usr/bin/env python3
"""
Legacy body → clean reading HTML.

This mirrors, in Python and for the prototypes only, what
`SI_Shortcodes::convert()` in `mu-plugins/si-migrate.php` does to the real
content at migration time — the authority is
`sessions/2026-07-17-migration-tooling/03-shortcode-conversion-table.md`.
Nothing here ships to WordPress: by the time the theme renders an article the
body is already converted, so the child theme only needs the `.si-*` stylesheet
that table's §5 asks for (templates/css/article-shared.css).

The one thing this file adds beyond the table is *hygiene*: the 2012–2026 bodies
carry Vanguard/TinyMCE `<span style>` debris, inline font sizes and empty
paragraphs. A reading page cannot be calm if every third paragraph sets its own
font. So presentational attributes are dropped and only structural tags survive.
"""
import html as _html
import re

LIVE = 'https://schillerinstitute.com'

# Tags a reading column may contain. Everything else is unwrapped (its text is
# kept) or, for the media/script family, removed with its content.
KEEP = {'p', 'br', 'em', 'i', 'strong', 'b', 'a', 'h2', 'h3', 'h4', 'h5',
        'blockquote', 'ul', 'ol', 'li', 'figure', 'figcaption', 'img', 'hr',
        'sup', 'sub', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'details',
        'summary', 'aside', 'pre', 'div', 'span'}
DROP_WITH_CONTENT = {'script', 'style', 'iframe', 'noscript', 'form', 'input', 'object', 'embed'}
# Attributes that survive. `class` survives only for si-* values (see clean_attrs).
ATTRS = {'a': ['href', 'title'], 'img': ['src', 'alt', 'width', 'height'],
         'td': ['colspan', 'rowspan'], 'th': ['colspan', 'rowspan', 'scope'],
         'figure': ['data-yt', 'data-embed']}

def normalize_domains(s):
    for host in ('https://2.schillermeet.de', 'http://2.schillermeet.de',
                 'https://www.schillermeet.de', 'http://www.schillermeet.de',
                 'https://schillermeet.de', 'http://schillermeet.de',
                 'https://newparadigm.schillerinstitute.com', 'http://newparadigm.schillerinstitute.com',
                 'http://schillerinstitute.com', 'http://schillerinstitut.com',
                 'https://schillerinstitut.com'):
        s = s.replace(host, LIVE)
    return s


# ---------------------------------------------------------------- shortcodes
def _attr(raw, name):
    m = re.search(r'%s\s*=\s*"([^"]*)"' % name, raw) or re.search(r"%s\s*=\s*'([^']*)'" % name, raw)
    return m.group(1).strip() if m else ''


def convert_shortcodes(s):
    # [caption …]<img …> text[/caption]  → figure (WP core token, §2)
    def _caption(m):
        inner = m.group(2)
        img = re.search(r'(?is)<img[^>]*>', inner)
        text = re.sub(r'(?is)<img[^>]*>', '', inner)
        text = re.sub(r'(?is)</?a[^>]*>', '', text).strip()
        return '<figure>%s%s</figure>' % (
            img.group(0) if img else '',
            '<figcaption>%s</figcaption>' % text if text else '')
    s = re.sub(r'(?is)\[caption([^\]]*)\](.*?)\[/caption\]', _caption, s)

    s = re.sub(r'(?is)\[title_big([^\]]*?)/?\]', lambda m: '<h2 class="si-title-big">%s</h2>%s' % (
        _attr(m.group(1), 'title'),
        ('<p class="si-subtitle">%s</p>' % _attr(m.group(1), 'subTitle')) if _attr(m.group(1), 'subTitle') else ''), s)
    s = re.sub(r'(?is)\[title_small([^\]]*?)/?\]',
               lambda m: '<h3 class="si-title-small">%s</h3>' % _attr(m.group(1), 'title'), s)
    s = re.sub(r'(?is)\[button([^\]]*?)/?\]',
               lambda m: '<p class="si-button"><a class="si-btn" href="%s">%s</a></p>' % (
                   _attr(m.group(1), 'url') or '#', _attr(m.group(1), 'text') or 'Read more'), s)
    s = re.sub(r'(?is)\[toggle([^\]]*)\]', lambda m: '<details class="si-toggle"><summary>%s</summary>'
               % (_attr(m.group(1), 'title') or 'More'), s)
    s = re.sub(r'(?is)\[/toggle\]', '</details>', s)
    s = re.sub(r'(?is)\[hr[^\]]*\]', '<hr/>', s)
    s = re.sub(r'(?is)\[info_box([^\]]*)\]', lambda m: '<aside class="si-info-box">%s' % (
        ('<h4>%s</h4>' % _attr(m.group(1), 'title')) if _attr(m.group(1), 'title') else ''), s)
    s = re.sub(r'(?is)\[/info_box\]', '</aside>', s)
    s = re.sub(r'(?is)\[testimonial([^\]]*)\](.*?)\[/testimonial\]',
               lambda m: '<figure class="si-testimonial"><blockquote>%s</blockquote>%s</figure>' % (
                   m.group(2), ('<figcaption>— %s</figcaption>' % _attr(m.group(1), 'person'))
                   if _attr(m.group(1), 'person') else ''), s)
    s = re.sub(r'(?is)\[call_to_action_(\w+)([^\]]*?)/?\]', lambda m: (
        '<div class="si-cta call-to-action-%s">%s%s%s</div>' % (
            m.group(1),
            ('<h3>%s</h3>' % _attr(m.group(2), 'title')) if _attr(m.group(2), 'title') else '',
            ('<p>%s</p>' % _attr(m.group(2), 'excerpt')) if _attr(m.group(2), 'excerpt') else '',
            ('<p class="si-button"><a class="si-btn" href="%s">%s</a></p>' % (
                _attr(m.group(2), 'buttonUrl'), _attr(m.group(2), 'buttonText')))
            if _attr(m.group(2), 'buttonUrl') else '')), s)
    s = re.sub(r'(?is)\[image([^\]]*?)/?\]', lambda m: '<img class="si-image" src="%s" alt="%s">' % (
        _attr(m.group(1), 'img'), _attr(m.group(1), 'alt')), s)
    for frac, cls in (('one_half', '1-2'), ('one_third', '1-3'), ('two_third', '2-3'), ('one_fourth', '1-4')):
        s = re.sub(r'(?is)\[%s(_last)?\]' % frac, '<div class="si-col si-col-%s">' % cls, s)
        s = re.sub(r'(?is)\[/%s(_last)?\]' % frac, '</div>', s)
    s = re.sub(r'(?is)\[/?(wide_bar|tabs|tab)[^\]]*\]', '', s)
    s = re.sub(r'(?is)\[applause\]', '<em>(applause)</em>', s)
    s = re.sub(r'(?is)\[(space|clear|divider|frame)[^\]]*\]', '', s)
    s = re.sub(r'(?is)\[/?blockquote[^\]]*\]', lambda m: '</blockquote>' if m.group(0)[1] == '/' else '<blockquote>', s)
    s = re.sub(r'(?is)\[FN\s*(\d+)\]', lambda m: '<sup class="si-fn">[%s]</sup>' % m.group(1), s)
    # a [hr] that opened a paragraph leaves its text orphaned when wpautop unwraps
    s = re.sub(r'(?is)<p([^>]*)>\s*<hr\s*/?>', r'<hr /><p\1>', s)
    # Anything left that is a *known* Vanguard token shape: drop the marker, keep text.
    s = re.sub(r'(?is)\[/?(?:vc_[a-z_]+|ajax_load_more|portfolio|gallery|playlist|embed|audio|video)[^\]]*\]', '', s)
    return s


# ---------------------------------------------------------- Gutenberg blocks
# 1,739 of the 4,140 bodies are block markup, and 1,417 of them embed a
# YouTube video — video is not a garnish on these articles, it is often the
# thing the article is about. An embed becomes a FACADE (`si-embed` + the id):
# the reading templates load nothing from YouTube until the reader clicks, the
# same two-click rule the /people/ profile drafts use.
YT = re.compile(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|live/|shorts/|v/))([A-Za-z0-9_-]{6,})')
BARE_URL_LINE = re.compile(r'(?m)^[ \t]*(https?://[^\s<]+)[ \t]*$')


def _facade(url):
    m = YT.search(url)
    if m:
        return '<figure class="si-embed" data-yt="%s"></figure>' % m.group(1)
    return '<p class="si-embed-link"><a href="%s">%s</a></p>' % (url, url)


def convert_blocks(s):
    def _embed(m):
        inner = re.sub(r'(?s)<[^>]+>', ' ', m.group(0))
        url = re.search(r'https?://[^\s<]+', inner)
        return _facade(url.group(0)) if url else ''
    s = re.sub(r'(?is)<figure[^>]*\bwp-block-embed\b[^>]*>.*?</figure>', _embed, s)
    s = BARE_URL_LINE.sub(lambda m: _facade(m.group(1)) if YT.search(m.group(1)) else m.group(0), s)
    # the classic editor auto-embedded a URL that was a paragraph on its own
    s = re.sub(r'(?is)<p[^>]*>\s*(https?://[^\s<]+)\s*</p>',
               lambda m: _facade(m.group(1)) if YT.search(m.group(1)) else m.group(0), s)
    s = re.sub(r'(?is)<div[^>]*\bwp-block-file\b[^>]*>(.*?)</div>',
               lambda m: '<p class="si-file">%s</p>' % m.group(1), s)
    s = re.sub(r'(?is)<div[^>]*\bwp-block-button\b[^>]*>(.*?)</div>',
               lambda m: '<p class="si-button">%s</p>' % m.group(1), s)
    # buttons / file downloads: keep the link, name it in the si-* vocabulary
    s = re.sub(r'(?is)class="([^"]*)\bwp-(?:block-button__link|block-file__button|element-button)\b([^"]*)"',
               'class="si-btn"', s)
    s = re.sub(r'(?is)<hr[^>]*\bwp-block-separator\b[^>]*/?>', '<hr />', s)
    s = re.sub(r'(?is)<blockquote([^>]*)\bwp-block-pullquote\b([^>]*)>', '<blockquote class="si-pullquote">', s)
    s = re.sub(r'(?is)<figure[^>]*\bwp-block-pullquote\b[^>]*>', '<figure class="si-pullquote">', s)
    s = re.sub(r'(?is)\[embed[^\]]*\](.*?)\[/embed\]',
               lambda m: _facade(re.sub(r'(?s)<[^>]+>', '', m.group(1)).strip()), s)
    # Vanguard wrapped whole paragraphs in bare <div>s. WordPress leaves that text
    # unwrapped and the div carries the spacing; with the div gone the run has to
    # become a paragraph, so the divs turn into paragraph breaks before wpautop.
    s = re.sub(r'(?is)</?div[^>]*>', '\n\n', s)
    return s


# ------------------------------------------------------------------ cleaning
def clean_attrs(tag, raw):
    out = []
    for name in ATTRS.get(tag, []):
        v = _attr(raw, name)
        if not v:
            continue
        if name == 'href':
            v = normalize_domains(v)
            if v.startswith('javascript:'):
                continue
        if name == 'src':
            v = normalize_domains(v)
            if v.startswith('//'):
                v = 'https:' + v
            if v.startswith('http://'):
                v = 'https://' + v[7:]
        out.append('%s="%s"' % (name, _html.escape(v, quote=True)))
    cls = _attr(raw, 'class')
    keep = ' '.join(c for c in cls.split() if c.startswith('si-') or c.startswith('call-to-action'))
    if keep:
        out.append('class="%s"' % keep)
    if tag == 'img':
        out += ['loading="lazy"', 'decoding="async"']
    return (' ' + ' '.join(out)) if out else ''


def sanitize(s):
    s = re.sub(r'(?is)<(%s)\b.*?</\1\s*>' % '|'.join(DROP_WITH_CONTENT), ' ', s)
    s = re.sub(r'(?is)<(%s)\b[^>]*/?>' % '|'.join(DROP_WITH_CONTENT), ' ', s)
    s = re.sub(r'(?s)<!--.*?-->', ' ', s)

    def _tag(m):
        closing, name, raw = m.group(1), m.group(2).lower(), m.group(3)
        if name not in KEEP:
            return ''
        if name in ('div', 'span'):
            # kept only when it carries a converted si-* class; otherwise unwrapped
            cls = _attr(raw, 'class')
            if name == 'div' and any(c.startswith('si-') for c in cls.split()):
                return '</div>' if closing else '<div class="%s">' % cls
            return ''
        if closing:
            return '</%s>' % name
        selfclose = ' /' if name in ('br', 'img', 'hr') else ''
        return '<%s%s%s>' % (name, clean_attrs(name, raw), selfclose)

    return re.sub(r'(?is)<(/?)([a-z0-9]+)((?:\s[^>]*)?)/?>', _tag, s)


ALLBLOCKS = (r'(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|'
             r'ul|ol|li|pre|form|map|area|blockquote|address|math|style|p|h[1-6]|hr|'
             r'fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|'
             r'figcaption|details|menu|summary)')


def wpautop(pee, br=True):
    """A port of WordPress's own wpautop().

    It has to be this and not something simpler: the legacy bodies mix real
    blocks with bare text runs separated by CRLFs (post 55739 has twenty <p>
    tags and two hundred loose lines), and `the_content` on the live site
    wraps exactly those runs. Anything less and half an article renders as one
    unbroken slab.
    """
    if not pee or not pee.strip():
        return ''
    pee = pee.replace('\r\n', '\n').replace('\r', '\n') + '\n'
    pee = re.sub(r'(?i)<br\s*/?>\s*<br\s*/?>', '\n\n', pee)
    pee = re.sub(r'(?i)(<' + ALLBLOCKS + r'[\s/>])', r'\n\n\1', pee)
    pee = re.sub(r'(?i)(</' + ALLBLOCKS + r'>)', r'\1\n\n', pee)
    pee = re.sub(r'\n\n+', '\n\n', pee)
    pee = ''.join('<p>%s</p>\n' % p.strip() for p in re.split(r'\n\s*\n', pee) if p.strip())
    pee = re.sub(r'(?i)<p>\s*</p>', '', pee)
    pee = re.sub(r'(?i)<p>\s*(</?' + ALLBLOCKS + r'[^>]*>)\s*</p>', r'\1', pee)
    pee = re.sub(r'(?i)<p>(<li[^>]*>.*?)</p>', r'\1', pee)
    pee = re.sub(r'(?i)<p><blockquote([^>]*)>', r'<blockquote\1><p>', pee)
    pee = re.sub(r'(?i)</blockquote></p>', '</p></blockquote>', pee)
    pee = re.sub(r'(?i)<p>\s*(</?' + ALLBLOCKS + r'[^>]*>)', r'\1', pee)
    pee = re.sub(r'(?i)(</?' + ALLBLOCKS + r'[^>]*>)\s*</p>', r'\1', pee)
    if br:
        pee = re.sub(r'(?i)(?<!<br />)\s*\n', '<br />\n', pee)
        pee = re.sub(r'(?i)(</?' + ALLBLOCKS + r'[^>]*>)\s*<br />', r'\1', pee)
        pee = re.sub(r'(?i)<br />(\s*</?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)', r'\1', pee)
    return re.sub(r'(?i)\n</p>', '</p>', pee).strip()


BLOCK_END = r'(?:p|h[2-6]|div|figure|blockquote|ul|ol|table|aside|details)'


def tidy(s):
    s = re.sub(r'(?is)<p>(\s|&nbsp;|<br\s*/?>)*</p>', '', s)
    # Vanguard left bare &nbsp; runs BETWEEN blocks; they print as blank bands.
    s = re.sub(r'(?is)(</%s>|<hr\s*/?>)(\s|&nbsp;|\u00a0)+(?=<)' % BLOCK_END, r'\1', s)
    s = re.sub(r'(?is)(<br\s*/?>\s*){3,}', '<br /><br />', s)
    s = re.sub(r'(?is)<(strong|em|b|i)>(\s|<br\s*/?>|&nbsp;)*</\1>', '', s)
    # an unwrapped <p> left over where wpautop's own unwrap rules crossed
    s = re.sub(r'(?is)<p>\s*(?=<(?:hr|h[2-6]|figure|blockquote|ul|ol|table|aside|details)\b)', '', s)
    s = re.sub(r'(?is)(</(?:hr|h[2-6]|figure|blockquote|ul|ol|table|aside|details)>)\s*</p>', r'\1', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    # a body that OPENS with a rule is a legacy separator, not content
    s = re.sub(r'(?is)^\s*(?:<hr\s*/?>\s*)+', '', s)
    return balance_p(s.strip())


def balance_p(s):
    """Legacy bodies contain stray `</p>`; wpautop's unwrap rules can leave one
    behind too. An unmatched close breaks the reading column in every browser,
    so drop the orphans and close what is still open."""
    out, depth = [], 0
    pos = 0
    for m in re.finditer(r'(?i)</?p\b[^>]*>', s):
        out.append(s[pos:m.start()])
        pos = m.end()
        if m.group(0).startswith('</'):
            if depth:
                depth -= 1
                out.append('</p>')
        else:
            if depth:                      # <p> inside <p>: close the first
                out.append('</p>')
                depth -= 1
            out.append(m.group(0))
            depth += 1
    out.append(s[pos:])
    out.append('</p>' * depth)
    return ''.join(out)


# The legacy bodies put the byline in a paragraph or a heading, and not always
# first: post 55739 opens with a rule, then the article's own title, and only
# then "<em>By Hussein Askary and Jason Ross</em>". Group 1 is the prefix that
# must survive; group 2 is the byline block to lift; group 4 is the name.
BYLINE_LEAD = re.compile(
    r"(?is)^(\s*(?:<hr\s*/?>\s*)?(?:<(h[2-6])[^>]*>.*?</\2>\s*)?)"
    r"(<(p|h[2-6])[^>]*>\s*(?:<(?:strong|em|b|i)>\s*)*"
    r"(?:by|von|par)\s+([^<\n.]{3,80}?)\s*"
    r"(?:</(?:strong|em|b|i)>\s*)*</\4>)\s*")


def lift_byline(s, name):
    """Remove the article's own 'By X' line when the page already prints that
    byline in its dateline. Only when the names agree — never guessing."""
    if not name:
        return s, False
    m = BYLINE_LEAD.match(s)
    if not m:
        return s, False
    found = re.sub(r"\s+", " ", m.group(5)).strip().lower().rstrip(",")
    want = name.strip().lower()
    if found == want or want in found or found in want:
        return m.group(1) + s[m.end():], True
    return s, False


def convert(raw_html, byline_name=None, title=''):
    s = normalize_domains(raw_html or '')
    # Block delimiters first: wpautop would otherwise wrap them as text.
    s = re.sub(r'(?s)<!--.*?-->', '', s)
    s = convert_blocks(s)
    s = convert_shortcodes(s)
    s = wpautop(s)
    s = sanitize(s)
    s = tidy(s)
    s, lifted = lift_byline(s, byline_name)
    s, deck = normalise_structure(s, title)
    s, notes = link_footnotes(s)
    return s, {'byline_lifted': lifted, 'deck': deck, 'notes': notes}



# ==========================================================================
# STRUCTURE — making fourteen years of ad-hoc formatting read as one publication
# ==========================================================================
# The bodies use heading tags arbitrarily: 318 posts have only <h3>, 61 only
# <h4>, 6 only <h5>, 79 jump straight from <h2> to <h4>. Nothing is wrong with
# the *text*; what is wrong is the outline, and an outline can be repaired
# mechanically without touching a word. Four passes, all structural:
#
#   1. throw away empty headings (28 posts)
#   2. throw away a first heading that just repeats the post title (39 posts)
#   3. lift a heading that OPENS the body out of the prose and hand it back as
#      the article's deck (329 posts) — a heading with nothing before it is not
#      breaking a section, it is the subtitle
#   4. re-level whatever headings remain onto h2, h3, h4 in the order they
#      already appear, so every article has the same shape of outline
#
# What is deliberately NOT done: nothing invents a heading, nothing changes the
# words in one, and nothing touches capitalisation (the ALL-CAPS test matches
# every Cyrillic heading in the archive, which is why that idea was dropped).

HEADING = re.compile(r'(?is)<(h[2-5])([^>]*)>(.*?)</\1>')


def _plain(html):
    return re.sub(r'\s+', ' ', re.sub(r'(?s)<[^>]+>', '', html or '')).strip()


def _key(text):
    return re.sub(r'[^0-9a-z\u0400-\u04ff]+', '', (text or '').lower())


def normalise_structure(s, title=''):
    """Returns (html, deck) — deck is the lifted opening heading, or None."""
    # 1 · empty headings
    s = re.sub(r'(?is)<(h[2-5])[^>]*>(?:\s|&nbsp;|\u00a0|<br\s*/?>)*</\1>\s*', '', s)
    # a heading whose whole content is bold adds nothing: Jasper sets the weight
    s = re.sub(r'(?is)<(h[2-5])([^>]*)>\s*<(?:strong|b)>(.*?)</(?:strong|b)>\s*</\1>',
               r'<\1\2>\3</\1>', s)

    first = re.match(r'(?is)\s*<(h[2-5])([^>]*)>(.*?)</\1>\s*', s)
    deck = None
    if first:
        text = _plain(first.group(3))
        tkey, hkey = _key(title), _key(text)
        # 2 · the first heading repeats the title
        if hkey and tkey and (hkey in tkey or tkey in hkey):
            s = s[first.end():]
        # 3 · otherwise it is the deck, if it is short enough to be one
        elif text and len(text) <= 200:
            deck = text
            s = s[first.end():]

    # 4 · re-level: the levels actually used, mapped onto h2, h3, h4 … in rank
    used = sorted({m.group(1).lower() for m in HEADING.finditer(s)})
    if used and used != ['h%d' % (2 + i) for i in range(len(used))]:
        table = {lv: 'h%d' % (2 + i) for i, lv in enumerate(used)}
        s = HEADING.sub(lambda m: '<%s%s>%s</%s>' % (
            table[m.group(1).lower()], m.group(2), m.group(3), table[m.group(1).lower()]), s)
    return s.strip(), deck


# ==========================================================================
# FOOTNOTES — the markers, and the list they point at
# ==========================================================================
# ~80 of the 4,140 bodies carry footnotes, in three shapes the archive actually
# uses: a <h4>Footnotes</h4> then one <p> per note ("[1]. …"); a bold
# "<strong>Anmerkungen:</strong>" then one <p> per note ("1. …"); and, in the
# longest pieces, a single <p> whose notes are separated by <br /> ("13. …").
# All three end up as one <ol>, and every marker in the text that has a note
# waiting for it becomes a link to it — and back.

NOTE_LABEL = re.compile(
    r'(?i)^\s*(notes?|foot\s?notes?|end\s?notes?|anmerkungen|fu[s\u00df]{1,2}noten|'
    r'references?|quellen|sources?)\s*[:.\u2014-]*\s*$')
NOTE_ITEM = re.compile(r'(?is)^\s*(?:<[^>]+>\s*)*\[?(\d{1,2})\]?\s*[.):\u2014]\s*(.+)$')


def _zone_start(s):
    """Where the notes begin: a heading or a bold-only paragraph that says so."""
    for m in re.finditer(r'(?is)<(h[2-5])[^>]*>(.*?)</\1>|<p[^>]*>\s*<(?:strong|b)>(.*?)</(?:strong|b)>\s*</p>', s):
        label = _plain(m.group(2) if m.group(2) is not None else m.group(3))
        if NOTE_LABEL.match(label):
            return m.start(), m.end(), label
    return None


def _split_items(zone):
    """The zone as candidate lines, whatever separates them."""
    parts = re.split(r'(?is)</p>\s*<p[^>]*>|<br\s*/?>', zone)
    return [p for p in (x.strip() for x in parts) if p]



def link_footnotes(s):
    """Returns (html, count). Nothing happens unless a marker in the text and a
    note at the foot carry the same number — a footnote is never invented."""
    found = _zone_start(s)
    if not found:
        return s, 0
    start, after_label, label = found
    tail = s[after_label:]
    stop = re.search(r'(?is)<hr\s*/?>', tail)
    zone, rest = (tail[:stop.start()], tail[stop.start():]) if stop else (tail, '')

    notes = []
    for line in _split_items(zone):
        m = NOTE_ITEM.match(line)
        if not m:
            continue
        num, text = int(m.group(1)), m.group(2).strip()
        text = re.sub(r'(?is)^(?:<a[^>]*>\s*</a>\s*)+', '', text)   # the old empty anchors
        text = re.sub(r'(?is)</?p[^>]*>', '', text).strip()
        if text and not any(n == num for n, _ in notes):
            notes.append((num, text))
    if len(notes) < 2:
        return s, 0

    body = s[:start]
    numbers = {n for n, _ in notes}
    seen = set()

    def sup(m):
        n = int(m.group('n'))
        if n not in numbers:
            return m.group(0)
        first = n not in seen
        seen.add(n)
        return ('<sup class="si-fn"%s><a href="#fn-%d">%d</a></sup>'
                % (' id="fnref-%d"' % n if first else '', n, n))

    # An article uses ONE marker convention, so they are tried in order of how
    # unambiguous they are and the first one that hits wins.
    #
    #   1. the anchors the article itself wrote — <a href="#fn4"> (footnote 4)</a>
    #      — which say outright which note they point at (post 55739, all 16);
    #   2. <sup>4</sup>, a complete tag sequence, matched on the whole string;
    #   3. [4] in a text node only, so a number inside an href or an alt is
    #      never touched.
    #
    # Parentheses were tried and thrown out: "(4)" is a footnote marker in one
    # article and a count of nuclear reactors in the next ("China (8); Ägypten
    # (4); Ukraine (15)"), and 55739 itself lists power sources as "(1) …
    # (2) … (3)". No rule separated the two reliably, and a footnote link that
    # points at the wrong note is worse than no link at all.
    ANCHOR = re.compile(r'(?is)<a\b[^>]*href="#(?:_?ftn|fn|footnote|note|endnote)[-_]?(?P<n>\d{1,3})"[^>]*>.*?</a>')
    SUP = re.compile(r'(?is)<sup[^>]*>\s*\[?(?P<n>\d{1,2})\]?\s*</sup>')
    BRACKET = re.compile(r'(?<=[\w.,;:!?\u201d\u2019")\]])\s?\[(?P<n>\d{1,2})\]')

    for pattern in (ANCHOR, SUP):
        marked = pattern.sub(sup, body)
        if seen:
            body = marked
            break
    if not seen:
        pieces = re.split(r'(<[^>]+>)', body)
        for i, piece in enumerate(pieces):
            if not piece.startswith('<'):
                pieces[i] = BRACKET.sub(sup, piece)
        if seen:
            body = ''.join(pieces)

    items = ''.join(
        '<li id="fn-%d">%s%s</li>' % (
            n, text,
            ' <a class="si-fn-back" href="#fnref-%d" aria-label="Back to the text">\u21a9</a>' % n
            if n in seen else '')
        for n, text in notes)
    section = ('<section class="si-notes"><h2 id="notes">%s</h2><ol>%s</ol></section>'
               % (_html.escape(label.rstrip(':. \u2014-')) or 'Notes', items))
    return body + section + rest, len(notes)


HEAD = re.compile(r'(?is)<(h2|h3)([^>]*)>(.*?)</\1>')


def add_heading_ids(s):
    """Give every heading a stable id and return the section list for the spine."""
    sections, n = [], [0]

    def _h(m):
        level, attrs = m.group(1), m.group(2)
        text = _html.unescape(re.sub(r'(?s)<[^>]+>', '', m.group(3)).strip())
        if not text:
            return m.group(0)
        have = re.search(r'id="([^"]+)"', attrs)     # the notes heading brings its own
        if have:
            hid, attrs_out = have.group(1), attrs
        else:
            n[0] += 1
            hid, attrs_out = 'sec-%d' % n[0], ' id="%s"%s' % ('sec-%d' % n[0], attrs)
        sections.append({'id': hid, 'level': int(level[1]), 'text': text})
        return '<%s%s>%s</%s>' % (level, attrs_out if have else attrs_out, m.group(3), level)

    return HEAD.sub(_h, s), sections
