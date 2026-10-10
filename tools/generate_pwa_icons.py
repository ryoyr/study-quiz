#!/usr/bin/env python3
"""標準ライブラリだけでStudy QuizのPWA PNGを決定的に生成する。"""
from __future__ import annotations

import binascii
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def chunk(kind: bytes, data: bytes) -> bytes:
    payload = kind + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", binascii.crc32(payload) & 0xFFFFFFFF)


def png(width: int, height: int, pixels: bytes) -> bytes:
    rows = b"".join(b"\x00" + pixels[y * width * 4 : (y + 1) * width * 4] for y in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def render(size: int, maskable: bool = False) -> bytes:
    pixels = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            offset = (y * size + x) * 4
            ratio = (x + y) / max(1, 2 * size - 2)
            pixels[offset : offset + 4] = bytes((round(30 + 28 * ratio), round(96 + 30 * ratio), round(210 + 28 * ratio), 255))

    inset = int(size * (0.22 if maskable else 0.16))
    left, top, right, bottom = inset, int(size * 0.2), size - inset, int(size * 0.78)
    line = max(2, size // 26)

    def paint(x: int, y: int, color=(255, 255, 255, 255)) -> None:
        if 0 <= x < size and 0 <= y < size:
            offset = (y * size + x) * 4
            pixels[offset : offset + 4] = bytes(color)

    # 開いた教材カードの輪郭
    for y in range(top, bottom):
        for dx in range(line):
            paint(left + dx, y)
            paint(right - 1 - dx, y)
    for x in range(left, right):
        for dy in range(line):
            paint(x, top + dy)
            paint(x, bottom - 1 - dy)
    # 問題行
    for row, width in ((0.34, 0.34), (0.45, 0.46), (0.56, 0.29)):
        y0 = int(size * row)
        for y in range(y0, y0 + line):
            for x in range(int(size * 0.3), int(size * (0.3 + width))):
                paint(x, y)
    # 確認チェック
    points = []
    for step in range(int(size * 0.09)):
        points.append((int(size * 0.34) + step, int(size * 0.65) + step))
    for step in range(int(size * 0.19)):
        points.append((int(size * 0.43) + step, int(size * 0.74) - step))
    for x, y in points:
        for dx in range(-line, line + 1):
            for dy in range(-line, line + 1):
                paint(x + dx, y + dy)
    return png(size, size, bytes(pixels))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    outputs = {
        "apple-touch-icon.png": render(180),
        "pwa-192x192.png": render(192),
        "pwa-512x512.png": render(512),
        "pwa-maskable-512x512.png": render(512, maskable=True),
    }
    for name, data in outputs.items():
        path = PUBLIC / name
        path.write_bytes(data)
        print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
