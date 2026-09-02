#!/usr/bin/env python3
"""Derive every brand image asset from the single source logo.

The source logo is a 1024x1024 JPEG: a circular teal-to-blue mark with a white
background baked in. Shipping it as-is would show an ugly white box on any dark
surface, so this script recovers an alpha channel and emits the full icon set.

The white background cannot simply be keyed out by colour, because the monogram
and the word "CONSULTANCY" *inside* the mark are also white. Instead the
background is found by flood-filling inward from the four corners, which only
reaches the contiguous outer region and leaves interior white untouched.

Usage:
    python3 tools/prepare_logo.py [--source PATH] [--force]

Outputs (all under public/):
    logo.png              512x512 transparent, trimmed to the mark
    logo@2x.png           1024x1024 transparent
    icon-192.png          PWA icon, transparent
    icon-512.png          PWA icon, transparent
    apple-touch-icon.png  180x180 on white (iOS discards alpha)
    favicon-{16,32,48}    inner mark only, so it stays legible when tiny
    favicon.ico           multi-resolution bundle of the three above
    og-image.png          1200x630 social share card
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required: this script needs the PIL module to be importable.")

# --- Paths ------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "public"
DEFAULT_SOURCE = Path.home() / "Downloads" / "cd8c17c7-9596-4d7a-a968-38803fbc4cb6.jpeg"
BRAND_ASSET_DIR = REPO_ROOT / "src" / "assets" / "brand"
VENDORED_SOURCE = BRAND_ASSET_DIR / "logo-source.jpeg"

# --- Brand tokens (kept in step with src/styles/global.css) ------------------

BRAND_TEAL = (18, 168, 200)
BRAND_BLUE = (19, 72, 196)
INK = (11, 26, 51)
BODY = (85, 99, 122)
CANVAS = (252, 253, 255)
WHITE = (255, 255, 255)

# --- Background keying tuning ----------------------------------------------

# Flood-fill tolerance. The mark's outer glow is a pale lavender/pink around
# luminance ~225, while the background is 250-255, so a tolerance of 28 keys the
# background without biting into the ring.
FLOOD_THRESHOLD = 28

# The outer ring is decorative; cropping to the inner disc makes the monogram
# roughly a third larger, which is the difference between legible and mush at 16px.
FAVICON_CROP = 0.80

SENTINEL = (255, 0, 255)  # magenta marker, absent from the source artwork
FAVICON_SIZES = (16, 32, 48)


def log(message: str) -> None:
    print(f"  {message}")


def resolve_source(explicit: Path | None) -> Path:
    """Pick the logo source, preferring an explicit path, then the vendored copy."""
    candidates = [explicit] if explicit else [VENDORED_SOURCE, DEFAULT_SOURCE]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return candidate
    searched = "\n    ".join(str(c) for c in candidates if c)
    sys.exit(f"Logo source not found. Looked in:\n    {searched}")


def build_alpha_mask(rgb: Image.Image) -> Image.Image:
    """Return an L-mode mask: 255 for artwork, 0 for background.

    Flood-fills the four corners with a sentinel colour, then treats exactly
    those pixels as background. The fill is performed on a scratch copy so the
    sentinel never contaminates the colours we actually keep.
    """
    scratch = rgb.copy()
    width, height = scratch.size
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]

    for corner in corners:
        ImageDraw.floodfill(scratch, corner, SENTINEL, thresh=FLOOD_THRESHOLD)

    red, green, blue = scratch.split()
    is_sentinel = ImageChops.multiply(
        ImageChops.multiply(
            red.point(lambda v: 255 if v == SENTINEL[0] else 0),
            green.point(lambda v: 255 if v == SENTINEL[1] else 0),
        ),
        blue.point(lambda v: 255 if v == SENTINEL[2] else 0),
    )

    mask = ImageChops.invert(is_sentinel)

    # Pull the edge in by a pixel to drop the JPEG's near-white antialiased
    # fringe, then feather so the result does not look cut out with scissors.
    mask = mask.filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(0.7))


def cut_out_logo(source: Path) -> Image.Image:
    """Load the source logo and return it as RGBA, trimmed to the artwork."""
    with Image.open(source) as handle:
        rgb = handle.convert("RGB")

    mask = build_alpha_mask(rgb)
    rgba = rgb.convert("RGBA")
    rgba.putalpha(mask)

    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    opaque = sum(1 for a in mask.getdata() if a > 8)
    coverage = opaque / (mask.width * mask.height) * 100
    log(f"keyed background — artwork covers {coverage:.1f}% of the source frame")
    if not 30.0 <= coverage <= 95.0:
        log("WARNING: coverage outside the expected 30-95% band; check public/logo.png")

    return rgba


def square_canvas(rgba: Image.Image, size: int, padding: float = 0.0) -> Image.Image:
    """Fit `rgba` centred on a transparent square of `size`, keeping aspect ratio."""
    inner = max(1, int(size * (1.0 - padding * 2)))
    scaled = rgba.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
        scaled,
    )
    return canvas


def flatten(rgba: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """Composite onto a solid background, for targets that discard alpha."""
    canvas = Image.new("RGBA", rgba.size, (*background, 255))
    return Image.alpha_composite(canvas, rgba).convert("RGB")


def crop_to_disc(rgba: Image.Image, factor: float) -> Image.Image:
    """Centre-crop to `factor` of the shorter side, dropping the outer ring."""
    side = int(min(rgba.size) * factor)
    left = (rgba.width - side) // 2
    top = (rgba.height - side) // 2
    return rgba.crop((left, top, left + side, top + side))


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Best available system sans. Inter ships woff2 only, which PIL cannot read."""
    families = (
        ["Ubuntu-Bold", "LiberationSans-Bold", "DejaVuSans-Bold"]
        if bold
        else ["Ubuntu-R", "LiberationSans-Regular", "DejaVuSans"]
    )
    roots = [
        Path("/usr/share/fonts/truetype/ubuntu"),
        Path("/usr/share/fonts/truetype/liberation"),
        Path("/usr/share/fonts/truetype/dejavu"),
    ]
    for family in families:
        for root in roots:
            candidate = root / f"{family}.ttf"
            if candidate.is_file():
                return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size)


