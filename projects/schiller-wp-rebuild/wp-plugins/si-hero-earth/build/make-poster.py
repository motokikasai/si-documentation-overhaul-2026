#!/usr/bin/env python3
"""Render the static hero's poster from the real scene.

The poster does two jobs, and since 0.2.1 the second one sets the rules:

  1. it is the whole hero for every gated visitor — phone, metered
     connection, no WebGL — so it has to be a frame of the real scene and not
     a flat equirectangular map, which is what you get if you crop the NASA
     source and which reads as a world map rather than a planet;
  2. it is what the live hero shows until the scene has a textured frame,
     and then dissolves out of. So it must be THE OPENING FRAME — p=0 — or
     the reader watches the globe change size and the corridors un-grow
     during the handoff.

Job 2 is why P_FREEZE is 0. It used to be 0.28, chosen for job 1 alone, and
the difference was plainly visible: at 0.28 the camera has pulled back and
the first wave of corridors is already a quarter drawn.

Needs a local server on the plugin root and playwright's firefox:

    python3 articles/build/serve.py 8761     # from projects/schiller-wp-rebuild/
    python3 wp-plugins/si-hero-earth/build/make-poster.py

(Since 0.3.0 the harness loads Jasper's fonts and tokens from people/design-system/,
so it has to be served from the prototype root, not from the plugin.)

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
URL = "http://localhost:8761/wp-plugins/si-hero-earth/tools/preview.html"

# Where in the runway to freeze. 0 is the frame the scene opens on, which is
# the frame the poster has to dissolve into. Pass another value to explore;
# do not ship one.
P_FREEZE = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
# 2:1, wider than any desktop hero box. That matters: `object-fit: cover`
# with an image wider than its box scales by HEIGHT, and the scene's camera
# has a fixed VERTICAL field of view — so the globe lands at exactly the same
# size in the poster as in the canvas, at every desktop viewport. A poster
# taller than the box would be scaled by width instead and the dissolve would
# jump. (Portrait phones do scale by width; they are also below the gate's
# viewport floor and never see the scene.)
W, H = 1600, 800
SUFFIX = sys.argv[2] if len(sys.argv) > 2 else ""

with sync_playwright() as pw:
    b = pw.firefox.launch()
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_function(
        "() => document.querySelector('.si-hero')?.classList.contains('is-scene')",
        timeout=60000,
    )

    # `is-scene`, not `is-live`: since 0.2.0 the boot gate adds `is-live`
    # before the first paint, on a guess about the device, and it means only
    # that the pinned layout is on. The class that means "the renderer has
    # painted a complete, textured frame" — which is the only state worth
    # photographing — is `is-scene`.
    if "is-scene" not in pg.eval_on_selector(".si-hero", "e => e.className"):
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
    # The textures are in (that is what `is-scene` means). What is left is the
    # eased camera, which only has somewhere to go if we scrolled. Keep the
    # wait short: the globe carries a slow idle spin at the bookends, and
    # every second of waiting is another 0.8° of rotation between this still
    # and the frame the visitor actually sees it dissolve into.
    pg.wait_for_timeout(3000 if P_FREEZE > 0 else 400)
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
