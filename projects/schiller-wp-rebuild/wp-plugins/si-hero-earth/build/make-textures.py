#!/usr/bin/env python3
"""Regenerate the hero's texture set from the NASA source JPEGs.

Source of truth: ../../homepage-draft/assets/images/*.jpg (NASA, public domain).
Run:  python3 build/make-textures.py

Three decisions encoded here, each measured (see README.md "Texture budget"):
  * WebP everywhere, JPEG kept only as a fallback for browsers without WebP.
  * clouds + moon are stored single-channel: the cloud shader samples only
    .r, and the moon is a grey body far from camera.
  * earth-day is 1536px, not 2048 — the day side is only fully lit during
    act 1 and never fills the frame.
"""
from PIL import Image
from pathlib import Path

SRC = Path(__file__).resolve().parents[3] / "homepage-draft" / "assets" / "images"
OUT = Path(__file__).resolve().parent.parent / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)

# name, source, size, mode, webp quality, also emit jpeg fallback
JOBS = [
    ("earth-night",    "earth-night.jpg",    (2048, 1024), "RGB", 78, True),
    ("earth-day",      "earth-day.jpg",      (1536,  768), "RGB", 76, True),
    ("clouds",         "clouds.jpg",         (1024,  512), "L",   72, True),
    ("moon",           "moon.jpg",           ( 768,  384), "L",   80, True),
    # progressive upgrade — only fetched on fast, unmetered, wide viewports
    ("earth-night-hi", "earth-night-4k.jpg", (4096, 2048), "RGB", 74, False),
    # NOTE: poster.* is NOT generated here. It is a frame of the real scene,
    # rendered by build/make-poster.py — a crop of the flat equirectangular
    # source reads as a world map, not as a planet, which is the one thing
    # the static hero most needs it to look like.
]

total = 0
for name, src, size, mode, q, jpeg in JOBS:
    im = Image.open(SRC / src).convert(mode).resize(size, Image.LANCZOS)
    wp = OUT / f"{name}.webp"
    im.save(wp, "WEBP", quality=q, method=6)
    total += wp.stat().st_size
    line = f"{name:16s} {size[0]:5d}x{size[1]:<5d} {mode:3s} webp {wp.stat().st_size/1024:7.1f} K"
    if jpeg:
        jp = OUT / f"{name}.jpg"
        im.convert("RGB").save(jp, "JPEG", quality=q + 4, optimize=True, progressive=True)
        line += f"   jpg {jp.stat().st_size/1024:7.1f} K"
    print(line)
print(f"\nwebp total (all tiers): {total/1024:.0f} K")
