# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build the BabelStone PUA glyphs for numbered components that have no IDS fragment.

BabelStone IDS.TXT note 6 leaves 69 of its numbered components as `？` and gives each a PUA
code point in the same line. BabelStone Han PUA draws them; this script cuts those 69 outlines
into `data/numbered-pua-outlines.json.gz` and a 69-glyph `fonts/IDSNumbered.woff2` face.

The PUA code points are not stable. The document records the font version and digest, and the
palette stores the code point it was built from.

    uv run scripts/build_numbered_pua.py [--font path/to/BabelStoneHanPUA.ttf]

The font is under the Arphic Public License; the subset keeps that licence and changes its name.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.ttLib import TTFont

from build_tangut_outlines import Contours
from engine_data import WRITE_DATA

ROOT = Path(__file__).resolve().parents[1]
FONT_URL = "https://www.babelstone.co.uk/Fonts/Download/BabelStoneHanPUA.ttf"
FONT_SHA256 = "92e7155bd28f5570449f4dc71e9bb6fa919f67ef0120d4f83b58c61bed3ed4dc"
LICENSE_URL = "http://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE"
LICENSE_SHA256 = "ba74a961aaa5fa7e73dc67276df2781ba405da2cb30c52c9d9eee9c200d4d11e"
OUTLINES = ROOT / "data" / "numbered-pua-outlines.json.gz"
SUBSET = ROOT / "fonts" / "IDSNumbered.woff2"
FALLBACKS = WRITE_DATA / "palette/fallback-characters.json"
LICENSE = ROOT / "fonts" / "LICENSE-BabelStoneHanPUA.txt"
COMPONENTS = ROOT / "data" / "ids-components.tsv"
PUA = re.compile(r"\(([0-9A-F]{4,6})\)")


def download(url: str, path: Path) -> Path:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as response:
            path.write_bytes(response.read())
    return path


def rows() -> list[tuple[str, int]]:
    """Each numbered component with no fragment and the PUA code point BabelStone gives it."""
    out = []
    for line in COMPONENTS.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        symbol, _, fragment = line.split("\t")
        if fragment:
            continue
        found = PUA.search(line)
        if not found:
            raise ValueError(f"No PUA code point for {symbol}")
        out.append((symbol, int(found.group(1), 16)))
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--font", type=Path, help="a local BabelStoneHanPUA.ttf")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    args = parser.parse_args(argv)
    font_path = args.font or download(FONT_URL, args.cache / "BabelStoneHanPUA.ttf")
    digest = hashlib.sha256(font_path.read_bytes()).hexdigest()
    if digest != FONT_SHA256:
        raise ValueError(f"Unexpected BabelStone Han PUA font: {digest}")
    license_path = download(LICENSE_URL, args.cache / "ARPHIC-LICENSE.txt")
    license_digest = hashlib.sha256(license_path.read_bytes()).hexdigest()
    if license_digest != LICENSE_SHA256:
        raise ValueError(f"Unexpected Arphic Public License: {license_digest}")
    LICENSE.write_bytes(license_path.read_bytes())

    font = TTFont(font_path)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = 1000 / font["head"].unitsPerEm
    records = {}
    for symbol, point in rows():
        if point not in cmap:
            raise ValueError(f"{symbol}: U+{point:04X} is not in the font")
        glyph = glyphs[cmap[point]]
        bounds = BoundsPen(glyphs)
        glyph.draw(bounds)
        pen, perimeter = Contours(glyphs, scale), PerimeterPen(glyphs)
        glyph.draw(Cu2QuPen(pen, max_err=0.5 / scale))
        glyph.draw(perimeter)
        if not bounds.bounds or not pen.contours:
            raise ValueError(f"{symbol}: U+{point:04X} has no outline")
        char = chr(point)
        records[char] = {
            "k": char,
            "G": {"v": 0, "b": [round(v * scale, 4) for v in bounds.bounds], "p": pen.contours},
            "ink": round(perimeter.value * scale, 4),
            "o": len(pen.contours),
        }
    version = font["name"].getDebugName(5) or ""
    raw = json.dumps(
        {"font": f"BabelStone Han PUA {version}", "license": "Arphic Public License",
         "fontSha256": digest, "records": records},
        ensure_ascii=False, separators=(",", ":"),
    ).encode()
    OUTLINES.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features, options.name_IDs, options.notdef_outline = [], ["*"], True
    piece = subset.load_font(str(font_path), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[point for _, point in rows()])
    subsetter.subset(piece)
    for record in piece["name"].names:
        if record.nameID in (1, 16, 21):
            record.string = "IDS Numbered"
        elif record.nameID == 4:
            record.string = "IDS Numbered"
        elif record.nameID == 6:
            record.string = "IDSNumbered-Regular"
        elif record.nameID == 3:
            record.string = f"IDSNumbered;{version}"
        elif record.nameID == 8:
            record.string = "Andrew West"
    piece.recalcTimestamp = False
    piece.save(SUBSET)

    fallback = json.loads(FALLBACKS.read_text(encoding="utf-8"))
    fallback = sorted(set(fallback) | set(records), key=ord)
    FALLBACKS.write_text(json.dumps(fallback, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"{OUTLINES}: {len(records)} glyphs, {OUTLINES.stat().st_size} bytes")
    print(f"{SUBSET}: {SUBSET.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
