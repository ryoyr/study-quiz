#!/usr/bin/env python3
"""Study QuizのPWAアイコンを決定的に再生成する補助スクリプト。"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MASTER_SIZE = 1024


def gradient(size: int) -> Image.Image:
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            diagonal = (x + y) / (2 * (size - 1))
            radial = max(0.0, 1.0 - (((x - size * 0.25) ** 2 + (y - size * 0.2) ** 2) ** 0.5) / size)
            r = int(22 + 24 * diagonal + 8 * radial)
            g = int(74 + 54 * diagonal + 28 * radial)
            b = int(170 + 55 * (1 - diagonal) + 20 * radial)
            pixels[x, y] = (r, g, b)
    return image


def create_master(maskable: bool) -> Image.Image:
    image = gradient(MASTER_SIZE).convert("RGBA")
    draw = ImageDraw.Draw(image)
    if not maskable:
        mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (20, 20, MASTER_SIZE - 20, MASTER_SIZE - 20),
            radius=220,
            fill=255,
        )
        image.putalpha(mask)

    # Maskableの安全領域（中央80%）にも完全に収まる本のシンボル。
    left, top, right, bottom = 238, 246, 786, 778
    shadow = (12, 30, 78, 70)
    draw.rounded_rectangle(
        (left + 22, top + 30, right + 22, bottom + 30),
        radius=62,
        fill=shadow,
    )
    paper = (248, 250, 255, 255)
    line = (184, 205, 244, 255)
    draw.rounded_rectangle((left, top, right, bottom), radius=62, fill=paper)
    draw.line((512, top + 22, 512, bottom - 24), fill=line, width=18)
    draw.polygon(
        [(left + 45, top + 34), (512, top + 78), (512, bottom - 36), (left + 45, bottom - 80)],
        fill=(238, 245, 255, 255),
    )
    draw.polygon(
        [(right - 45, top + 34), (512, top + 78), (512, bottom - 36), (right - 45, bottom - 80)],
        fill=(255, 255, 255, 255),
    )
    draw.line((512, top + 78, 512, bottom - 36), fill=line, width=14)

    ink = (30, 84, 181, 255)
    for offset in (0, 74, 148):
        draw.rounded_rectangle(
            (left + 92, top + 118 + offset, 442, top + 142 + offset),
            radius=12,
            fill=ink,
        )
    # 学習完了を表すチェック。
    draw.line((579, 494, 646, 564), fill=(16, 143, 92, 255), width=38)
    draw.line((646, 564, 744, 421), fill=(16, 143, 92, 255), width=38)

    # 下部の3つの進捗ドット。
    for index, color in enumerate(
        ((255, 203, 86, 255), (97, 218, 178, 255), (255, 255, 255, 255))
    ):
        center_x = 430 + index * 82
        draw.ellipse((center_x - 19, 836, center_x + 19, 874), fill=color)
    return image


def save_icon(name: str, size: int, maskable: bool = False) -> None:
    master = create_master(maskable)
    icon = master.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(PUBLIC / name, format="PNG", optimize=True)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    save_icon("apple-touch-icon.png", 180)
    save_icon("pwa-192x192.png", 192)
    save_icon("pwa-512x512.png", 512)
    save_icon("pwa-maskable-512x512.png", 512, maskable=True)


if __name__ == "__main__":
    main()
