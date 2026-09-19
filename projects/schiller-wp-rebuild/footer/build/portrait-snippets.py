#!/usr/bin/env python3
"""Emit the medallion / plate fragments the footer drafts paste in.

The drafts carry no JavaScript (this round is design only), so the focal-point
crop that `templates/js/people-core.js` normally computes at runtime has to be
baked into the markup. This script is that bake: `focus_style()` below is a
line-for-line port of `focusStyle()` in people-core.js, so a portrait is cropped
here exactly as /people/ crops it. Re-run it after any change to that function
or to data/people.json and paste the output back into the drafts.

    python3 footer/build/portrait-snippets.py            # print every set
    python3 footer/build/portrait-snippets.py colonnade  # just one set

In WordPress none of this is pasted: the footer partial calls the same helpers
the people templates use (README §4), and `.is-loaded` comes from people-core.js.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAYLOAD = ROOT / 'people' / 'data' / 'people.json'

# --- the sets ---------------------------------------------------------------
# Chosen for range, not rank: five continents, statesmen beside scientists and
# economists, and the women the archive actually recorded. Every one of these
# has an `authoritative` portrait (SI's own featured image) — see people/README.md.
SETS = {
    # A · The Colonnade — the portico. Sizes alternate so the row reads as a
    # frieze rather than a grid; the tallest three carry the eye to the left.
    'colonnade': [
        ('helga-zepp-larouche', 96),
        ('bouthaina-shaaban', 72),
        ('jacques-cheminade', 80),
        ('shi-ze', 64),
        ('jayshree-sengupta', 88),
        ('diogene-senny', 64),
        ('natalia-vitrenko', 76),
        ('daisuke-kotegawa', 64),
        ('chandra-muzaffar', 84),
        ('richard-black', 64),
        ('hussein-askary', 72),
        ('antonino-galloni', 64),
    ],
    # C · The Envoi — the three doors. 4:5 plates, one per door. Only people
    # whose face the cascade actually found (`fs` in the payload) are used here:
    # at plate size a podium default crop leaves the head too small to read.
    # The third element is the crop's `fill` (how much of the frame the face
    # should occupy). It is per-portrait because the source shots are lit very
    # differently: Zepp-LaRouche's has a black ground that swallows the plate at
    # the default 0.42, so her crop closes in until the lit face carries it.
    'envoi': [
        ('helga-zepp-larouche', None, 0.60),
        ('richard-black', None, 0.42),
        ('jayshree-sengupta', None, 0.48),
    ],
}

# --- the carousels (D and E) -------------------------------------------------
# One cast for both, because both cycle rather than compose: the running order
# matters (no two neighbours from the same country or discipline) but rank does
# not — every face is the same size, so nothing here implies importance.
#
# Two hard entry conditions, both of which drop people:
#   · the cascade found their face (`fs` in the payload) — at carousel size a
#     podium default crop is a suit and a lectern;
#   · build/titles.json has a SOURCED role for them. The line under a name is
#     always what a person does, never "In the archive 2012–2014", and nothing
#     is invented, so someone with no title is simply not in the cast.
CAST = [
    'helga-zepp-larouche', 'ramsey-clark', 'bouthaina-shaaban', 'chandra-muzaffar',
    'malcolm-fraser', 'jayshree-sengupta', 'shi-ze', 'walter-jones',
    'fatemeh-hashemi-rafsanjani', 'michail-titarenko', 'marco-zanni', 'hussein-askary',
    'daisuke-kotegawa', 'panos-kammenos', 'richard-black', 'wangsuo-wu',
    'denys-pluvinage', 'robert-barwick', 'dieter-ameling', 'jason-ross',
    'antonino-galloni', 'leonid-kadyshev', 'wolfgang-lillge', 'marcia-merry-baker',
]

TITLES = json.loads((pathlib.Path(__file__).resolve().parent / 'titles.json').read_text())


def focus_style(ph, fill=0.42, box_ar=1.0):
    """Port of focusStyle() in templates/js/people-core.js. Keep them identical."""
    ar = ph['w'] / ph['h']
    bw, bh = 1.0, 1.0 / box_ar
    has_focus = ph.get('fs') is not None
    fx = (ph['fx'] if has_focus else 50) / 100
    fy = (ph['fy'] if has_focus else 34) / 100
    h_min = max(bh, bw / ar)                      # image height that just covers
    if has_focus:
        h = min(h_min * 3.2, max(h_min, fill * bh / ph['fs']))
    else:
        h = h_min * 1.15
    w = h * ar
    left = min(0, max(bw - w, bw / 2 - fx * w))
    top = min(0, max(bh - h, bh / 2 - fy * h))
    pc = lambda v: f'{v * 100:.2f}%'
    return f'width:{pc(w / bw)};height:{pc(h / bh)};left:{pc(left / bw)};top:{pc(top / bh)}'


def initials(name):
    """Port of initials() in people-core.js (the monogram cameo's letters)."""
    import re
    parts = [w for w in re.split(r'[\s-]+', re.sub(r'\(.*?\)', '', name))
             if w and re.match(r'^\w', w, re.UNICODE)
             and w.lower().rstrip('.') not in
             ('von', 'van', 'de', 'der', 'da', 'di', 'del', 'la', 'le', 'al', 'el', 'jr', 'sr')]
    if not parts:
        return '·'
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else '')).upper()


