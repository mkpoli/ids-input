# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0", "skia-pathops==0.9.2", "numpy==2.1.3"]
# ///
"""Cut each component no code point names out of the characters that write it.

A zi.tools stroke chain (#(-𠃍㇉)) or a CHISE entity (&CDP-8958;) has no glyph of its own, but
the characters described with it do. Where such a character is the component beside one encoded
part (马 is ⿹#(-𠃍㇉)一 in effect; 冐's description holds &CDP-8958; over ⺜), the font draws the
two as outlines that do not touch, and the component is what is left when the part's outlines are
lifted away. Nothing is cut along a line the font does not draw: a host whose part touches the
component gives nothing.

For each component every such host is tried, in each face the composer draws with. In a host, the
outlines given to the part are the group whose fingerprint (ink over a grid on its own box) best
matches the part drawn alone, on the side the operator puts it. What is left is kept only if it
stands up:

- held against the component's GlyphWiki glyph (data/custom-outlines.json.gz), where there is one,
  which then decides alone;
- else against what other hosts leave, two hosts agreeing;
- else, from one host, only when its parts lift away unmistakably (marked `single`).

    uv run scripts/build_custom_cuts.py [--only TEXT…] [--workers N]

Writes custom-forms.json.gz into the han-compose checkout COMPOSER_REPO names (its `data/`): per
style, each component's outlines in the composer's form format (`g`, as in `component-forms.json`),
with the host it was cut from (`from`), the face, the parts lifted away and the scores that kept it.

Character shapes, as han-compose draws each style: Noto Sans CJK JP 2.004, then Plangothic P1 and P2
V2.9.5795 (SIL OFL 1.1); Noto Serif CJK JP 2.003 (SIL OFL 1.1), then Jigmo 2025-09-12 (Kamichi Koichi,
CC0 1.0). Faces are pinned by SHA-256 and fetched into ~/.cache/ids-input/fonts when missing. Descriptions: BabelStone IDS
(Andrew West), CHISE IDS (data/chise-sources.json), and Yi Bai's zi.tools IDS (ids_lv1.txt, MIT).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import itertools
import json
import re
import sys
import tarfile
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
import pathops
from fontTools.pens.basePen import BasePen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_donor_parts as donor  # noqa: E402
from engine_data import WRITE_DATA  # noqa: E402

OUT = WRITE_DATA / "custom-forms.json.gz"

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ZI = {"revision": "da1e9f8a09e2ec8faaf176bac99203f978282041",
      "sha256": "51f78d7d84f52fd73e5bc155c2239b737c58ce627d446894a809f1a36547ae18"}
OFL = "SIL OFL 1.1"
PLANGOTHIC = "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795"
JIGMO = "https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip"
#: The faces each style draws with, first the one that draws a character: han-compose's style chains
#: (src/han_compose/compose.py, STYLES), so a cut is the glyph the composer would draw.
STYLES = {
    "sans": [
        {"file": "NotoSansCJKjp-VF-2.004.ttf", "sha256": "240c9b83bf7b386edbae39995ae7e068ed4583f484d92e4a74c34158b5f27b1a",
         "url": "https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/Variable/TTF/NotoSansCJKjp-VF.ttf", "licence": OFL},
        {"file": "PlangothicP1-Regular.ttf", "sha256": "550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6",
         "url": f"{PLANGOTHIC}/PlangothicP1-Regular.ttf", "licence": OFL},
        {"file": "PlangothicP2-Regular.ttf", "sha256": "681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f",
         "url": f"{PLANGOTHIC}/PlangothicP2-Regular.ttf", "licence": OFL},
    ],
    "serif": [
        {"file": "NotoSerifCJKjp-VF-2.003.ttf", "sha256": "c2ff7cffb6ef75193d4406b030eab5aa6503c48004acec6b040327e2fe1e9e51",
         "url": "https://github.com/notofonts/noto-cjk/raw/Serif2.003/Serif/Variable/TTF/NotoSerifCJKjp-VF.ttf", "licence": OFL},
        *({"file": f"Jigmo-20250912-{name}", "sha256": sha, "url": JIGMO, "licence": "CC0 1.0"}
          for name, sha in (("Jigmo2.ttf", "5da3582efe77e22073b86b3b86b556d7111148a76b957cfb53318a91da2efff0"),
                            ("Jigmo3.ttf", "815b18c1c670103723fe743090559208fdea47dc587ecb057a5a4721ee8dfeff"),
                            ("Jigmo.ttf", "c8f295b9bd8f9f117a76b3a454aaaa1bb5b4babc18e254978c6deb88464e40cf"))),
    ],
}
FONTS = Path.home() / ".cache/ids-input/fonts"
SOURCE_OF = {"entity": "chise", "chain": "zi-tools"}

#: The raster the outlines are read on: one cell per this many em units.
UNIT = 8
#: A group of outlines is the part when it matches the part drawn alone at least this well...
MATCH = 0.55
#: ...and better than any other group by this much.
MARGIN = 0.04
#: A host is read only if it splits into at most this many outlines.
MOST_PIECES = 10
#: How many hosts are tried for each component.
MOST_HOSTS = 12
#: What is left stands as the component when it matches the GlyphWiki glyph this well...
REFERENCE = 0.35
#: ...or when another host leaves something this like it...
AGREE = 0.7
#: ...or, from one host alone, when the parts lift away this clearly.
CLEAR_MATCH, CLEAR_MARGIN = 0.75, 0.2

OPERATORS = {chr(c): 2 for c in range(0x2FF0, 0x3000)} | {"⿲": 3, "⿳": 3, "㇯": 2, "⿾": 1, "⿿": 1, "〾": 1}
BESIDE = {"⿰": "x", "⿱": "y", "⿲": "x", "⿳": "y"}
ENCLOSING = set("⿴⿵⿶⿷⿸⿹⿺⿼⿽")


# ------------------------------------------------------------------ descriptions

def tokens(text: str) -> list[str]:
    """A description's operators and components: a custom component ({53}, &CDP-8958;, #(-𠃍㇉))
    is one token, a character keeps the variation selector after it."""
    out, at = [], 0
    while at < len(text):
        char = text[at]
        if char in "{&":
            end = text.find("}" if char == "{" else ";", at)
            if end < 0:
                return []
            out.append(text[at:end + 1]); at = end + 1
        elif char == "#" and text[at + 1:at + 2] == "(":
            depth, end = 0, at + 1
            while end < len(text):
                depth += {"(": 1, ")": -1}.get(text[end], 0)
                end += 1
                if depth == 0:
                    break
            out.append(text[at:end]); at = end
        elif 0xFE00 <= ord(char) <= 0xFE0F or 0xE0100 <= ord(char) <= 0xE01EF:
            if not out:
                return []
            out[-1] += char; at += 1
        else:
            out.append(char); at += 1
    return out


def plain(text: str) -> str:
    """A description without zi.tools' notes: the source tags after it ((.,H), (q4862.)) and the
    notes on an operator ([1:], [_x])."""
    text = re.sub(r"\[[^\]]*\]", "", text)
    return re.sub(r"(?<!#)\([.,0-9A-Za-z]*\)$", "", text)


def parse(text: str):
    """A description as nested tuples (operator, operand, …), or None if it does not read."""
    items = tokens(plain(text))

    def read(at: int):
        if at >= len(items):
            raise ValueError
        head = items[at]
        if head in OPERATORS:
            parts, at = [head], at + 1
            for _ in range(OPERATORS[head]):
                part, at = read(at)
                parts.append(part)
            return tuple(parts), at
        return head, at + 1

    try:
        tree, end = read(0)
    except ValueError:
        return None
    return tree if end == len(items) else None


def encoded(part) -> bool:
    return isinstance(part, str) and len(part.rstrip("︀︁︂︃︄︅︆︇︈︉︊︋︌︍︎️")) == 1


def zi_table() -> str:
    cache = ROOT / "cache" / "custom-components" / f"ids_lv1-{ZI['revision']}.txt"
    raw = cache.read_bytes() if cache.exists() else b""
    if hashlib.sha256(raw).hexdigest() != ZI["sha256"]:
        url = f"https://raw.githubusercontent.com/yi-bai/ids/{ZI['revision']}/ids_lv1.txt"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ids-input build"}), timeout=120) as response:
            raw = response.read()
        if hashlib.sha256(raw).hexdigest() != ZI["sha256"]:
            raise SystemExit("Yi Bai IDS: unexpected source hash")
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(raw)
    return raw.decode("utf-8")


def tables() -> dict[str, dict[str, list[str]]]:
    """Each source's descriptions by character, as build_custom_components.mjs reads them."""
    out: dict[str, dict[str, list[str]]] = {"babelstone": {}, "chise": {}, "zi-tools": {}}

    def add(source: str, char: str, text: str) -> None:
        out[source].setdefault(char, []).append(text)

    with tarfile.open(DATA / "ids-corpus-sources.tar.gz") as archive:
        for member in archive.getmembers():
            if not member.name.startswith("IDS-"):
                continue
            for line in archive.extractfile(member).read().decode("utf-8").split("\n"):
                fields = line.split("\t")
                if len(fields) >= 3 and re.match(r"^U[+-][0-9A-F]+$", fields[0], re.I) and len(fields[1]) == 1:
                    add("chise", fields[1], fields[2])
    for row in zi_table().split("\n"):
        char, *columns = row.split("\t")
        if len(char) == 1:
            for column in columns:
                for part in column.split(";"):
                    if part.strip():
                        add("zi-tools", char, part.strip())
    return out


