# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build `fonts/Plangothic-ids-project.woff2`: this project's characters as a Sans webfont.

The UI's text stack draws rare components from a Plangothic subset; characters newer than the
bundled sources are not in it. This subsets Plangothic P2 (SIL OFL 1.1), a Source Han Sans design,
to the characters in `data/ids-project.tsv`, so 𳑳 renders in the same sans style as the drawing.
Run after changing that file:

    uv run scripts/build_project_font.py [--font PlangothicP2-Regular.ttf]
"""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "ids-project.tsv"
TARGET = ROOT / "fonts" / "Plangothic-ids-project.woff2"
PLANGOTHIC = {
    "file": "PlangothicP2-Regular.ttf",
    "sha256": "681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f",
    "url": "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795/PlangothicP2-Regular.ttf",
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
    return [line.split("\t")[0] for line in path.read_text(encoding="utf-8-sig").splitlines()
            if line.strip() and not line.startswith("#")]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--font", type=Path, help="a local PlangothicP2-Regular.ttf")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache")
    args = parser.parse_args(argv)
    from fontTools import subset
    from fontTools.ttLib import TTFont

    path = args.font or fetch(PLANGOTHIC["url"], args.cache / PLANGOTHIC["file"], PLANGOTHIC["sha256"])
    wanted = sorted({ord(char) for char in characters(SOURCE)})
    options = subset.Options()
    options.drop_tables += ["FFTM"]
    options.layout_features, options.name_IDs, options.notdef_outline = [], ["*"], True
    font = subset.load_font(str(path), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(font)
    font["head"].created, font["head"].modified = TTFont(path)["head"].created, TTFont(path)["head"].modified
    font.recalcTimestamp = False
    font.flavor = "woff2"
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    font.save(TARGET)
    print(f"{TARGET}: {len(font.getBestCmap())} characters, {TARGET.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
