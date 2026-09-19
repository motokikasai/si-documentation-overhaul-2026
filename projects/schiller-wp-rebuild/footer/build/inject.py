#!/usr/bin/env python3
"""Paste the shared fragments into the round-2 drafts.

    python3 footer/build/inject.py

Two fragments are identical across D, E and F — the language switcher's no-script
list and (for D and E) the cast of faces — so they are authored once here and
stamped in, rather than being kept in sync by hand across three files. Re-run
after changing anything in `build/`.

The tokens are HTML comments, so a draft is still a valid page before injection;
running twice is a no-op because the token is consumed.

In WordPress none of this exists: the switcher comes from `wpml_active_languages`
and the faces from a `si_person` query (README §4).
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
FOOTER = HERE.parent

# draft -> the faces fragment it needs (None: no carousel)
DRAFTS = {
    'footer-rotunda.html': 'frag-rotunda.html',
    'footer-cabinet.html': 'frag-cabinet.html',
    'footer-quiet.html': None,
}


def fragment(name, indent):
    lines = [l for l in (HERE / name).read_text().splitlines()
             if l.strip() and not l.startswith('<!-- =====')]
    return '\n'.join(indent + l for l in lines)


def main():
    changed = []
    for draft, faces in DRAFTS.items():
        path = FOOTER / draft
        html = path.read_text()
        before = html
        if '<!--LANG-->' in html:
            html = html.replace('<!--LANG-->', fragment('langswitch.html', '\t\t\t'))
        if faces and '<!--FACES-->' in html:
            html = html.replace('<!--FACES-->', fragment(faces, '\t\t\t\t\t'))
        if html != before:
            path.write_text(html)
            changed.append(draft)

    for draft in DRAFTS:
        html = (FOOTER / draft).read_text()
        for token in ('<!--LANG-->', '<!--FACES-->'):
            if token in html:
                sys.exit(f'{draft}: {token} was not filled — is the fragment missing?')

    print('injected into: ' + (', '.join(changed) if changed else 'nothing (already stamped)'))


if __name__ == '__main__':
    main()
