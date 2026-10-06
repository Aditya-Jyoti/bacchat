#!/usr/bin/env python3
"""
Generates the app icon set under frontend/assets/ from one drawing: a Khata notebook page with a
rupee stroke. Run from frontend/:  python3 scripts/make-assets.py   (needs Pillow).

Colours are the Khata fallback palette (docs/design-system.md, seed hue 45). Hex values are allowed
here and nowhere else in the repo, because these are baked into images.
"""
import math
import os

from PIL import Image, ImageDraw

PAPER = "#F8EEEA"          # surface (light)
PRIMARY = "#9C522E"        # primary (light)
ON_PRIMARY = "#FBF3F0"     # onPrimary (light)
PRIMARY_CONTAINER = "#F4CAB7"
DARK_PAPER = "#1A1310"     # surface (dark)
DARK_PRIMARY = "#F4A988"   # primary (dark)
DARK_ON_PRIMARY = "#441B06"

SS = 4  # supersampling factor
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")


def canvas(size):
    return Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))


def finish(img, size):
    return img.resize((size, size), Image.LANCZOS)


def stroke_line(d, p0, p1, w, fill):
    d.line([p0, p1], fill=fill, width=int(w))
    r = w / 2
    for x, y in (p0, p1):
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def stroke_arc(d, box, a0, a1, w, fill):
    d.arc(box, a0, a1, fill=fill, width=int(w))
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    rx, ry = (box[2] - box[0]) / 2 - w / 2, (box[3] - box[1]) / 2 - w / 2
    for a in (a0, a1):
        x, y = cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a))
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=fill)


def draw_mark(img, scale, page, ink, knockout=False):
    """Notebook page (rounded square) with ruled lines and a rupee-like stroke.
    scale: fraction of the canvas the page occupies. knockout: ink is cut out (transparent)."""
    W = img.size[0]
    d = ImageDraw.Draw(img)
    side = W * scale
    x0 = y0 = (W - side) / 2
    x1 = y1 = x0 + side
    d.rounded_rectangle([x0, y0, x1, y1], radius=side * 0.16, fill=page)
    # Binding strip on the left edge: a vertical rule, like a ledger margin.
    mx = x0 + side * 0.17
    detail = (0, 0, 0, 0) if knockout else ink
    stroke_line(d, (mx, y0 + side * 0.08), (mx, y1 - side * 0.08), side * 0.018, detail)
    # Ruled lines under the rupee, like the last lines of a ledger page.
    lw = side * 0.024
    for f in (0.80, 0.90):
        stroke_line(d, (mx + side * 0.07, y0 + side * f), (x1 - side * 0.10, y0 + side * f), lw, detail)
    # Rupee stroke: two bars, a bowl and a diagonal leg, centred in the writing area.
    cx = (mx + x1) / 2 + side * 0.02
    top = y0 + side * 0.13
    w = side * 0.058
    half = side * 0.17
    stroke_line(d, (cx - half, top), (cx + half, top), w, detail)
    stroke_line(d, (cx - half, top + side * 0.11), (cx + half, top + side * 0.11), w, detail)
    bowl = [cx - half * 1.3, top, cx + half * 0.7, top + side * 0.30]
    stroke_arc(d, bowl, -90, 90, w, detail)
    stroke_line(d, (cx - half, top + side * 0.27), (cx + half * 0.8, top + side * 0.55), w, detail)
    return img


def solid(size, color):
    return Image.new("RGBA", (size * SS, size * SS), color)


def save(img, name, size):
    path = os.path.join(OUT, name)
    finish(img, size).save(path)
    print("wrote", os.path.relpath(path))


def main():
    os.makedirs(OUT, exist_ok=True)
    # Adaptive foreground: the page stays inside the 66 percent safe zone of the 108dp canvas.
    fg = canvas(1024)
    draw_mark(fg, 0.56, PRIMARY, ON_PRIMARY)
    save(fg, "adaptive-foreground.png", 1024)

    # Themed (Android 13) monochrome: a silhouette with the ruling cut out.
    mono = canvas(1024)
    draw_mark(mono, 0.56, (0, 0, 0, 255), None, knockout=True)
    save(mono, "adaptive-monochrome.png", 1024)

    # Legacy full-bleed icon (below Android 8 and for stores): paper background plus the mark.
    icon = solid(1024, PAPER)
    draw_mark(icon, 0.70, PRIMARY, ON_PRIMARY)
    save(icon, "icon.png", 1024)

    # Notification small icon: white on transparent, 96px (Android tints it).
    note = canvas(96)
    draw_mark(note, 0.90, (255, 255, 255, 255), None, knockout=True)
    save(note, "notification-icon.png", 96)

    # Splash: the mark alone on transparent; the colour behind it comes from app.json.
    splash = canvas(1024)
    draw_mark(splash, 0.62, PRIMARY, ON_PRIMARY)
    save(splash, "splash-icon.png", 1024)
    splash_dark = canvas(1024)
    draw_mark(splash_dark, 0.62, DARK_PRIMARY, DARK_ON_PRIMARY)
    save(splash_dark, "splash-icon-dark.png", 1024)


if __name__ == "__main__":
    main()
