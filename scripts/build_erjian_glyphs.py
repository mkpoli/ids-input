# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0"]
# ///
"""Build the draft's own 二简字 glyphs.

The Second Round draft (第二次汉字简化方案（草案）, 1977) simplified some characters to a form of
their own: 警 to ⿰忄井, 厩 to ⿸厂九, 臿 to ⿱千田. The composer builds such a description out of its
parts, taking each from a whole character it resembles, which draws no one's handwriting. Andrew
West's table records the draft's own drawing of each form as a glyph in BabelStone Han PUA, at a
private-use code point the table prints beside the IDS.

This script reads the table, keeps the descriptions the examples use, and writes each glyph's
outline into `data/erjian-glyphs.json` in the composer's 1000-unit box, y down.

    uv run scripts/build_erjian_glyphs.py [--font path/to/BabelStoneHanPUA.ttf]

The font is under the Arphic Public License (`fonts/LICENSE-BabelStoneHanPUA.txt`). The glyphs are
the draft's drawings; the private-use code points are not stable across font versions, so the
version and digest are recorded in `data/README.md`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
TABLE_URL = "https://www.babelstone.co.uk/Fonts/Erjian.html"
FONT_URL = "https://www.babelstone.co.uk/Fonts/Download/BabelStoneHanPUA.ttf"
FONT_SHA256 = "92e7155bd28f5570449f4dc71e9bb6fa919f67ef0120d4f83b58c61bed3ed4dc"
OUT = ROOT / "data" / "erjian-glyphs.json"
EXAMPLES = ROOT / "demo" / "lib" / "examples.js"
ROW = re.compile(r"<TR[^>]*>(.*?)</TR>", re.S | re.I)
CELL = re.compile(r"<TD[^>]*>(.*?)</TD>", re.S | re.I)
PUA = re.compile(r"PUA U\+([0-9A-F]{4,})")
IDS = re.compile(r"^[⿰-⿿〾㇯]")
TAG = re.compile(r"<[^>]+>")


def download(url: str, path: Path) -> Path:
    """The file at `url`, read once."""
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as response:
            path.write_bytes(response.read())
    return path


def rows(table: str) -> dict[str, dict[str, str]]:
    """Each description the table draws, with its entry number, character and PUA code point."""
    out: dict[str, dict[str, str]] = {}
    for row in ROW.finditer(table):
        cells = [re.sub(r"\s+", " ", TAG.sub(" ", cell)).strip() for cell in CELL.findall(row.group(1))]
        if len(cells) != 5 or not re.match(r"^[12]\.[123]:", cells[0]) or not IDS.match(cells[3]):
            continue
        point = PUA.search(cells[4])
        if point:
            out[cells[3]] = {"table": cells[0], "character": cells[2], "codepoint": f"U+{point.group(1)}"}
    return out


def wanted() -> list[str]:
    """The 二简字 descriptions the examples show, which is what the app needs drawn."""
    text = EXAMPLES.read_text(encoding="utf-8")
    start = text.index("{ key: 'erjian'")
    end = text.index("{ key: '", start + 1)
    return re.findall(r"sequence: '([^']+)'", text[start:end])


def outline(font: TTFont, point: int) -> str | None:
    """The glyph's ink as an SVG path in the composer's 1000-unit box, y down."""
    cmap = font.getBestCmap()
    if point not in cmap:
        return None
    scale = 1000 / font["head"].unitsPerEm
    pen = SVGPathPen(font.getGlyphSet(), ntos=lambda value: str(round(value, 1)))
    font.getGlyphSet()[cmap[point]].draw(TransformPen(pen, (scale, 0, 0, -scale, 0, 1000)))
    return pen.getCommands() or None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, help="a local BabelStoneHanPUA.ttf")
    args = parser.parse_args()

    font_path = args.font or download(FONT_URL, ROOT / "cache" / "BabelStoneHanPUA.ttf")
    digest = hashlib.sha256(font_path.read_bytes()).hexdigest()
    if digest != FONT_SHA256:
        raise SystemExit(f"{font_path}: sha256 {digest}, not {FONT_SHA256}")
    table_path = download(TABLE_URL, ROOT / "cache" / "Erjian.html")
    table = rows(table_path.read_text(encoding="utf-8"))
    font = TTFont(font_path)

    seen: dict[str, dict[str, str]] = {}
    for sequence in wanted():
        row = table.get(sequence)
        if not row or sequence in seen:
            continue
        drawing = outline(font, int(row["codepoint"][2:], 16))
        if drawing:
            seen[sequence] = {**row, "d": drawing}

    # A form the draft writes with 讠 is spelled with 设 in the examples, since 讠 alone is no character;
    # the drawing is still the draft's, so the table's row answers for both spellings.
    for sequence, row in list(seen.items()):
        if sequence.startswith("⿰讠"):
            seen[sequence.replace("⿰讠", "⿰设", 1)] = row

    ordered = dict(sorted(seen.items(), key=lambda item: item[1]["table"]))
    OUT.write_text(json.dumps(ordered, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(ordered)} glyphs -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
