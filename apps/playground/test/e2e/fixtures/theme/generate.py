#!/usr/bin/env python3
"""Generate visibly distinct PNG and WebP upload fixtures for browser acceptance.

The four slots are sidebar-logo-expanded, sidebar-logo-collapsed, auth-logo,
and auth-hero. The fixtures are visibly different from the factory assets so a
screenshot proves which source rendered.

Each fixture has:
- A solid coloured background unique to that slot (red, blue, green, amber)
- The slot key text rendered on top
- A PNG version (1MB or under) and a WebP version (1MB or under)

The PNG files use the Pillow library. The WebP files use Pillow's WebP encoder.
Both formats include their respective magic bytes, so the package's MIME probe
will accept them.
"""

from __future__ import annotations

import io
import os
import struct
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit(
        "Pillow is required to generate these fixtures. Install with: "
        "pip install Pillow"
    ) from exc

OUT_DIR = Path(__file__).resolve().parent

SLOTS: list[tuple[str, tuple[int, int, int], tuple[int, int]]] = [
    ("sidebar-logo-expanded", (220, 38, 38), (640, 200)),   # red, wide
    ("sidebar-logo-collapsed", (37, 99, 235), (320, 320)),  # blue, square
    ("auth-logo", (5, 150, 105), (640, 240)),               # green, wide
    ("auth-hero", (217, 119, 6), (1280, 720)),              # amber, wide hero
]


def pick_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\calibrib.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def make_image(name: str, color: tuple[int, int, int], size: tuple[int, int]) -> Image.Image:
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)

    margin = max(16, min(size) // 24)
    font_size = max(28, min(size) // 9)
    font = pick_font(font_size)

    label = f"UPLOAD:{name}"
    text_bbox = draw.textbbox((0, 0), label, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    text_x = (size[0] - text_w) // 2
    text_y = (size[1] - text_h) // 2

    draw.rectangle(
        [margin, margin, size[0] - margin, size[1] - margin],
        outline=(255, 255, 255),
        width=4,
    )
    draw.text((text_x, text_y), label, fill=(255, 255, 255), font=font)
    return img


def write_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def write_webp(image: Image.Image, path: Path) -> None:
    image.save(path, format="WEBP", quality=85, method=6)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, color, size in SLOTS:
        image = make_image(name, color, size)
        write_png(image, OUT_DIR / f"{name}.png")
        write_webp(image, OUT_DIR / f"{name}.webp")
        print(f"wrote {name}.png and {name}.webp ({size[0]}x{size[1]})")


if __name__ == "__main__":
    main()
