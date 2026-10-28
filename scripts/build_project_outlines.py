# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0"]
# ///
"""Replace the fallback outlines of this project's characters with sans Plangothic glyphs.

`build_unicode_outlines.py` fills gaps from a pinned font order; for CJK Extension J that is Jigmo, a
serif design. The workshop's default face is Sans, and this project's descriptions cover characters
newer than the bundled editions (`data/ids-characters.tsv`). For those characters, take the outline from
Plangothic P2 (SIL OFL 1.1), a Source Han Sans design, so the fallback glyph matches the Sans face.

Run after `build_unicode_outlines.py`, since that script rewrites every shard:

    uv run scripts/build_project_outlines.py [--font PlangothicP2-Regular.ttf]

Without `--font` the pinned file is fetched into `cache/`. The script replaces records in
`data/unicode-outlines/` and updates their hashes in `data/unicode-outlines.json`.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.perimeterPen import PerimeterPen
from fontTools.ttLib import TTFont

from build_tangut_outlines import Contours

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "ids-characters.tsv"
OUTLINES = ROOT / "data" / "unicode-outlines"
METADATA = ROOT / "data" / "unicode-outlines.json"
PLANGOTHIC = {
    "file": "PlangothicP2-Regular.ttf",
    "sha256": "681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f",
    "url": "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795/PlangothicP2-Regular.ttf",
    "license": "SIL OFL 1.1",
    "note": "sans fallback for this project's characters (Extension J)",
}


def fetch(url: str, dest: Path, sha256: str) -> Path:
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "ids-input build"})
        with urllib.request.urlopen(request, timeout=300) as response:
            dest.write_bytes(response.read())
    if hashlib.sha256(dest.read_bytes()).hexdigest() != sha256:
        raise ValueError(f"{dest} does not match the pinned SHA-256 of {url}")
    return dest


def characters(path: Path) -> list[str]:
    out = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        out.append(line.split("\t")[0])
    return out


def packed(contours) -> bytes:
    raw = json.dumps(contours, ensure_ascii=False, separators=(",", ":")).encode()
    data = bytearray(gzip.compress(raw, compresslevel=9, mtime=0))
    data[9] = 255  # Stable OS header across Python 3.11+ and operating systems.
    return bytes(data)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--font", type=Path, help="a local PlangothicP2-Regular.ttf")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    args = parser.parse_args(argv)
    path = args.font or fetch(PLANGOTHIC["url"], args.cache / PLANGOTHIC["file"], PLANGOTHIC["sha256"])
    wanted = characters(SOURCE)
    metadata = json.loads(METADATA.read_text())
    font = TTFont(path)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = 1000 / font["head"].unitsPerEm
    patched = []
    for char in wanted:
        point = ord(char)
        if point not in cmap:
            print(f"skipped {char} (U+{point:04X}): Plangothic has no glyph")
            continue
        shard = f"{point >> 8:03x}"
        shard_path = OUTLINES / f"{shard}.json.gz"
        if not shard_path.exists():
            print(f"skipped {char} (U+{point:04X}): no fallback shard {shard}")
            continue
        records = json.loads(gzip.decompress(shard_path.read_bytes()))
        if char not in records:
            print(f"skipped {char} (U+{point:04X}): no fallback record")
            continue
        glyph = glyphs[cmap[point]]
        pen, bounds, perimeter = Contours(glyphs, scale), BoundsPen(glyphs), PerimeterPen(glyphs)
        glyph.draw(Cu2QuPen(pen, max_err=0.5 / scale))
        glyph.draw(bounds)
        glyph.draw(perimeter)
        if not pen.contours or not bounds.bounds:
            print(f"skipped {char} (U+{point:04X}): empty glyph")
            continue
        records[char] = {
            "k": char,
            "G": {"v": 0, "b": [round(v * scale, 4) for v in bounds.bounds], "p": pen.contours},
            "ink": round(perimeter.value * scale, 4),
            "o": len(pen.contours),
        }
        raw = packed(records)
        shard_path.write_bytes(raw)
        metadata["shards"][shard] = {"count": len(records), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
        patched.append(char)
    source = {**PLANGOTHIC, "count": len(patched), "copyright": font["name"].getDebugName(0)}
    metadata["sources"] = [entry for entry in metadata["sources"] if entry.get("file") != PLANGOTHIC["file"]] + [source]
    METADATA.write_text(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(patched)} outlines from Plangothic P2: {''.join(patched)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