def make_og_image(rgba: Image.Image, out: Path) -> None:
    """Render the 1200x630 card used by Open Graph and Twitter previews."""
    width, height = 1200, 630
    card = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(card)

    # Soft brand wash in the lower-right, kept faint so text stays high contrast.
    wash = Image.new("RGB", (width, height), CANVAS)
    wash_draw = ImageDraw.Draw(wash)
    for step in range(width):
        ratio = step / width
        wash_draw.line(
            [(step, 0), (step, height)],
            fill=(
                int(CANVAS[0] + (BRAND_TEAL[0] - CANVAS[0]) * ratio * 0.10),
                int(CANVAS[1] + (BRAND_TEAL[1] - CANVAS[1]) * ratio * 0.10),
                int(CANVAS[2] + (BRAND_TEAL[2] - CANVAS[2]) * ratio * 0.10),
            ),
        )
    card = Image.blend(card, wash, 0.9)
    draw = ImageDraw.Draw(card)

    # Accent bar along the bottom edge: teal to blue, matching the CTA gradient.
    bar_height = 10
    for step in range(width):
        ratio = step / width
        draw.line(
            [(step, height - bar_height), (step, height)],
            fill=tuple(
                int(BRAND_TEAL[i] + (BRAND_BLUE[i] - BRAND_TEAL[i]) * ratio) for i in range(3)
            ),
        )

    mark = square_canvas(rgba, 300)
    card.paste(mark, (width - 300 - 90, (height - 300) // 2 - 10), mark)

    draw.text((90, 210), "JB Consultancy", font=load_font(66, bold=True), fill=INK)
    draw.text(
        (90, 300),
        "Engineering, talent and delivery\nfor ambitious platforms.",
        font=load_font(31),
        fill=BODY,
        spacing=12,
    )
    draw.text((90, 415), "SAP · Oracle · Full Stack · AI", font=load_font(24, bold=True), fill=BRAND_BLUE)

    card.save(out, "PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="path to the source logo image")
    parser.add_argument(
        "--force", action="store_true", help="regenerate even if outputs already exist"
    )
    args = parser.parse_args()

    source = resolve_source(args.source)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    BRAND_ASSET_DIR.mkdir(parents=True, exist_ok=True)

    if not args.force and (PUBLIC_DIR / "favicon.ico").is_file():
        log("assets already present — pass --force to regenerate")
        return 0

    print(f"Preparing brand assets from {source}")
    rgba = cut_out_logo(source)

    # Keep a copy in-repo so the build never depends on ~/Downloads.
    if not VENDORED_SOURCE.is_file():
        with Image.open(source) as handle:
            handle.convert("RGB").save(VENDORED_SOURCE, "JPEG", quality=95)
        log(f"vendored source → {VENDORED_SOURCE.relative_to(REPO_ROOT)}")

    square_canvas(rgba, 512).save(PUBLIC_DIR / "logo.png", "PNG", optimize=True)
    square_canvas(rgba, 1024).save(PUBLIC_DIR / "logo@2x.png", "PNG", optimize=True)

    # In-page rendering uses this copy under src/, where Astro's asset pipeline
    # can convert it to WebP and emit only the sizes the markup asks for. The
    # public/ copies stay put for crawlers and structured data, which need
    # stable, predictable URLs.
    square_canvas(rgba, 512).save(BRAND_ASSET_DIR / "logo.png", "PNG", optimize=True)
    square_canvas(rgba, 192).save(PUBLIC_DIR / "icon-192.png", "PNG", optimize=True)
    square_canvas(rgba, 512).save(PUBLIC_DIR / "icon-512.png", "PNG", optimize=True)

    # iOS ignores transparency and squares the corners itself, so ship it flat.
    flatten(square_canvas(rgba, 180, padding=0.06), WHITE).save(
        PUBLIC_DIR / "apple-touch-icon.png", "PNG", optimize=True
    )

    disc = crop_to_disc(rgba, FAVICON_CROP)
    favicons = []
    for size in FAVICON_SIZES:
        icon = square_canvas(disc, size)
        icon.save(PUBLIC_DIR / f"favicon-{size}.png", "PNG", optimize=True)
        favicons.append(icon)

    favicons[-1].save(
        PUBLIC_DIR / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in FAVICON_SIZES],
    )

    make_og_image(rgba, PUBLIC_DIR / "og-image.png")

    written = sorted(
        p for p in PUBLIC_DIR.iterdir() if p.suffix in {".png", ".ico"}
    )
    print(f"Wrote {len(written)} asset(s) to public/:")
    for path in written:
        log(f"{path.name:<24} {path.stat().st_size / 1024:7.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
