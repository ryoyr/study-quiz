#!/usr/bin/env python3
"""Study QuizのPWA PNGを決定的に再生成する。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
TARGETS = {
    "apple-touch-icon.png": (180, False),
    "pwa-192x192.png": (192, False),
    "pwa-512x512.png": (512, False),
    "pwa-maskable-512x512.png": (512, True),
}


def font(size: int):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def build(size: int, maskable: bool) -> Image.Image:
    image = Image.new("RGB", (size, size), "#081426")
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            ratio = (x + y) / max(1, (size - 1) * 2)
            pixels[x, y] = (
                round(8 + 20 * ratio),
                round(20 + 74 * ratio),
                round(38 + 100 * ratio),
            )
    draw = ImageDraw.Draw(image)
    margin = round(size * (0.20 if maskable else 0.12))
    radius = round(size * 0.09)
    draw.rounded_rectangle((margin, margin, size - margin, size - margin), radius, fill="#0f766e", outline="#99f6e4", width=max(2, size // 64))
    inner = round(size * 0.09)
    draw.rounded_rectangle((margin + inner, margin + inner, size - margin - inner, size - margin - inner), round(radius * 0.6), fill="#f8fafc")
    label = "Q"
    fnt = font(round(size * 0.34))
    box = draw.textbbox((0, 0), label, font=fnt)
    draw.text(((size - (box[2] - box[0])) / 2, (size - (box[3] - box[1])) / 2 - size * 0.025), label, font=fnt, fill="#0f3d56")
    return image


PUBLIC.mkdir(parents=True, exist_ok=True)
for name, (size, maskable) in TARGETS.items():
    path = PUBLIC / name
    build(size, maskable).save(path, format="PNG", optimize=True)
    print(f"generated {path.relative_to(ROOT)} ({size}x{size})")
