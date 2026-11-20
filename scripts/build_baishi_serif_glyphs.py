# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.63.0"]
# ///
"""Serif counterparts of the font cuts used in the Baishi sheet.

    uv run scripts/build_baishi_serif_glyphs.py ~/.cache/ids-input/fonts
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

from fontTools.ttLib import TTFont

from build_baishi_font_glyphs import CUTS, ROOT, contours, cut_forms, fit_together
from build_baishi_variant_glyphs import ucv_forms
from build_ids_data import fetch

SERIF = "NotoSerifCJKjp-VF-2.003.ttf"
SERIF_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/Serif2.003/Serif/Variable/TTF/NotoSerifCJKjp-VF.ttf"
JIGMO_URL = "https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip"
# Same headwords as the Sans witnesses, with the corresponding Serif contours.
INDICES = {
    "一t": [0], "乚t": [0, 1, 2], "丶s": [0], "己t": [0, 1, 2, 3, 4, 5],
    "己w": [0, 11, 12, 13], "人d": [2, 3], "厂s": [1, 8], "匚t": [2, 3, 4, 5],
    "几t": [1, 2, 9, 10], "几z": [0, 1, 2], "𠃑p": [9, 10, 11, 12], "了s": [0, 2, 4],
}


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "cache"
    sha = "c2ff7cffb6ef75193d4406b030eab5aa6503c48004acec6b040327e2fe1e9e51"
    with TTFont(fetch(SERIF_URL, cache / SERIF, sha)) as font:
        glyphs = {char: contours(font, char) for char in ["工󠄁", "午"]}
        glyphs["戢"] = contours(font, "戢", "glyph18561")  # hani/ZHS locl
        glyphs["十.t"] = fit_together([glyphs["戢"][i] for i in [10, 3]])
        variants = cut_forms(font, {tag: (CUTS[tag][0], indices) for tag, indices in INDICES.items()})
        sc_duo = contours(font, "朵", "glyph20736")
        variants["几w"] = "".join(fit_together([sc_duo[i] for i in [1, 2, 3]]))
        # hani locl glyphs in Serif 2.003. The JP 乂 includes the raised onset.
        for tag, (char, name) in {
            "乂.": ("乂", "glyph09601"), "乂J": ("乂", None),
            "八.": ("八", "glyph10911"), "八T": ("八", "glyph10912"),
            "宀.": ("宀", "glyph15419"), "宀J": ("宀", None),
            "七T": ("七", "glyph09516"), "亥.": ("亥", "glyph09741"),
            "鹿.": ("鹿", "glyph46715"), "鹿H": ("鹿", "glyph46716"),
            "丰H": ("丰", "glyph09577"), "亠.": ("亠", "glyph09731"),
        }.items():
            variants[tag] = "".join(fit_together(contours(font, char, name)))
        # Tag, host glyph, localized glyph name, Serif contour numbers.
        for tag, char, name, indices in [
            ("八d", "六", None, [2, 3]),
            ("亘t", "刯", None, [2, 3, 4, 5, 6]),
            ("二t", "北", None, [0, 2]),
            ("七t", "切", "glyph11151", [0, 1, 2, 3]),
            ("小s", "少", "glyph15714", [1, 2, 3]),
            ("矢d", "知", None, [0, 1, 2, 3, 4]),
            ("丰.t.", "彗", None, [2, 5, 6, 11]),
            ("木d", "朴", None, [2, 3, 4, 5]),
            ("止t", "此", None, [2, 3, 4, 5]),
            ("儿w", "㓁", "glyph02653", [0, 1]),
            ("干p", "幵", "glyph16881", [0, 1, 5]),
            ("亠jh", "言", None, [0, 3]),
            ("乂d", "凶", None, [0, 4]),
            ("干t", "耳", None, [2, 4, 5]),
            ("スn", "久", None, [1, 2, 3]),
            ("𠃊w", "亡", None, [1, 3]),
        ]:
            paths = contours(font, char, name)
            variants[tag] = "".join(fit_together([paths[i] for i in indices]))
    variants.update(ucv_forms("ucv-outlines.json.gz"))
    mincho = subprocess.check_output(["node", ROOT / "scripts/build_baishi_kage.mjs", "--serif"], text=True)
    for tag, path in json.loads(mincho).items():
        variants[tag] = "".join(fit_together([path]))
    jigmo = cache / "Jigmo-20250912-Jigmo2.ttf"
    if not jigmo.exists():
        with ZipFile(fetch(JIGMO_URL, cache / "Jigmo-20250912.zip")) as archive:
            jigmo.write_bytes(archive.read("Jigmo2.ttf"))
    if hashlib.sha256(jigmo.read_bytes()).hexdigest() != "5da3582efe77e22073b86b3b86b556d7111148a76b957cfb53318a91da2efff0":
        raise ValueError("Expected Jigmo2 from 2025-09-12")
    with TTFont(jigmo) as font:
        glyphs["𭬁"] = contours(font, "𭬁")
        variants.update(cut_forms(font, {
            "己z": ("𠃚", [1]), "止y": ("𠣏", [1]), "儿t": ("𬷼", [0, 2]),
            "旦t": ("𠛣", [1, 3, 4, 5]),
        }))
    mincho_cards = json.loads((ROOT / "demo/lib/baishi-serif-kage.json").read_text())
    variants["𤽄V"] = "".join(fit_together([mincho_cards["smallJ"][1]]))
    output = ROOT / "demo/lib/baishi-serif-witnesses.json"
    output.write_text(json.dumps({"glyphs": glyphs, "variants": variants}, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