def leaves(tree) -> list[str]:
    return [tree] if isinstance(tree, str) else [leaf for part in tree[1:] for leaf in leaves(part)]


#: At most this many parts are lifted out of a host.
MOST_PARTS = 4


def recipes(component: dict, table: dict[str, list[str]]) -> list[dict]:
    """The hosts a component can be cut from: a character whose description holds it once beside
    encoded parts only, the parts to lift away, and, where it is one of two operands, where the
    operator puts the other; then the subtraction the dictionary records."""
    text, found, seen = component["text"], [], set()

    def add(host: str, parts: list[str], op: str | None = None, side: int = 0) -> None:
        key = (host, tuple(sorted(parts)))
        if key not in seen and 0 < len(parts) <= MOST_PARTS:
            seen.add(key)
            found.append({"host": host, "parts": parts, "op": op, "side": side})

    subtraction = parse(component.get("subtraction") or "")
    removed = []
    while isinstance(subtraction, tuple) and subtraction[0] == "㇯" and encoded(subtraction[2]):
        removed.append(subtraction[2]); subtraction = subtraction[1]
    if encoded(subtraction):
        add(subtraction, removed, "㇯")
    for host in component["usedIn"]:
        for description in table.get(host, []):
            tree = parse(description)
            if tree is None:
                continue
            others = leaves(tree)
            if others.count(text) != 1:
                continue
            others.remove(text)
            if not all(encoded(leaf) for leaf in others):
                continue
            if len(tree) == 3 and text in tree[1:]:
                add(host, others, tree[0], tree.index(text) - 1)
            else:
                add(host, others)
    return found[:MOST_HOSTS]


