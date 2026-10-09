#!/usr/bin/env python3
"""Reproducible original geometric textures. Requires Pillow/optipng; no external artwork."""
import argparse
from pathlib import Path
import shutil
import subprocess
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--optipng", default=shutil.which("optipng"))
args = parser.parse_args()
if not args.optipng:
    parser.error("install optipng or pass --optipng /path/to/optipng (upstream asset requirement)")
destination = Path(__file__).resolve().parents[2] / "games/luanti_space/mods/space_core/textures"
destination.mkdir(parents=True, exist_ok=True)
colors = {
    "alloy": (181, 204, 207), "slate": (45, 59, 76),
    "copper": (176, 104, 72), "light": (67, 199, 207),
}
for name, color in colors.items():
    image = Image.new("RGBA", (32, 32), color + (255,))
    draw = ImageDraw.Draw(image)
    darker = tuple(max(0, component - 28) for component in color) + (255,)
    lighter = tuple(min(255, component + 28) for component in color) + (255,)
    draw.rectangle((0, 0, 31, 31), outline=darker, width=2)
    draw.line((3, 3, 28, 3), fill=lighter)
    if name == "copper":
        for column in (8, 16, 24):
            draw.rectangle((column, 5, column + 2, 27), fill=darker)
        draw.polygon(((11, 13), (16, 8), (21, 13), (18, 13), (18, 22), (14, 22), (14, 13)), fill=lighter)
    elif name == "light":
        draw.rectangle((6, 6, 25, 25), fill=(132, 241, 237, 255))
        draw.rectangle((10, 10, 21, 21), fill=(222, 255, 247, 255))
    elif name == "slate":
        for index in range(8):
            x, y = (index * 13 + 7) % 28 + 2, (index * 17 + 5) % 28 + 2
            draw.line((x, y, min(29, x + 4), y), fill=darker)
    else:
        draw.rectangle((23, 23, 26, 26), fill=darker)
    image.save(destination / f"space_{name}.png", optimize=True)

ghost = Image.new("RGBA", (32, 32), (96, 240, 210, 45))
ImageDraw.Draw(ghost).rectangle((0, 0, 31, 31), outline=(160, 255, 230, 180), width=2)
ghost.save(destination / "space_ghost.png", optimize=True)
tool = Image.new("RGBA", (64, 64))
draw = ImageDraw.Draw(tool)
draw.polygon(((12, 18), (32, 8), (52, 18), (52, 42), (32, 54), (12, 42)), fill="#80daca", outline="#e4fbf5", width=3)
draw.line((12, 18, 32, 29, 52, 18), fill="#e4fbf5", width=3)
draw.line((32, 29, 32, 54), fill="#e4fbf5", width=3)
tool.save(destination / "space_builder.png", optimize=True)

# Original temporary pilot sprites for remote-player visibility.
for name, back in (("space_pilot.png", False), ("space_pilot_back.png", True)):
    image = Image.new("RGBA", (32, 64))
    draw = ImageDraw.Draw(image)
    draw.rectangle((10, 2, 21, 14), fill="#cce6e4")
    draw.rectangle((11, 5, 20, 9), fill="#394c63" if back else "#60dccc")
    draw.rectangle((7, 16, 24, 39), fill="#b2cccc")
    draw.rectangle((2, 17, 6, 40), fill="#566879")
    draw.rectangle((25, 17, 29, 40), fill="#566879")
    draw.rectangle((7, 40, 14, 61), fill="#495e70")
    draw.rectangle((17, 40, 24, 61), fill="#495e70")
    draw.rectangle((10, 19, 21, 32), fill="#536b7b" if back else "#659f99")
    draw.rectangle((13, 22, 18, 26), fill="#d7fff2")
    image.save(destination / name, optimize=True)

subprocess.run([args.optipng, "-o7", "-zm1-9", "-nc", "-strip", "all", "-clobber",
    *map(str, sorted(destination.glob("space_*.png")))], check=True, capture_output=True)
