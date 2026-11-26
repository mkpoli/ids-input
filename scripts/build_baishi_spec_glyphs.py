# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0"]
# ///
"""Build attested SVG glyph outlines for the zi.tools IDS Extension page (/baishi).

    uv run scripts/build_baishi_spec_glyphs.py ~/.cache/ids-input/fonts

Every outline comes from a pinned source: Noto Sans CJK JP 2.004 VF (at wght=400,
using its OpenType locl tables for ZHS, ZHH, ZHT and JAN), Plangothic P1/P2 V2.9.5795,
NightFurySL2001/bai-ids fonts/example.woff2 (SIL OFL 1.1), the repo's UCV Sans
outlines, or pinned GlyphWiki revisions via scripts/build_baishi_spec_kage.mjs.
"""
import base64
import gzip
import json
import struct
import subprocess
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

from build_ids_data import fetch
from build_ids_parts import FONTS

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "demo/lib/baishi-spec-glyphs.json"
SANS = "NotoSansCJKjp-VF-2.004.ttf"
GUIDE_FONT = (
    "https://raw.githubusercontent.com/NightFurySL2001/bai-ids/"
    "0ca5ed48f51821d4d54246196f1f5f38c9d6bd6a/fonts/example.woff2",
    "8eacc086a34e81e922516a405482d02cdc16c11e33c503516827b41816671432",
)

# (key, char, OpenType locl tag in Noto Sans CJK JP VF).
NOTO_SPECS = [
    ("十.", "十", "ZHS"),
    ("三", "三", "ZHS"),
    ("滟", "滟", "ZHS"),
    ("令.", "令", "ZHS"),
    ("令H", "令", "ZHH"),
    ("令J", "令", "JAN"),
    ("公.", "公", "ZHS"),
    ("公T", "公", "ZHT"),
    ("惠", "惠", "ZHS"),
    ("叀.", "叀", "JAN"),              # ids_lv0 l.1473: 叀. = ⿱𤰔厶.
    ("冷.", "冷", "ZHS"),
    ("冷H", "冷", "ZHH"),
    ("冷J", "冷", "JAN"),
    ("刢.", "刢", "ZHS"),
    ("斎.", "斎", "ZHS"),
    ("斎J", "斎", "JAN"),
    ("七.", "七", "ZHS"),
    ("七T", "七", "ZHT"),
    ("丁", "丁", "ZHS"),
    ("已", "已", "ZHS"),
    ("归", "归", "ZHS"),
    ("丑", "丑", "ZHS"),
    ("久", "久", "ZHS"),
    ("伨.", "伨", "ZHS"),
    ("伨H", "伨", "ZHH"),
    ("睹.", "睹", "ZHS"),
    ("睹J", "睹", "JAN"),
    ("口.", "口", "ZHS"),
    ("烕.", "烕", "ZHS"),
    ("龰.", "龰", "ZHS"),
    ("滿.", "滿", "ZHS"),
    ("父.", "父", "ZHS"),
    ("卮.", "卮", "ZHS"),              # ids_lv0 row 1391: 卮. = ⿸𠂋㔾.
    ("卮qq123", "卮", "JAN"),          # ids_lv0 row 1391 & UCV 123: 卮qq123 = ⿸𠂋巳.
    ("丰.", "丰", "ZHS"),
    ("邦.", "邦", "ZHS"),
    ("勳.", "勳", "ZHS"),
    ("刍.", "刍", "ZHS"),
    ("务.", "务", "ZHS"),
    ("子.", "子", "ZHS"),
    ("孑", "孑", "ZHS"),
    ("㇄", "㇄", "ZHS"),
    ("㇈", "㇈", "ZHS"),
    ("人", "人", "ZHS"),
    ("匚", "匚", "ZHS"),
    ("巳", "巳", "ZHS"),
    ("乌", "乌", "ZHS"),
    ("母", "母", "ZHS"),
    ("又", "又", "ZHS"),
    ("凵.", "凵", "ZHS"),
    ("廿", "廿", "ZHS"),
    ("凹.", "凹", "ZHS"),
    ("〇", "〇", "ZHS"),
    ("及.", "及", "ZHS"),
    ("包.", "包", "ZHS"),
    ("与J", "与", "JAN"),
    ("廴", "廴", "ZHS"),
    ("身", "身", "ZHS"),
    ("径.", "径", "JAN"),              # ids_lv0 row 4485: 径. = ⿰彳𢀖.
    ("径T", "径", "ZHT"),              # ids_lv0 row 4485: {?0径}⿰彳圣(T)
    ("曰", "曰", "ZHS"),
    ("士", "士", "ZHS"),
    ("一.", "一", "ZHS"),
    ("一t", "㇀", "ZHS"),
    ("叱.", "叱", "ZHS"),
    ("暅.", "暅", "ZHS"),
    ("嬴", "嬴", "ZHS"),
    ("輿", "輿", "ZHS"),
    ("伔.", "伔", "ZHS"),
]

