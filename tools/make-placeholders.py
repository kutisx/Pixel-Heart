"""Генерирует временные абстрактные заставки для hero-карусели.

Это не арт игр: тёмный градиент, свечение, пиксельная сетка и звёзды
в цветах палитры. Команда заменяет файлы на свои по тем же путям.

Запуск из корня проекта:
    python tools/make-placeholders.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1200, 800

PALETTES = {
    "doki": {"bg": (26, 15, 22), "accent": (255, 111, 174), "accent2": (184, 76, 255)},
    "saya": {"bg": (14, 20, 16), "accent": (178, 58, 58), "accent2": (122, 158, 126)},
    "nine": {"bg": (10, 14, 26), "accent": (124, 92, 255), "accent2": (53, 214, 196)},
    "va11": {"bg": (18, 11, 30), "accent": (255, 77, 157), "accent2": (77, 225, 255)},
}

OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "novels"


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def mix(c1, c2, t: float):
    return tuple(lerp(c1[i], c2[i], t) for i in range(3))


def gradient(bg):
    strip = Image.new("RGB", (1, HEIGHT))
    pixels = strip.load()
    top = mix(bg, (255, 255, 255), 0.13)
    middle = mix(bg, (255, 255, 255), 0.02)
    bottom = mix(bg, (0, 0, 0), 0.35)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        if t < 0.55:
            color = mix(top, middle, t / 0.55)
        else:
            color = mix(middle, bottom, (t - 0.55) / 0.45)
        pixels[0, y] = color
    return strip.resize((WIDTH, HEIGHT), Image.BILINEAR)


def radial_glow(size, color, alpha):
    glow = Image.new("L", size, 0)
    draw = ImageDraw.Draw(glow)
    w, h = size
    steps = 26
    for i in range(steps, 0, -1):
        ratio = i / steps
        radius = int(min(w, h) * 0.5 * ratio)
        value = int(alpha * (1 - ratio) ** 2.1 * 255)
        draw.ellipse(
            (w // 2 - radius, h // 2 - radius, w // 2 + radius, h // 2 + radius),
            fill=value,
        )
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    layer = Image.new("RGB", size, color)
    return layer, glow


def add_glow(canvas, center, color, alpha, scale=1.0):
    w = int(WIDTH * scale)
    h = int(HEIGHT * scale)
    layer, mask = radial_glow((w, h), color, alpha)
    layer = layer.resize((w, h))
    mask = mask.resize((w, h))
    x = int(center[0] * WIDTH - w / 2)
    y = int(center[1] * HEIGHT - h / 2)
    canvas.paste(layer, (x, y), mask)


def add_grid(canvas, color):
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    step = 48
    for x in range(0, WIDTH, step):
        draw.line([(x, 0), (x, HEIGHT)], fill=color + (14,), width=1)
    for y in range(0, HEIGHT, step):
        draw.line([(0, y), (WIDTH, y)], fill=color + (14,), width=1)
    canvas.alpha_composite(overlay)


def add_pixel_stars(canvas, accent, accent2, seed):
    rng = random.Random(seed)
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    palette = [accent, accent2, (255, 255, 255)]
    for _ in range(90):
        x = rng.randrange(0, WIDTH, 4)
        y = rng.randrange(0, HEIGHT, 4)
        size = rng.choice([4, 4, 8, 12])
        color = rng.choice(palette)
        alpha = rng.randint(28, 150)
        draw.rectangle((x, y, x + size, y + size), fill=color + (alpha,))
    for _ in range(6):
        x = rng.randrange(0, WIDTH - 40, 4)
        y = rng.randrange(0, HEIGHT - 40, 4)
        color = rng.choice([accent, accent2])
        alpha = rng.randint(60, 150)
        draw.rectangle((x, y, x + 24, y + 4), fill=color + (alpha,))
    canvas.alpha_composite(overlay)


def add_heart(canvas, accent, accent2, seed):
    """Большое пиксельное сердце бренда как водяной знак на фоне."""
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    bitmap = [
        "01100110",
        "11111111",
        "11111111",
        "01111110",
        "00111100",
        "00011000",
    ]
    unit = 26
    ox = WIDTH - unit * len(bitmap[0]) - 96
    oy = HEIGHT - unit * len(bitmap) - 72
    palette = [accent, accent2]
    for row_index, row in enumerate(bitmap):
        for col_index, cell in enumerate(row):
            if cell != "1":
                continue
            color = palette[(row_index + col_index) % 2]
            alpha = max(12, 46 - row_index * 5)
            x0 = ox + col_index * unit
            y0 = oy + row_index * unit
            draw.rectangle((x0, y0, x0 + unit, y0 + unit), fill=color + (alpha,))

    overlay = overlay.rotate(-8, resample=Image.BICUBIC, expand=False)
    canvas.alpha_composite(overlay)


def vignette(canvas):
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((-WIDTH * 0.25, -HEIGHT * 0.35, WIDTH * 1.25, HEIGHT * 1.35), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(160))
    dark = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 150))
    canvas.paste(dark, (0, 0), Image.eval(mask, lambda value: 150 - int(value * 0.55)))


def compose(name, palette, seed):
    canvas = gradient(palette["bg"]).convert("RGBA")
    add_glow(canvas, (0.74, 0.28), palette["accent"], 0.55, 1.15)
    add_glow(canvas, (0.18, 0.78), palette["accent2"], 0.34, 0.9)
    add_heart(canvas, palette["accent"], palette["accent2"], seed + 1)
    add_grid(canvas, palette["accent"])
    add_pixel_stars(canvas, palette["accent"], palette["accent2"], seed)
    vignette(canvas)

    image = canvas.convert("RGB")
    image = image.filter(ImageFilter.GaussianBlur(0.4))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / f"{name}.png"
    image.save(target, format="PNG", optimize=True)
    print(f"written {target.relative_to(OUT_DIR.parent.parent)}")


def main():
    for index, (name, palette) in enumerate(PALETTES.items()):
        compose(name, palette, seed=100 + index * 7)


if __name__ == "__main__":
    main()