def esc(s):
    return (str(s or '').replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def medallion(p, size, eager=False, size_css=None):
    """`.si-medallion`, with `is-loaded` baked in.

    `size_css` emits a CSS value instead of a fixed pixel size, so the carousels
    can set one `--face` in a media query and have every seat follow — the ring's
    radius is computed from it at runtime.
    """
    ph = p.get('photo')
    size = size_css or f'{size}px' 
    if not ph:
        return (f'<span class="si-medallion si-medallion--monogram" style="--size:{size}" '
                f'data-initials="{esc(initials(p["name"]))}" aria-hidden="true"></span>')
    return (f'<span class="si-medallion" style="--size:{size}">'
            f'<img class="si-medallion__img is-loaded" data-focus '
            f'src="../people/{ph["src"]}" alt="" width="{ph["w"]}" height="{ph["h"]}" '
            f'style="{focus_style(ph)}" '
            f'loading="{"eager" if eager else "lazy"}" decoding="async"></span>')


def plate(p, ar=0.8, fill=0.42):
    ph = p['photo']
    return (f'<span class="si-plate" style="aspect-ratio:{ar}">'
            f'<img class="si-medallion__img is-loaded" data-focus '
            f'src="../people/{ph["src"]}" alt="" width="{ph["w"]}" height="{ph["h"]}" '
            f'style="{focus_style(ph, fill, ar)}" loading="lazy" decoding="async"></span>')


def descriptor(p):
    """The line under a face: always a role, from build/titles.json.

    There is deliberately no fallback. The archive's own `affiliation` is dirty
    (people/README.md: some rows hold transcript text, moderator patter or a
    sentence fragment), and the earlier year-span fallback printed "In the
    archive 2012–2014", which says nothing about what a person does. So the
    title is looked up, and a missing one stops the build.
    """
    entry = TITLES.get(p['key'])
    if not entry or not entry.get('title'):
        sys.exit(f"{p['key']}: no sourced title in titles.json — add one, or drop "
                 f"them from CAST. A face is never printed without a role.")
    return entry['title']


def carousel(people, kind):
    """D (medallions) and E (plates) read the same markup: a link per person
    carrying the name and role as data, which the module writes into the caption
    of whichever face is at the front."""
    out = []
    for i, key in enumerate(CAST):
        p = people.get(key)
        if p is None:
            sys.exit(f'{key}: not in {PAYLOAD.name} — pick another')
        art = (medallion(p, 76, eager=i < 8, size_css='var(--face, 76px)') if kind == 'rotunda'
               else plate(p, ar=0.8, fill=0.5))
        out.append(
            f'<a class="{kind}__face" href="/people/{key}/"'
            f' data-name="{esc(p["name"])}" data-role="{esc(descriptor(p))}">'
            f'{art}<span class="si-visually-hidden">{esc(p["name"])}</span></a>')
    return out


def main():
    people = {p['key']: p for p in json.loads(PAYLOAD.read_text())['people']}
    wanted = sys.argv[1:] or list(SETS) + ['rotunda', 'cabinet']
    for name in wanted:
        if name in ('rotunda', 'cabinet'):
            print(f'<!-- ===== {name} · {len(CAST)} faces ===== -->')
            print('\n'.join(carousel(people, name)))
            print()
            continue
        print(f'<!-- ===== {name} ===== -->')
        for i, entry in enumerate(SETS[name]):
            key, size, *rest = entry
            p = people.get(key)
            if p is None:
                sys.exit(f'{key}: not in {PAYLOAD.name} — pick another')
            if size is None:
                print(f'<!-- {p["name"]} -->')
                print(plate(p, fill=rest[0] if rest else 0.42))
            else:
                label = esc(p['name'])
                print(f'<a class="si-portico__figure" href="/people/{key}/" title="{label}">'
                      f'{medallion(p, size, eager=i < 6)}'
                      f'<span class="si-visually-hidden">{label}</span></a>')
        print()


if __name__ == '__main__':
    main()
