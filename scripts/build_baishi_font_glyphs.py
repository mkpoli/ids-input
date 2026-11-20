# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0"]
# ///
"""Prepare the cheatsheet's Source Han witnesses at Regular weight.

    uv run scripts/build_baishi_font_glyphs.py ~/.cache/ids-input/fonts
"""
import json
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

from build_baishi_variant_glyphs import fitted
from build_ids_data import fetch
from build_ids_parts import FONTS

ROOT = Path(__file__).resolve().parents[1]
SANS = "NotoSansCJKjp-VF-2.004.ttf"


def contours(font, text, regional=None):
    base = ord(text[0])
    name = regional or font.getBestCmap()[base]
    if len(text) == 2:
        uvs = next(table for table in font["cmap"].tables if table.format == 14)
        name = dict(uvs.uvsDict[ord(text[1])])[base]
        if name is None or name == font.getBestCmap()[base]:
            raise ValueError(f"{text} must have a distinct outline")
    glyphs = font.getGlyphSet(location={"wght": 400} if "fvar" in font else None)
    recording = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(recording)
    path = SVGPathPen(None, ntos=lambda n: f"{n:.2f}".rstrip("0").rstrip("."))
    recording.replay(TransformPen(path, (1, 0, 0, -1, 0, 880)))
    return ["M" + part for part in path.getCommands().split("M")[1:]]


# Cuts from the indicated headwords in the sheet's pinned ids_lv0. Contour
# numbers are specific to this face. The tag describes the extracted strokes.
CUTS = {
    "一t": ("㇀", [0]),                 # #(T)
    "乚t": ("㇙", [0, 1]),              # #(ST), also the t form of 𠃊
    "丶s": ("宀", [0]),                 # ⿱丶s冖(J)
    "己t": ("邔", [2, 3, 4]),           # ⿰己t阝
    "己w": ("𢁉", [4, 8]),              # ⿱⿰己w己w共.
    "人d": ("从", [1, 3]),              # ⿰人d人.
    "厂s": ("長", [6]),                 # ⿳⿸厂s二.一.𰀠t.
    "匚t": ("𠩐", [3, 6, 7]),           # ⿸厂.⿸匚t⿱二.⿺乀.丿
    "几t": ("殼", [3, 6, 7, 8]),        # ⿹𣪊J几t(J)
    "了s": ("𤴔", [0, 4, 5]),           # ⿱⿻了s⺊一.
}


def cut_forms(font, cuts):
    forms = {}
    for tag, (donor, indices) in cuts.items():
        paths = contours(font, donor)
        cut = RecordingPen()
        for i in indices:
            parse_path(paths[i], cut)
        forms[tag] = fitted(cut, 1)
    return forms


def fit_together(paths):
    bounds = BoundsPen(None)
    for path in paths:
        parse_path(path, bounds)
    left, top, right, bottom = bounds.bounds
    scale = 900 / max(right - left, bottom - top)
    transform = (scale, 0, 0, scale, 500 - scale * (left + right) / 2, 500 - scale * (top + bottom) / 2)
    result = []
    for path in paths:
        pen = SVGPathPen(None, ntos=lambda n: f"{n:.1f}".removesuffix(".0"))
        parse_path(path, TransformPen(pen, transform))
        result.append(pen.getCommands())
    return result


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "cache"
    url, sha = FONTS[SANS]
    with TTFont(fetch(url, cache / SANS, sha)) as font:
        glyphs = {text: contours(font, text) for text in ["工󠄁", "午"]}
        # hani/ZHS locl in the pinned JP VF. SC 戢 connects the upper bar
        # across both halves; its bottom-left stroke rises through the upright.
        glyphs["戢"] = contours(font, "戢", "glyph18542")
        glyphs["十.t"] = fit_together([glyphs["戢"][i] for i in [9, 10]])
        forms = cut_forms(font, CUTS)
        sc_duo = contours(font, "朵", "glyph20773")
        forms["几w"] = "".join(fit_together([sc_duo[i] for i in [0, 1, 6]]))
    name = "PlangothicP1-Regular.ttf"
    url, sha = FONTS[name]
    with TTFont(fetch(url, cache / name, sha)) as font:
        forms.update(cut_forms(font, {"己z": ("𠃚", [0])}))  # ⿸己z𠃌
    data = {"glyphs": glyphs, "variants": forms}
    out = ROOT / "demo/lib/baishi-font-glyphs.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
