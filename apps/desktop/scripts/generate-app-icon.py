#!/usr/bin/env python3
"""Generate macOS-compliant Clarity app icon (1024x1024 squircle)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
BG_COLOR = (10, 10, 10, 255)  # #0a0a0a
CHARACTER_SCALE = 0.55  # monk occupies ~55% of icon height
SQUIRCLE_RADIUS = 228  # macOS Big Sur standard for 1024px icons
BLACK_THRESHOLD = 25


def remove_black_background(img: Image.Image) -> Image.Image:
    data = np.array(img.convert("RGBA"))
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    is_bg = (r < BLACK_THRESHOLD) & (g < BLACK_THRESHOLD) & (b < BLACK_THRESHOLD)
    data[:, :, 3] = np.where(is_bg, 0, 255)
    return Image.fromarray(data)


def monk_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.array(img)[:, :, 3]
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    if not rows.any():
        raise ValueError("No visible pixels found in source image")
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    return x_min, y_min, x_max, y_max


def squircle_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def build_icon(source_path: Path, output_path: Path) -> float:
    src = Image.open(source_path)
    monk = remove_black_background(src)

    x_min, y_min, x_max, y_max = monk_bbox(monk)
    monk_cropped = monk.crop((x_min, y_min, x_max + 1, y_max + 1))

    target_height = int(SIZE * CHARACTER_SCALE)
    scale = target_height / monk_cropped.height
    target_width = int(monk_cropped.width * scale)
    monk_scaled = monk_cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # Dark squircle background
    bg_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_layer)
    bg_draw.rounded_rectangle(
        (0, 0, SIZE - 1, SIZE - 1),
        radius=SQUIRCLE_RADIUS,
        fill=BG_COLOR,
    )
    canvas = Image.alpha_composite(canvas, bg_layer)

    # Center monk on canvas
    paste_x = (SIZE - target_width) // 2
    paste_y = (SIZE - target_height) // 2
    canvas.paste(monk_scaled, (paste_x, paste_y), monk_scaled)

    # Apply squircle alpha mask (transparent corners for macOS)
    mask = squircle_mask(SIZE, SQUIRCLE_RADIUS)
    result = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    result.paste(canvas, (0, 0), mask)

    result.save(output_path, "PNG")
    return CHARACTER_SCALE


def main() -> None:
    desktop = Path(__file__).resolve().parent.parent
    source = desktop / "app-icon.png"
    output = desktop / "app-icon.png"

    if not source.exists():
        print(f"Source not found: {source}", file=sys.stderr)
        sys.exit(1)

    backup = desktop / "app-icon-source-fullbleed.png"
    if not backup.exists():
        Image.open(source).save(backup)

    scale = build_icon(backup, output)
    print(f"Generated {output} (character scale={scale:.0%}, squircle r={SQUIRCLE_RADIUS})")


if __name__ == "__main__":
    main()
