#!/usr/bin/env python3
"""
The Earth from space, for the Pavilion's title band — four views rendered from
the NASA maps the homepage hero already ships (public domain, credited in
homepage-draft/README.md):

    earth-day.jpg        Blue Marble, 2048 x 1024
    clouds.jpg           NASA cloud layer, 2048 x 1024
    earth-night-4k.jpg   Black Marble 2016, 4096 x 2048

    python3 pages/build/make-earth-bands.py        # → pages/templates/img/band-earth-*.webp

Each view is an orthographic projection of the maps onto a lit sphere with a
thin atmosphere, on a TRANSPARENT ground: the planet floats on the band's own
mist, and the page's tonal treatment (greyscale under the jasper tint, fading
toward the title) does the rest. Nothing is painted in; every pixel of the
planet is a map pixel, lit.

Plain Python + Pillow (no numpy on this box): a few seconds per view.
"""
import math, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS = os.path.join(HERE, '../../homepage-draft/assets/images')
OUT = os.path.join(HERE, '../templates/img')
W, H = 1600, 320                          # the band's own proportions, so little is cropped


def load(name):
    im = Image.open(os.path.join(MAPS, name)).convert('RGB')
    return im.load(), im.size


def sample(tex, size, u, v):
    """bilinear, wrapping in longitude"""
    w, h = size
    x = (u % 1.0) * w - 0.5
    y = min(max(v * h - 0.5, 0), h - 1.001)
    x0, y0 = math.floor(x), int(y)
    fx, fy = x - x0, y - y0
    x0 %= w
    x1 = (x0 + 1) % w
    a, b, c, d = tex[x0, y0], tex[x1, y0], tex[x0, y0 + 1], tex[x1, y0 + 1]
    return [(a[i] * (1 - fx) + b[i] * fx) * (1 - fy) + (c[i] * (1 - fx) + d[i] * fx) * fy for i in range(3)]


def norm(v):
    l = math.sqrt(sum(x * x for x in v)) or 1
    return [x / l for x in v]


def render(name, *, R, cx, cy, lat0, lon0, sun, night=False, clouds=1.0, atmo=0.035):
    day, dsz = load('earth-day.jpg')
    cl, csz = load('clouds.jpg')
    nt, nsz = load('earth-night-4k.jpg') if night else (None, None)
    sun = norm(sun)
    cl0, sl0 = math.cos(math.radians(lat0)), math.sin(math.radians(lat0))
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    rim = 1 + atmo
    for y in range(H):
        for x in range(W):
            dx, dy = (x - cx) / R, (cy - y) / R          # y up
            r2 = dx * dx + dy * dy
            if r2 > rim * rim:
                continue
            if r2 > 1:
                # the atmosphere beyond the edge: a thin glow, lit on the sun's side
                r = math.sqrt(r2)
                t = max(0.0, 1 - (r - 1) / atmo)
                lit = max(0.0, (dx * sun[0] + dy * sun[1]) / r) * 0.8 + 0.2
                a = int(255 * (t ** 2.2) * 0.55 * lit)
                px[x, y] = (150, 190, 235, a)
                continue
            z = math.sqrt(1 - r2)
            n = (dx, dy, z)
            # tilt the view by lat0 (rotate about x), then read latitude/longitude
            yy = dy * cl0 + z * sl0
            zz = -dy * sl0 + z * cl0
            lat = math.asin(max(-1, min(1, yy)))
            lon = math.atan2(dx, zz) + math.radians(lon0)
            u, v = (lon + math.pi) / (2 * math.pi), (math.pi / 2 - lat) / math.pi
            ndl = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]
            lit = max(0.0, ndl)
            c = sample(day, dsz, u, v)
            k = sample(cl, csz, u, v)[0] / 255 * clouds
            col = [c[i] * (0.06 + 0.94 * lit ** 0.75) for i in range(3)]
            col = [col[i] * (1 - k) + 255 * k * (0.08 + 0.92 * lit) for i in range(3)]
            if night:
                dark = min(1, max(0, (0.12 - ndl) / 0.24))     # soft terminator
                if dark > 0:
                    l = sample(nt, nsz, u, v)
                    # only the lights: the map's faint ground glow is pressed down, the cities kept
                    col = [col[i] * (1 - dark) + (255 * min(1.0, (l[i] / 255) ** 1.9 * 3.2) * (1 - 0.6 * k) + 5) * dark for i in range(3)]
            # the atmosphere seen through the limb: a blue haze toward the edge
            f = (1 - z) ** 2.4 * (0.35 + 0.65 * max(lit, 0.15))
            col = [col[0] * (1 - f) + 150 * f, col[1] * (1 - f) + 190 * f, col[2] * (1 - f) + 235 * f]
            px[x, y] = tuple(int(min(255, max(0, q))) for q in col) + (255,)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'band-earth-{name}.webp')
    img.save(path, 'WEBP', quality=80, method=6)
    print(f'{path}  {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    # lat0 is the latitude at the disc's centre; with the centre far below the
    # band, the top of the curve is latitude (90 - |lat0|) on the NEAR side only
    # when lat0 is negative — a positive lat0 carries the view over the pole.
    # The card sits at about x 1180–1520, y 150–256 of this frame (desktop): the
    # views keep what matters out from under it.
    # the horizon: Europe along the curve, the Mediterranean nearer, sun above
    render('limb', R=1500, cx=1050, cy=1540, lat0=-35, lon0=15, sun=(0.35, 0.75, 0.55), atmo=0.018)
    # a globe rising from the right, its lit edge in the open ground before the card
    render('disc', R=400, cx=1300, cy=250, lat0=18, lon0=10, sun=(-0.8, 0.35, 0.5))
    # the night side: Europe and North Africa by their lights, day leaving the rim
    render('night', R=1100, cx=1180, cy=1170, lat0=-22, lon0=10, sun=(0.9, 0.2, -0.4), night=True, atmo=0.02)
    # the whole Earth, small, between the title and the card
    render('whole', R=122, cx=1010, cy=160, lat0=8, lon0=20, sun=(-0.45, 0.35, 0.82), atmo=0.06)