# Donor cuts from Noto Sans CJK JP VF (key, char, locl tag or None, contour indices).
NOTO_CUTS = [
    ("七t", "切", "ZHS", [2, 4, 5]),  # ids_lv0: 切 = ⿰七t刀(.)
    ("十.t", "戢", "ZHS", [9, 10]),    # SC 戢: bottom-left 十 with rising horizontal 一t
    ("子t", "孩", "JAN", [0, 1, 2, 3]),  # 孩 = ⿰子t亥J(J)
    ("凵y", "世", "JAN", [2, 4, 5]),    # 世 = ⿻⿺𠃊.凵y一.(.)
]

# Plangothic P1/P2 glyphs (key, plane 1 or 2, char).
PLANGOTHIC_SPECS = [
    ("𣂀.", 1, "𣂀"),
    ("𱤻m", 2, "𱤻"),
    ("𡴧m", 1, "𡴧"),
    ("𠁁.", 1, "𠁁"),
    ("𠃎", 1, "𠃎"),
    ("𡆢", 1, "𡆢"),
    ("𠇇", 1, "𠇇"),
    ("𠍋", 1, "𠍋"),
    ("𱍫", 2, "𱍫"),
    ("𠀁", 1, "𠀁"),
    ("𤓷", 1, "𤓷"),
    ("𦫵", 1, "𦫵"),
    ("𠥻", 1, "𠥻"),
    ("𠂀", 1, "𠂀"),
    ("𫠣", 1, "𫠣"),
    ("𢀓", 1, "𢀓"),
    ("𫡆", 1, "𫡆"),
    ("𢧟", 1, "𢧟"),
    ("𦥮.", 1, "𦥮"),
    ("𡮂T", 1, "𡮂"),
    ("𡭽.", 1, "𡭽"),
]

# PUA glyphs from NightFurySL2001/bai-ids fonts/example.woff2 (SIL OFL 1.1).
GUIDE_SPECS = [
    ("令d..", "\ue017"),
    ("令dh.", "\ue016"),
    ("令dhs", "\ue015"),
    ("刢J", "\ue019"),
    ("刢T", "\ue018"),
    ("𣂀Q", "\ue002"),
    ("父qq222", "\ue021"),
    ("𡕙.", "\ue023"),
    ("𡕙qq053194", "\ue022"),
    ("丰..p", "\ue003"),
    ("勳r", "\ue004"),
    ("刍x", "\ue006"),
    ("务y", "\ue007"),
    ("𠁁y2", "\ue008"),
    ("⿻[b]㇉一", "\ue005"),
    ("⿻[xl,.l|r.,rx]口口", "\ue024"),
]

# UCV rule forms from data/ucv.json + data/ucv-outlines-sans.json.gz.
UCV_SPECS = [
    ("口q3162", "316", 2, "cdp-89cc"),
    ("龰q3932", "393", 2, "cdp-8961"),
    ("滿q454a17", "454a", 17, "twedu-a02309-037"),
    ("凹q4382", "438", 2, "cdp-885b-var-006"),
]


def locl_maps(font):
    gsub = font["GSUB"].table
    hani = next(s.Script for s in gsub.ScriptList.ScriptRecord if s.ScriptTag == "hani")
    out = {}
    for lr in hani.LangSysRecord:
        tag = lr.LangSysTag.strip()
        mapping = {}
        for fi in lr.LangSys.FeatureIndex:
            fr = gsub.FeatureList.FeatureRecord[fi]
            if fr.FeatureTag == "locl":
                for li in fr.Feature.LookupListIndex:
                    lookup = gsub.LookupList.Lookup[li]
                    for st in lookup.SubTable:
                        real = st.ExtSubTable if lookup.LookupType == 7 else st
                        if hasattr(real, "mapping"):
                            mapping.update(real.mapping)
        out[tag] = mapping
    return out


def draw_glyph(font, glyph_name, is_vf=False):
    glyphs = font.getGlyphSet(location={"wght": 400} if is_vf and "fvar" in font else None)
    recording = DecomposingRecordingPen(glyphs)
    glyphs[glyph_name].draw(recording)
    upm = font["head"].unitsPerEm
    asc = font["OS/2"].sTypoAscender
    scale = 1000 / upm
    pen = SVGPathPen(None, ntos=lambda n: f"{n:.1f}".removesuffix(".0"))
    recording.replay(TransformPen(pen, (scale, 0, 0, -scale, 0, asc * scale)))
    return pen.getCommands()