# ------------------------------------------------------------------ outlines

class Face:
    def __init__(self, path: Path, pin: dict):
        self.pin = pin
        self.font = TTFont(path)
        self.name = self.font["name"].getDebugName(4)
        self.version = self.font["name"].getDebugName(5)
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet(location={"wght": 400}) if "fvar" in self.font else self.font.getGlyphSet()
        self.scale = 1000 / self.font["head"].unitsPerEm
        self.cache: dict[str, list[pathops.Path] | None] = {}

    def pieces(self, char: str) -> list[pathops.Path] | None:
        if char not in self.cache:
            name = self.cmap.get(ord(char[0])) if char else None
            if name is None:
                self.cache[char] = None
            else:
                path = pathops.Path()
                pen = path.getPen(glyphSet=self.glyphs)
                if self.scale != 1:
                    from fontTools.pens.transformPen import TransformPen
                    pen = TransformPen(pen, (self.scale, 0, 0, self.scale, 0, 0))
                self.glyphs[name].draw(pen)
                path.simplify()
                found = [piece for piece in donor.pieces_of(path) if abs(piece.area) >= donor.EPS_AREA]
                self.cache[char] = found or None
        return self.cache[char]


def mask(piece: pathops.Path) -> np.ndarray:
    """A piece's ink on the em raster, rows from the top."""
    side = 1000 // UNIT + 1
    ys = 880 - (np.arange(side) + 0.5) * UNIT
    xs = (np.arange(side) + 0.5) * UNIT
    out = np.zeros((side, side), dtype=bool)
    for ring in donor.rings_of(piece):
        ring = np.asarray(ring)
        x0, y0, x1, y1 = ring[:-1, 0], ring[:-1, 1], ring[1:, 0], ring[1:, 1]
        for row, y in enumerate(ys):
            cross = (y0 > y) != (y1 > y)
            if not cross.any():
                continue
            at = x0[cross] + (x1[cross] - x0[cross]) * (y - y0[cross]) / (y1[cross] - y0[cross])
            out[row] ^= (np.searchsorted(np.sort(at), xs) % 2).astype(bool)
    return out


