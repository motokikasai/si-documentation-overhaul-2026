#!/usr/bin/env python3
"""Render the static hero's poster from the real scene.

The poster is what every gated visitor sees instead of the WebGL hero, so it
should be a frame of that hero — the globe as the camera actually frames it
in act 0 — and not a flat equirectangular map, which is what you get if you
just crop the NASA source.

Needs a local server on the plugin root and playwright's firefox:

    python3 -m http.server 8750 --directory .
    python3 build/make-poster.py

Headless firefox renders this with a software rasteriser, which is slower but
pixel-correct for our purposes; the starfield comes out very slightly fainter
than on a GPU, which is if anything an improvement behind headline text.
"""
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"
URL = "http://localhost:8750/tools/preview.html"

# Where in the runway to freeze. 0.05 is act 0's framing: the night Earth
# filling the left of frame with the Moon high right.
P_FREEZE = float(sys.argv[1]) if len(sys.argv) > 1 else 0.28  # act-0 globe, Asia lit — see README "The poster"
W, H = 1600, 800
SUFFIX = sys.argv[2] if len(sys.argv) > 2 else ""

with sync_playwright() as pw:
    b = pw.firefox.launch()
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(1500)

    if "is-live" not in pg.eval_on_selector(".si-hero", "e => e.className"):
        print("ERROR: the scene did not start — nothing to capture.", file=sys.stderr)
        sys.exit(1)

    # Hide everything that is not the scene: the poster is a backdrop for
    # text, so it must not contain any.
    pg.add_style_tag(content="""
        .si-hero__stages, .si-hero__scrollhint, .si-hero__chapters,
        .si-hero__vignette, .si-hero__fallback { display: none !important; }
    """)
    pg.evaluate(f"""() => {{
        const h = document.querySelector('.si-hero');
        const runway = h.offsetHeight - window.innerHeight;
        window.scrollTo(0, h.offsetTop + runway * {P_FREEZE});
    }}""")
    # let the eased camera settle and the 2K textures finish
    pg.wait_for_timeout(6000)
    shot = pg.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H})
    b.close()

im = Image.open(io.BytesIO(shot)).convert("RGB")
im.save(OUT / f"poster{SUFFIX}.webp", "WEBP", quality=74, method=6)
im.save(OUT / f"poster{SUFFIX}.jpg", "JPEG", quality=78, optimize=True, progressive=True)
sm = im.resize((800, 400), Image.LANCZOS)
sm.save(OUT / f"poster{SUFFIX}-sm.webp", "WEBP", quality=72, method=6)
sm.save(OUT / f"poster{SUFFIX}-sm.jpg", "JPEG", quality=76, optimize=True, progressive=True)

for f in (f"poster{SUFFIX}.webp", f"poster{SUFFIX}.jpg", f"poster{SUFFIX}-sm.webp", f"poster{SUFFIX}-sm.jpg"):
    print(f"  {f:18s} {(OUT / f).stat().st_size / 1024:6.1f} K")
