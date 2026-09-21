#!/usr/bin/env python3
"""Pull product art and data from the sibling app repos into this site.

The site owns every product page's markup, copy and CSS. The app repos own the
artwork and the catalogues the pages render. That means the files this script
writes are *copies*, and copies go stale silently — so this script is both the
way to refresh them and the way to detect drift:

    python3 tools/sync-art.py --check    # report drift, write nothing, exit 1 if stale
    python3 tools/sync-art.py            # rewrite the copies

After a write run, `git status` is the answer to "did the app art move?": clean
means the site matches the app repos, dirty means it just caught up.

Requires Python 3 and Pillow (raster work only). Nothing here runs at request
time: the deployed site stays a set of self-contained HTML files with local
assets and no dependencies.

Sibling layout assumed (same parent directory as this checkout):
    danyzmaj/danyzmaj-site   <- this repo
    danyzmaj/pixelmew
    danyzmaj/pixelpup
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parent.parent
SIBLINGS = SITE.parent

# --- what is synced, per product -------------------------------------------
#
# op        meaning
# copy      byte-for-byte copy of every matched source file
# downscale nearest-neighbour resize to a square box (pixel art stays crisp)
# icons     rasterize a vector brand mark into the page's favicon set
# json      replace the contents of a <script type="application/json"> block
# embed     replace a base64 data URI inside a page, matched by its container
#
# Deliberately NOT synced, and why:
#   pixelpup/assets/{paper,ink,meadow,meadow-dusk,shoreline,night-shore}.svg
#       dog-less palette faces; no byte-identical source exists in the app
#       repo's faces/ directory, so the site is their only copy.
#   pixelpup/assets/favicon*.{svg,ico,png}, apple-touch-icon.png
#       hand-authored vector paw, not derived from app art.
#   */assets/social-preview.png
#       composed once from store renders; re-compose by hand if the art changes.

MANIFEST = [
    {
        "product": "PixelMew",
        "repo": "pixelmew",
        "steps": [
            {"op": "copy", "src": "brand/page.css", "dst": "pixelmew/brand/page.css"},
            {"op": "copy", "src": "brand/page.js", "dst": "pixelmew/brand/page.js"},
            {"op": "copy", "src": "brand/mark.svg", "dst": "pixelmew/brand/mark.svg"},
            {"op": "copy", "src": "faces/*.svg", "dst": "pixelmew/faces"},
            {
                "op": "copy",
                "src": "watchface/resources-round-466x466/drawables/cat_black_shorthair.png",
                "dst": "pixelmew/assets/cat_black_shorthair.png",
            },
            {"op": "downscale", "src": "cats/*.png", "dst": "pixelmew/cats", "size": 312},
            {"op": "icons", "src": "brand/mark.svg", "dst": "pixelmew/assets", "bed": "#eee0d3"},
            {
                "op": "json",
                "src": "cats/catalog.json",
                "page": "pixelmew/index.html",
                "block": "catalog",
            },
            {
                "op": "json",
                "src": "themes.json",
                "page": "pixelmew/index.html",
                "block": "theme-data",
            },
            {
                "op": "embed",
                "src": "watchface/resources-round-466x466/drawables/cat_black_shorthair.png",
                "page": "index.html",
                "container": "mini-mew",
            },
        ],
    },
    {
        "product": "PixelPup",
        "repo": "pixelpup",
        "steps": [
            {
                "op": "copy",
                "src": "watchface/resources/drawables/dog_*.png",
                "dst": "pixelpup/assets",
            },
            {
                "op": "embed",
                "src": "watchface/resources/drawables/dog_labrador.png",
                "page": "index.html",
                "container": "mini-watch",
            },
        ],
    },
]

ICON_SIZES = [
    ("icon-1024.png", 1024, 1024, 7 / 32),
    ("icon-192x192.png", 192, 192, 7 / 32),
    ("favicon-96x96.png", 96, 96, 7 / 32),
    ("apple-touch-icon.png", 180, 164, 0.0),
]


class Stale(Exception):
    """A source the manifest depends on is missing."""


# --- vector mark rasterizer -------------------------------------------------

def mark_shapes(svg_text: str) -> list[tuple[str, list[list[tuple[float, float]]]]]:
    """Parse the brand mark's axis-aligned paths into fill colour + polygons.

    The marks are pixel-grid artwork: only M/m, H/h, V/v and Z occur, so the
    paths rasterize to exact pixels at any integer scale without a renderer.
    """
    paths = re.findall(r"<path fill=[\"'](#[0-9a-fA-F]{6})[\"'] d=[\"']([^\"']+)[\"']", svg_text)
    if not paths:
        raise Stale("brand mark has no <path fill=… d=…> elements")
    shapes = []
    for colour, d in paths:
        polys: list[list[tuple[float, float]]] = []
        cur: list[tuple[float, float]] = []
        x = y = start_x = start_y = 0.0
        for command, raw in re.findall(r"([MmHhVvZz])([^MmHhVvZz]*)", d):
            nums = [float(n) for n in re.findall(r"-?\d*\.?\d+", raw)]
            if command in "Mm":
                if cur:
                    polys.append(cur)
                for i in range(0, len(nums), 2):
                    if command == "M":
                        x, y = nums[i], nums[i + 1]
                    else:
                        x, y = x + nums[i], y + nums[i + 1]
                    if i == 0:
                        start_x, start_y = x, y
                        cur = [(x, y)]
                    else:
                        cur.append((x, y))
            elif command in "Hh":
                for n in nums:
                    x = n if command == "H" else x + n
                    cur.append((x, y))
            elif command in "Vv":
                for n in nums:
                    y = n if command == "V" else y + n
                    cur.append((x, y))
            else:
                polys.append(cur)
                cur = []
                x, y = start_x, start_y
        if cur:
            polys.append(cur)
        shapes.append((colour, polys))
    return shapes


def render_icon(shapes, size: int, art: int, radius: float, bed: str, ss: int = 8) -> bytes:
    """Mark centred on a rounded bed, supersampled then box-filtered."""
    canvas = size * ss
    plate = Image.new("RGB", (canvas, canvas), "#ffffff")
    draw = ImageDraw.Draw(plate)
    draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=radius * canvas, fill=bed)
    scale = art * ss / 32.0
    offset = (canvas - art * ss) / 2.0
    for colour, polys in shapes:
        for poly in polys:
            draw.polygon([(offset + px * scale, offset + py * scale) for px, py in poly], fill=colour)
    mask = Image.new("L", (canvas, canvas), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=radius * canvas, fill=255)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(plate, (0, 0), mask)
    out = out.resize((size, size), Image.LANCZOS)
    if radius == 0.0:
        out = out.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()


def icon_payloads(svg_text: str, bed: str) -> dict[str, bytes]:
    shapes = mark_shapes(svg_text)
    files = {name: render_icon(shapes, size, art, radius, bed) for name, size, art, radius in ICON_SIZES}
    ico = [Image.open(io.BytesIO(render_icon(shapes, s, s, 7 / 32, bed))) for s in (48, 32, 16)]
    buf = io.BytesIO()
    ico[0].save(buf, "ICO", sizes=[(48, 48), (32, 32), (16, 16)], append_images=ico[1:])
    files["favicon.ico"] = buf.getvalue()
    body = "".join(re.findall(r"<path fill=[\"'](?:#[0-9a-fA-F]{6})[\"'] d=[\"'][^\"']+[\"']\s*/>", svg_text))
    if not body:  # normalise quoting differences in the source mark
        body = "".join(
            f"<path fill='{c}' d='{d}'/>"
            for c, d in re.findall(r"<path fill=[\"'](#[0-9a-fA-F]{6})[\"'] d=[\"']([^\"']+)[\"']", svg_text)
        )
    files["favicon.svg"] = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
        f"<rect width='32' height='32' rx='7' fill='{bed}'/>{body}</svg>\n"
    ).encode()
    return files


# --- payload builders (pure: source -> intended bytes) ---------------------

def downscaled(path: Path, size: int) -> bytes:
    image = Image.open(path)
    buf = io.BytesIO()
    image.resize((size, size), Image.NEAREST).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def patch_json_block(page: str, block: str, payload: str) -> str:
    pattern = re.compile(
        rf'(<script id="{re.escape(block)}" type="application/json">)(.*?)(</script>)', re.S
    )
    if not pattern.search(page):
        raise Stale(f'page has no <script id="{block}" type="application/json"> block')
    return pattern.sub(lambda m: m.group(1) + payload + m.group(3), page, count=1)


def patch_embed(page: str, container: str, png: bytes) -> str:
    pattern = re.compile(
        rf'(class="[^"]*\b{re.escape(container)}\b[^"]*">.*?<img src="data:image/png;base64,)([A-Za-z0-9+/=]+)',
        re.S,
    )
    if not pattern.search(page):
        raise Stale(f'page has no base64 <img> inside .{container}')
    encoded = base64.b64encode(png).decode()
    return pattern.sub(lambda m: m.group(1) + encoded, page, count=1)


def sources(repo: Path, spec: str) -> list[Path]:
    if any(ch in spec for ch in "*?["):
        found = sorted(repo.glob(spec))
    else:
        path = repo / spec
        found = [path] if path.exists() else []
    if not found:
        raise Stale(f"no source matched {spec} in {repo}")
    return found


def plan(step: dict, repo: Path) -> dict[Path, bytes]:
    """Intended site-relative contents for one manifest step."""
    op = step["op"]
    if op in ("copy", "downscale"):
        dst = SITE / step["dst"]
        wanted: dict[Path, bytes] = {}
        for src in sources(repo, step["src"]):
            target = dst / src.name if (dst.is_dir() or not dst.suffix) else dst
            wanted[target] = src.read_bytes() if op == "copy" else downscaled(src, step["size"])
        return wanted
    if op == "icons":
        (src,) = sources(repo, step["src"])
        out = SITE / step["dst"]
        return {out / name: data for name, data in icon_payloads(src.read_text(), step["bed"]).items()}
    if op == "json":
        (src,) = sources(repo, step["src"])
        page_path = SITE / step["page"]
        # The app repos keep these catalogues pretty-printed; the page carries
        # the same data on one line so the document stays small.
        payload = json.dumps(json.loads(src.read_text()))
        patched = patch_json_block(page_path.read_text(), step["block"], payload)
        return {page_path: patched.encode()}
    if op == "embed":
        (src,) = sources(repo, step["src"])
        page_path = SITE / step["page"]
        patched = patch_embed(page_path.read_text(), step["container"], src.read_bytes())
        return {page_path: patched.encode()}
    raise Stale(f"unknown op {op!r}")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="report drift, write nothing")
    parser.add_argument("--product", help="limit to one product name (e.g. PixelMew)")
    args = parser.parse_args()

    drift: list[str] = []
    written = 0
    for entry in MANIFEST:
        if args.product and args.product.lower() != entry["product"].lower():
            continue
        repo = SIBLINGS / entry["repo"]
        if not repo.is_dir():
            print(f"error: {entry['product']} source repo not found at {repo}", file=sys.stderr)
            return 2
        print(f"{entry['product']} <- {repo}")
        # Page-editing steps must run in sequence: two steps can touch one file.
        for step in entry["steps"]:
            try:
                wanted = plan(step, repo)
            except Stale as exc:
                print(f"error: {entry['product']} step {step['op']}: {exc}", file=sys.stderr)
                return 2
            for target, data in wanted.items():
                current = target.read_bytes() if target.exists() else None
                label = target.relative_to(SITE)
                if current == data:
                    continue
                state = "missing" if current is None else f"{digest(current)} -> {digest(data)}"
                drift.append(f"{label} ({state})")
                if args.check:
                    print(f"  stale  {label}  {state}")
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                written += 1
                print(f"  wrote  {label}  {state}")

    if args.check:
        if drift:
            print(f"\n{len(drift)} file(s) stale; run tools/sync-art.py to refresh", file=sys.stderr)
            return 1
        print("\nin sync")
        return 0
    print(f"\n{written} file(s) updated" if written else "\nalready in sync")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