def fit_paths(paths, ink_box=None):
    bounds = BoundsPen(None)
    for path in paths:
        parse_path(path, bounds)
    left, top, right, bottom = bounds.bounds
    if ink_box is None:
        sx = sy = 880 / max(right - left, bottom - top)
        cx = cy = 500
    else:
        x0, y0, x1, y1 = ink_box
        sx, sy = (x1 - x0) / (right - left), (y1 - y0) / (bottom - top)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    transform = (sx, 0, 0, sy, cx - sx * (left + right) / 2, cy - sy * (top + bottom) / 2)
    out = []
    for path in paths:
        pen = SVGPathPen(None, ntos=lambda n: f"{n:.1f}".removesuffix(".0"))
        parse_path(path, TransformPen(pen, transform))
        out.append(pen.getCommands())
    return "".join(out)


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "cache"
    out = {}

    url, sha = FONTS[SANS]
    with TTFont(fetch(url, cache / SANS, sha)) as vf:
        cmap = vf.getBestCmap()
        locl = locl_maps(vf)
        for key, char, lang in NOTO_SPECS:
            base = cmap[ord(char)]
            glyph = locl[lang].get(base, base)
            out[key] = draw_glyph(vf, glyph, is_vf=True)
        for key, char, lang, indices in NOTO_CUTS:
            base = cmap[ord(char)]
            glyph = locl[lang].get(base, base) if lang else base
            d = draw_glyph(vf, glyph, is_vf=True)
            contours = ["M" + part for part in d.split("M")[1:]]
            out[key] = fit_paths([contours[i] for i in indices])

    # Fit the standalone Japanese 叀 to the existing default tile’s ink box.
    out["叀."] = fit_paths([out["叀."]], ink_box=(64.2, 39.6, 937.4, 951.3))

    # ids_lv0 line 4833: 惠 = ⿱叀y2002心. Its first seven contours include
    # the uninterrupted 丨. Fit them to the y2002 tile's original ink box.
    hui_top = ["M" + part for part in out["惠"].split("M")[1:8]]
    out["叀y2002"] = fit_paths(hui_top, ink_box=(60.3, 41.1, 941.2, 967.6))

    p1_name, p2_name = "PlangothicP1-Regular.ttf", "PlangothicP2-Regular.ttf"
    with (
        TTFont(fetch(*FONTS[p1_name][:1], cache / p1_name, FONTS[p1_name][1])) as p1,
        TTFont(fetch(*FONTS[p2_name][:1], cache / p2_name, FONTS[p2_name][1])) as p2,
    ):
        fonts = {1: p1, 2: p2}
        for key, plane, char in PLANGOTHIC_SPECS:
            font = fonts[plane]
            out[key] = draw_glyph(font, font.getBestCmap()[ord(char)])

    with TTFont(fetch(GUIDE_FONT[0], cache / "bai-ids-example.woff2", GUIDE_FONT[1])) as guide:
        cmap = guide.getBestCmap()
        for key, char in GUIDE_SPECS:
            out[key] = draw_glyph(guide, cmap[ord(char)])

    ucv_entries = {e["id"]: e for e in json.loads((ROOT / "data/ucv.json").read_text())["entries"]}
    ucv_records = json.loads(
        gzip.decompress((ROOT / "data/ucv-outlines-sans.json.gz").read_bytes())
    )["records"]
    for key, rule, position, expected in UCV_SPECS:
        name = ucv_entries[rule]["forms"][position - 1]["glyph"]
        if name != expected:
            raise ValueError(f"UCV {rule} form {position}: expected {expected}, found {name}")
        contours = ucv_records[f"&GW-{name};"]["G"]["p"]
        polygons = []
        for commands, points, _delta in contours:
            pairs = struct.iter_unpack("<hh", base64.b64decode(points))
            polygons.append(
                "".join(f"{op}{x / 4:g} {880 - y / 4:g}" for op, (x, y) in zip(commands, pairs, strict=True))
                + "Z"
            )
        out[key] = "".join(polygons)

    kage = subprocess.check_output(["node", ROOT / "scripts/build_baishi_spec_kage.mjs"], text=True)
    for key, path in json.loads(kage).items():
        out[key] = fit_paths([path])

    TARGET.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {len(out)} glyphs ({TARGET.stat().st_size} bytes) -> {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