def print_of(ink: np.ndarray, grid: int = donor.GRID) -> np.ndarray | None:
    """Coverage over a grid laid on the ink's own box: the shape, whatever its size."""
    rows, cols = np.nonzero(ink)
    if not len(rows):
        return None
    crop = ink[rows.min():rows.max() + 1, cols.min():cols.max() + 1].astype(float)
    # A shape thinner than the grid (a bar of a few raster rows) is stretched first, so every grid row
    # reads it whole: averaged as it is, a 9-row bar and an 8-row one fill different grid rows.
    crop = np.repeat(np.repeat(crop, -(-grid // crop.shape[0]), axis=0), -(-grid // crop.shape[1]), axis=1)
    h, w = crop.shape
    ri = np.minimum((np.arange(h) * grid) // h, grid - 1)
    ci = np.minimum((np.arange(w) * grid) // w, grid - 1)
    total = np.zeros((grid, grid)); count = np.zeros((grid, grid))
    np.add.at(total, (ri[:, None], ci[None, :]), crop)
    np.add.at(count, (ri[:, None], ci[None, :]), 1)
    return total / np.maximum(count, 1)


def like(a: np.ndarray | None, b: np.ndarray | None) -> float:
    if a is None or b is None:
        return 0.0
    total = np.maximum(a, b).sum()
    return float(np.minimum(a, b).sum() / total) if total else 0.0


def centre(ink: np.ndarray) -> tuple[float, float]:
    rows, cols = np.nonzero(ink)
    return float(cols.mean()), float(rows.mean())


def box(ink: np.ndarray) -> tuple[int, int, int, int]:
    rows, cols = np.nonzero(ink)
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


def placed(recipe: dict, part: np.ndarray, rest: np.ndarray) -> bool:
    """Whether a part's outlines sit where the operator puts it, when the component is one of the
    operator's two operands and the part the other."""
    op, side = recipe["op"], recipe["side"]
    if len(recipe["parts"]) != 1 or op is None:
        return True
    if op in BESIDE:
        axis = 0 if BESIDE[op] == "x" else 1
        here, there = centre(part)[axis], centre(rest)[axis]
        return there < here if side == 0 else here < there
    if op in ENCLOSING:
        inner, outer = (part, rest) if side == 0 else (rest, part)
        ix0, iy0, ix1, iy1 = box(inner)
        ox0, oy0, ox1, oy1 = box(outer)
        slack = 3
        return ix0 >= ox0 - slack and iy0 >= oy0 - slack and ix1 <= ox1 + slack and iy1 <= oy1 + slack
    return True


def drawn(faces: list[Face], char: str, first: Face | None = None) -> tuple[Face | None, list[pathops.Path] | None]:
    """A character's pieces from `first` if it draws it, else from the first face of the style that
    does: Jigmo and Plangothic each split one design across several files."""
    for face in ([first] if first else []) + faces:
        found = face.pieces(char)
        if found:
            return face, found
    return None, None


def cut(faces: list[Face], recipe: dict) -> dict | None:
    """What a host leaves once each part's outlines are lifted away, or None. A part takes the
    group of outlines that matches it drawn alone best, by a margin over every other group."""
    face, pieces = drawn(faces, recipe["host"])
    if not pieces or len(pieces) < 2 or len(pieces) > MOST_PIECES:
        return None
    alone = {part: drawn(faces, part, face)[1] for part in recipe["parts"]}
    if not all(alone.values()):
        return None
    masks = [mask(piece) for piece in pieces]
    references = {part: np.logical_or.reduce([mask(piece) for piece in found]) for part, found in alone.items()}
    left, matches, margins = set(range(len(pieces))), [], []
    for part in sorted(recipe["parts"], key=lambda part: -references[part].sum()):
        reference = print_of(references[part])
        scored = []
        for size in range(1, len(left)):
            for chosen in itertools.combinations(sorted(left), size):
                ink = np.logical_or.reduce([masks[i] for i in chosen])
                rest = np.logical_or.reduce([masks[i] for i in left - set(chosen)])
                if ink.any() and rest.any():
                    scored.append((like(print_of(ink), reference), chosen, placed(recipe, ink, rest)))
        fits = [row for row in scored if row[2]]
        if not fits:
            return None
        best, chosen, _ = max(fits, key=lambda row: row[0])
        # The margin is over every other group, wherever it sits: a host where position leaves one
        # candidate has not shown that the part stands out.
        second = max((row[0] for row in scored if row[1] != chosen), default=0.0)
        if best < MATCH or best - second < MARGIN:
            return None
        left -= set(chosen)
        matches.append(best); margins.append(best - second)
    rest = np.logical_or.reduce([masks[i] for i in left])
    return {"recipe": recipe, "match": round(min(matches), 3), "margin": round(min(margins), 3), "face": face.name,
            "print": print_of(rest), "pieces": [pieces[i] for i in sorted(left)]}


# ------------------------------------------------------------------ the forms

class Contours(BasePen):
    """Contours in the composer's form format: pen commands, then the flat points."""

    def __init__(self):
        super().__init__(None)
        self.result = []

    def _moveTo(self, p):
        self.ops, self.points = "M", list(p)

    def _lineTo(self, p):
        self.ops += "L"; self.points.extend(p)

    def _qCurveToOne(self, a, b):
        self.ops += "Q2"; self.points.extend((*a, *b))

    def _closePath(self):
        self.result.append([self.ops, [round(x, 2) for x in self.points]])

    def _endPath(self):
        self._closePath()


def form_of(pieces: list[pathops.Path]) -> list:
    """One group holding every outline of the component, as the composer's forms carry it."""
    pen = Contours()
    for piece in pieces:
        recording = RecordingPen()
        piece.draw(recording)
        recording.replay(Cu2QuPen(pen, 0.5))
    return [pen.result]


def glyphwiki_prints() -> dict[str, np.ndarray]:
    """Each entity's GlyphWiki glyph, as a fingerprint, by the entity's text."""
    body = json.loads(gzip.decompress((DATA / "custom-outlines.json.gz").read_bytes()))
    out = {}
    for text, name in body["names"].items():
        d = body["outlines"].get(name)
        if not d:
            continue
        path = pathops.Path()
        parse_path(d, path.getPen())
        # GlyphWiki draws on a 200-unit square, y down: turn it onto the em the cuts are read on.
        flipped = pathops.Path()
        from fontTools.pens.transformPen import TransformPen
        path.draw(TransformPen(flipped.getPen(), (5, 0, 0, -5, 0, 880)))
        flipped.simplify()
        out[text] = print_of(mask(flipped))
    return out


# ------------------------------------------------------------------ the build

FACES: dict[str, list[Face]] = {}


def open_faces() -> None:
    for style, pins in STYLES.items():
        FACES[style] = [Face(donor.find_face(pin, FONTS, False), pin) for pin in pins]


def settle(job: tuple[dict, list[dict], np.ndarray | None]) -> tuple[str, dict]:
    """Every host's cut of one component in each style, and the one that stands, if any."""
    component, found, reference = job
    out = {}
    for style, faces in FACES.items():
        cuts = []
        for recipe in found:
            got = cut(faces, recipe)
            if got:
                cuts.append(got)
        best = None
        for got in cuts:
            agree = len({other["recipe"]["host"] for other in cuts
                         if other["recipe"]["host"] != got["recipe"]["host"] and like(got["print"], other["print"]) >= AGREE})
            check = like(got["print"], reference) if reference is not None else None
            single = got["match"] >= CLEAR_MATCH and got["margin"] >= CLEAR_MARGIN
            # A glyph to hold the cut against decides; hosts agreeing on a cut it rejects agree on a misreading.
            stands = check >= REFERENCE if check is not None else agree >= 1 or single
            score = (check or 0) + agree + got["match"]
            if stands and (best is None or score > best[0]):
                best = (score, got, agree, check)
        if best:
            _, got, agree, check = best
            out[style] = {"g": form_of(got["pieces"]), "from": got["recipe"]["host"],
                          "recipe": f"{got['recipe']['op'] or ''} {' '.join(got['recipe']['parts'])}".strip(), "face": got["face"],
                          "match": got["match"], "margin": got["margin"], "agree": agree,
                          **({"reference": round(check, 3)} if check is not None else {}),
                          **({"single": True} if not agree and check is None else {}), "tried": len(cuts)}
        else:
            out[style] = {"tried": len(cuts)}
    return component["text"], out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="*", default=None)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args(argv)
    components = [row for row in json.loads(gzip.decompress((DATA / "custom-components.json.gz").read_bytes()))["components"]
                  if row["kind"] in SOURCE_OF and (args.only is None or row["text"] in args.only)]
    table = tables()
    references = glyphwiki_prints()
    jobs = [(row, recipes(row, table[SOURCE_OF[row["kind"]]]), references.get(row["text"])) for row in components]
    open_faces()  # fetches any missing face once, before the workers read them
    with ProcessPoolExecutor(args.workers, initializer=open_faces) as pool:
        results = dict(pool.map(settle, jobs, chunksize=8))
    styles = {style: {text: entry[style] for text, entry in sorted(results.items()) if "g" in entry[style]} for style in ("sans", "serif")}
    body = {
        "format": "han-compose/custom-forms", "version": 1,
        "builder": "ids-input scripts/build_custom_cuts.py",
        "sources": {style: [{"name": face.name, "version": face.version, "sha256": face.pin["sha256"], "licence": face.pin["licence"]}
                            for face in faces] for style, faces in FACES.items()},
        "data": {
            "descriptions": {"chise": "CHISE IDS (data/chise-sources.json in ids-input)",
                             "zi-tools": f"Yi Bai, ids_lv1.txt, https://github.com/yi-bai/ids at {ZI['revision']} (MIT)"},
            "references": "GlyphWiki glyphs of CHISE entities (ids-input data/custom-outlines.json.gz); user-edited, a check only",
        },
        "forms": styles,
    }
    OUT.write_bytes(gzip.compress(json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), mtime=0))
    for style in ("sans", "serif"):
        kinds = {}
        for row in components:
            kinds.setdefault(row["kind"], [0, 0])[0] += 1
            kinds[row["kind"]][1] += row["text"] in styles[style]
        print(style, " ".join(f"{kind} {done}/{total}" for kind, (total, done) in kinds.items()))
    print(OUT, f"{OUT.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
