# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["fonttools[woff]==4.63.0", "brotli==1.2.0", "skia-pathops==0.9.2"]
# ///
"""Cut a stacked character's glyph into the parts its description names.

A character written ⿱X山 is drawn, in the font, as a set of closed outlines that
do not touch each other, and each of those pieces belongs whole to one element of
the description: none straddles the boundary between X and 山. So the glyph can
be divided along ink the font already draws, with no cut invented. The only
question is which element each piece belongs to.

That is settled by shape. The pieces of a stack are sorted by height and cut into
runs, one per operand, which is every division that keeps the order the stack
reads in; the operands of an overlay, which cover each other, are offered every
way of dealing the pieces out instead. Each candidate group is fingerprinted —
its ink read as coverage over a square grid of its own bounding box — and
compared with the element it would belong to as the font draws that element
alone. Scaling to the box is what makes the comparison possible at all: the font
squashes 山 to stand under something, and the fingerprint undoes exactly that.

The reading whose groups agree best wins, and it has to win by a margin. No
absolute score decides anything: the same element squashed into a stack never
agrees closely with its own standing form, so the floor on agreement is there
only to reject nonsense. A character is written out when that account closes —
every element present, every piece claimed, the groups recognisable, the stack
in the order the description reads. Anything else is skipped and named in the
build output rather than guessed at.

    uv run scripts/build_donor_parts.py [--font PATH] [--check] [--only CHARS]

Writes data/donor-parts.json. `--check` rebuilds in memory and fails if the
committed file differs.

Character shapes: Noto Sans CJK JP 2.004, SIL OFL 1.1 (fonts/OFL-NotoSansCJK.txt),
and Jigmo, Jigmo2, Jigmo3 2025-09-12, CC0-1.0, for the extension blocks Noto
leaves out. Descriptions: BabelStone IDS, Andrew West (data/babelstone-ids.tsv.gz).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

import pathops
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
IDS_TABLE = ROOT / "data" / "babelstone-ids.tsv.gz"
COMPONENTS = ROOT / "data" / "ids-components.tsv"
FONT_LOCK = ROOT / "data" / "unicode-fonts.json"
TARGET = ROOT / "data" / "donor-parts.json"
# The faces to draw from, in order of preference. Noto covers the common
# characters; the Jigmo faces cover the extension blocks Noto leaves out.
FACE_FILES = (
    "NotoSansCJKjp-VF-2.004.ttf",
    "Jigmo-20250912-Jigmo.ttf",
    "Jigmo-20250912-Jigmo2.ttf",
    "Jigmo-20250912-Jigmo3.ttf",
)

# The family this build covers: a vertical stack whose foot is 山.
STACKS = ("⿱", "⿳")
FOOT = "山"

# Ink smaller than this is a rounding artefact of the boolean ops, not a piece.
EPS_AREA = 60.0
# Cells across the square a shape is fingerprinted on, and samples per cell.
GRID = 16
SUBSAMPLE = 4
# Glyph units per flattened curve segment when a shape is sampled.
FLATTEN = 4.0
# A group of pieces has to look at least this much like the element claiming it.
# The floor only rejects nonsense: which reading wins is decided by comparison,
# because the same element squashed into a stack never scores near 1.
MIN_LIKENESS = 0.30
# And the winning reading has to beat the next one by this much.
MIN_MARGIN = 0.015

ARITY = {
    **{operator: 2 for operator in "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯"},
    **{operator: 3 for operator in "⿲⿳"},
    **{operator: 1 for operator in "⿾⿿〾"},
}
# `{42}` is one token, not four characters.
TOKEN = re.compile(r"\{\d+\}|.", re.S)
REGIONS = re.compile(r"\([^)]*\)$")
NUMBERED = re.compile(r"^\{\d+\}")
# The position a repeated element occupies, by its operator and its index.
POSITIONS = {
    "⿰": "左右", "⿱": "上下", "⿲": "左中右", "⿳": "上中下",
}


# --------------------------------------------------------------- the description


def read_table() -> dict[str, list[str]]:
    """Every character's IDS sequences, regions stripped, best first."""
    table: dict[str, list[str]] = {}
    with gzip.open(IDS_TABLE, "rt", encoding="utf-8") as source:
        for line in source:
            if line.startswith("#") or not line.strip():
                continue
            char, sequences = line.rstrip("\n").split("\t")
            table[char] = [REGIONS.sub("", s) for s in sequences.split(" ") if s]
    return table


def read_labels() -> dict[str, str]:
    """`{42}` to the label the page shows for it: `{42} 彐`, or bare where IDS.TXT has none."""
    labels: dict[str, str] = {}
    for line in COMPONENTS.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        fields = (line.split("\t") + ["", ""])[:3]
        number, fragment = fields[0], fields[2].strip()
        labels[number] = f"{number} {fragment}" if fragment else number
    return labels


class Node:
    """One node of a parsed IDS: its own text, its operator, its operands."""

    __slots__ = ("text", "operator", "children")

    def __init__(self, text: str, operator: str | None, children: list["Node"]):
        self.text, self.operator, self.children = text, operator, children

    @property
    def leaf(self) -> bool:
        return self.operator is None


def parse(ids: str) -> Node:
    tokens = TOKEN.findall(ids)
    at = 0

    def read() -> Node:
        nonlocal at
        if at >= len(tokens):
            raise ValueError(f"incomplete IDS: {ids}")
        start, token = at, tokens[at]
        at += 1
        children = [read() for _ in range(ARITY.get(token, 0))]
        return Node("".join(tokens[start:at]), token if children else None, children)

    root = read()
    if at != len(tokens):
        raise ValueError(f"trailing IDS: {ids}")
    return root


def label_of(text: str, labels: dict[str, str]) -> str:
    return labels.get(text, text) if NUMBERED.match(text) else text


def glyph_of(text: str, labels: dict[str, str]) -> str:
    """The single character a leaf stands for, or '' when it names no glyph."""
    if NUMBERED.match(text):
        written = labels.get(text, "").split(" ", 1)
        text = written[1] if len(written) > 1 else ""
    return text if len(text) == 1 else ""


def terminals(node: Node) -> list[Node]:
    if node.leaf:
        return [node]
    out: list[Node] = []
    for child in node.children:
        out.extend(terminals(child))
    return out


def expand(text: str, table: dict[str, list[str]], labels: dict[str, str],
           seen: frozenset[str] = frozenset()) -> list[dict]:
    """A leaf's own description, spelled out to the bottom.

    Stops where there is nothing left to say: a character the table writes as
    itself, a nested description rather than one character, a numbered component,
    or a character the table does not carry.
    """
    if len(text) != 1 or NUMBERED.match(text) or text in seen or text not in table:
        return []
    ids = table[text][0]
    if not any(char in ARITY for char in ids):
        return []
    try:
        root = parse(ids)
    except ValueError:
        return []
    deeper = seen | {text}
    return [
        {
            "leaf": label_of(child.text, labels),
            "children": expand(child.text, table, labels, deeper),
        }
        for child in root.children
    ]


# ------------------------------------------------------------------- the geometry


class Face:
    """One pinned face, with the glyphs it draws on a 1000-unit em."""

    def __init__(self, path: Path, pin: dict):
        self.pin, self.file = pin, pin["file"]
        self.font = TTFont(path)
        self.name = self.font["name"].getDebugName(4) or pin["file"]
        self.version = self.font["name"].getDebugName(5) or ""
        self.scale = 1000 / self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = (self.font.getGlyphSet(location={"wght": 400})
                       if "fvar" in self.font else self.font.getGlyphSet())
        self.outlines: dict[str, list[pathops.Path] | None] = {}
        self.prints: dict[str, tuple[float, ...] | None] = {}

    def draws(self, char: str) -> bool:
        return ord(char) in self.cmap

    def pieces(self, char: str) -> list[pathops.Path] | None:
        """The untouching pieces of a character's glyph, or None if it draws none."""
        if char not in self.outlines:
            path = self.outline(char)
            self.outlines[char] = None if path is None else pieces_of(path)
        return self.outlines[char]

    def outline(self, char: str) -> pathops.Path | None:
        name = self.cmap.get(ord(char))
        if name is None:
            return None
        path = pathops.Path()
        pen = path.getPen(glyphSet=self.glyphs)
        if self.scale != 1:
            pen = TransformPen(pen, (self.scale, 0, 0, self.scale, 0, 0))
        self.glyphs[name].draw(pen)
        # The contours of one element overlap each other (彐's bar crosses its
        # strokes); simplifying merges them, so what is left is one outline per
        # untouching piece.
        path.simplify()
        return path

    def whole(self, char: str) -> tuple[float, ...] | None:
        """The fingerprint of a character as this face draws it on its own."""
        if char not in self.prints:
            pieces = self.pieces(char)
            self.prints[char] = fingerprint(pieces) if pieces else None
        return self.prints[char]


def load_faces(explicit: list[Path], cache: Path, refresh: bool) -> list[Face]:
    """The pinned faces, best first, from given paths, the cache, or their URLs.

    Noto Sans CJK JP draws the common characters of the family; the Jigmo faces
    draw the extension-block ones, which Noto does not cover. A character and
    the elements it is recognised by always come from the same face, so no
    entry mixes two drawings of one shape.
    """
    pins = {f["file"]: f for f in json.loads(FONT_LOCK.read_text(encoding="utf-8"))["fonts"]}
    given = {}
    for path in explicit:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        match = next((f for f in pins.values() if f["sha256"] == digest), None)
        if match is None:
            raise SystemExit(f"{path} is not one of the faces pinned in {FONT_LOCK.name}.")
        given[match["file"]] = path
    faces = []
    for name in FACE_FILES:
        pin = pins[name]
        path = given.get(name) or find_face(pin, cache, refresh)
        faces.append(Face(path, pin))
    return faces


def find_face(pin: dict, cache: Path, refresh: bool) -> Path:
    """A pinned face on disk, fetched if it is not there yet."""

    def good(path: Path) -> bool:
        return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == pin["sha256"]

    # The upstream file names differ from the pinned ones: the Noto release ships
    # the variable font unversioned, and the Jigmo faces arrive inside one zip.
    plain = pin["file"].split("-")[-1] if pin["file"].startswith("Jigmo") else "NotoSansCJKjp-VF.ttf"
    for candidate in [cache / pin["file"], cache / plain,
                      Path.home() / ".cache/ids-input/fontsrc" / plain,
                      Path.home() / ".cache/ids-input-fonts" / plain]:
        if not refresh and good(candidate):
            return candidate
    target = cache / pin["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(pin["url"], headers={"User-Agent": "ids-input build"})
    with urllib.request.urlopen(request, timeout=600) as response:
        raw = response.read()
    if pin["url"].endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            member = next(n for n in archive.namelist() if n.endswith(plain))
            raw = archive.read(member)
    target.write_bytes(raw)
    if not good(target):
        raise SystemExit(f"{target} does not match the pinned SHA-256 of {pin['url']}.")
    return target


def union_of(paths: list[pathops.Path]) -> pathops.Path:
    builder = pathops.OpBuilder()
    for path in paths:
        builder.add(path, pathops.PathOp.UNION)
    out = builder.resolve()
    out.simplify()
    return out


def clip(path: pathops.Path, box: pathops.Path) -> pathops.Path:
    out = pathops.op(path, box, pathops.PathOp.INTERSECTION)
    out.simplify()
    return out


def filled(contour) -> pathops.Path:
    """One contour on its own, as a solid shape."""
    path = pathops.Path()
    contour.draw(path.getPen())
    return path


def inside(small: pathops.Path, large: pathops.Path) -> bool:
    """Does one contour lie within another? Only asked of shapes that cannot cross.

    The glyph is simplified first, which leaves its contours either apart or
    nested, never half over each other, so a shape lies inside another exactly
    when their common ink is the whole of it.
    """
    common = pathops.op(small, large, pathops.PathOp.INTERSECTION)
    common.simplify()
    return abs(common.area) >= 0.98 * abs(small.area)


def pieces_of(path: pathops.Path) -> list[pathops.Path]:
    """The untouching pieces of an outline, counters kept open.

    A simplified outline nests: an outer boundary, the counters cut out of it,
    and — in 回, or in Jigmo's 母 — a further island drawn inside a counter,
    which is a piece in its own right and must not be swallowed by the shape
    around it. So the contours are read by how deep they sit. A contour nothing
    encloses, or one enclosed an even number of times, is a piece's boundary;
    what it gives up is only the contours immediately inside it.
    """
    contours = [c for c in path.contours if abs(c.area) >= EPS_AREA]
    shapes = [filled(c) for c in contours]
    depth = [sum(1 for j, other in enumerate(shapes) if j != i and inside(shape, other))
             for i, shape in enumerate(shapes)]
    found: list[pathops.Path] = []
    for i, shape in enumerate(shapes):
        if depth[i] % 2:
            continue
        counters = [other for j, other in enumerate(shapes)
                    if depth[j] == depth[i] + 1 and inside(other, shape)]
        piece = shape
        if counters:
            piece = pathops.op(shape, union_of(counters), pathops.PathOp.DIFFERENCE)
            piece.simplify()
        if abs(piece.area) >= EPS_AREA:
            found.append(piece)
    return sorted(found, key=piece_order)


def piece_order(path: pathops.Path) -> tuple:
    """A total order on pieces: where it sits, how big it is, what it draws.

    Two pieces that share a corner must still sort the same way every run, so
    the key falls through to the whole box and the area rather than stopping at
    the top-left corner.
    """
    return (*(round(value, 3) for value in path.bounds), round(abs(path.area), 3),
            [command for contour in commands_of(path) for command in contour])


def segments_of(path: pathops.Path) -> list[list[tuple[str, tuple]]]:
    """A path as contours of (op, points) segments, each ending on the curve."""
    contours: list[list[tuple[str, tuple]]] = []
    current: list[tuple[str, tuple]] | None = None
    start: tuple | None = None
    for verb, points in path.segments:
        if verb == "moveTo":
            current = []
            contours.append(current)
            start = points[0]
        elif current is None:
            continue
        elif verb == "lineTo":
            current.append(("L", (points[0],)))
        elif verb == "curveTo":
            current.append(("C", tuple(points)))
        elif verb == "qCurveTo":
            # A TrueType run of control points implies an on-curve point between each pair.
            run = list(points)
            if len(run) == 2:
                current.append(("Q", (run[0], run[1])))
            else:
                for index in range(len(run) - 1):
                    control, following = run[index], run[index + 1]
                    on = following if index == len(run) - 2 else (
                        (control[0] + following[0]) / 2, (control[1] + following[1]) / 2)
                    current.append(("Q", (control, on)))
        elif verb in ("closePath", "endPath") and start is not None:
            if current and current[-1][1][-1] != start:
                current.append(("L", (start,)))
    return [c for c in contours if len(c) > 1]


def commands_of(path: pathops.Path) -> list[list[list]]:
    """A piece as a contour list of commands, in one canonical rotation per contour.

    Every contour is written from its leftmost point, the lowest of them where
    several share a column, so the same outline always serialises the same way
    however the boolean ops happened to walk it.
    """
    contours = []
    for segments in segments_of(path):
        ends = [segment[1][-1] for segment in segments]
        pivot = min(range(len(ends)), key=lambda i: (round(ends[i][0], 3), round(ends[i][1], 3)))
        ordered = segments[pivot + 1:] + segments[: pivot + 1]
        commands: list[list] = [["M", *point(ends[pivot])]]
        for op, points in ordered:
            commands.append([op, *[value for p in points for value in point(p)]])
        # The closing segment lands back on the start, which "Z" already says.
        if commands[-1][0] == "L" and commands[-1][1:] == commands[0][1:]:
            commands.pop()
        commands.append(["Z"])
        if len(commands) > 2:
            contours.append(commands)
    # The whole contour, not just where it starts: two contours can start together.
    contours.sort()
    return contours


def point(value) -> list:
    """Glyph units, rounded to a thousandth and kept integral where it is."""
    out = []
    for raw in value:
        number = round(float(raw), 3)
        out.append(int(number) if number == int(number) else number)
    return out


def rings_of(path: pathops.Path) -> list[list[tuple[float, float]]]:
    """A piece flattened to closed polylines, for sampling."""
    rings = []
    for segments in segments_of(path):
        here = segments[-1][1][-1]
        ring = [here]
        for op, points in segments:
            if op == "L":
                here = points[0]
                ring.append(here)
            else:
                control = [here, *points]
                length = sum(
                    abs(control[i + 1][0] - control[i][0]) + abs(control[i + 1][1] - control[i][1])
                    for i in range(len(control) - 1))
                steps = max(2, int(length / FLATTEN) + 1)
                for step in range(1, steps + 1):
                    t = step / steps
                    working = list(control)
                    while len(working) > 1:
                        working = [
                            (working[i][0] + (working[i + 1][0] - working[i][0]) * t,
                             working[i][1] + (working[i + 1][1] - working[i][1]) * t)
                            for i in range(len(working) - 1)]
                    ring.append(working[0])
                here = points[-1]
        if len(ring) > 3:
            rings.append(ring)
    return rings


def fingerprint(paths: list[pathops.Path]) -> tuple[float, ...]:
    """How much ink sits in each cell of a square grid over the shape's own box.

    Scaling to the box is what lets 山 inside a composite be recognised as 山:
    the font squashes it to fit, and the fingerprint undoes exactly that. Cells
    hold a coverage fraction rather than a yes or no, because the same element
    is drawn with heavier strokes when it is squashed, and a coverage reading
    survives that where a silhouette does not.
    """
    minx = min(p.bounds[0] for p in paths)
    miny = min(p.bounds[1] for p in paths)
    maxx = max(p.bounds[2] for p in paths)
    maxy = max(p.bounds[3] for p in paths)
    width, height = max(maxx - minx, 1e-6), max(maxy - miny, 1e-6)
    rings = [ring for path in paths for ring in rings_of(path)]
    side = GRID * SUBSAMPLE
    cells = [0.0] * (GRID * GRID)
    for row in range(side):
        y = miny + height * (row + 0.5) / side
        crossings = []
        for ring in rings:
            for index in range(len(ring) - 1):
                (x0, y0), (x1, y1) = ring[index], ring[index + 1]
                if (y0 > y) != (y1 > y):
                    crossings.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
        crossings.sort()
        if not crossings:
            continue
        for column in range(side):
            x = minx + width * (column + 0.5) / side
            if sum(1 for crossing in crossings if crossing < x) % 2:
                cells[(row // SUBSAMPLE) * GRID + column // SUBSAMPLE] += 1.0
    return tuple(cell / (SUBSAMPLE * SUBSAMPLE) for cell in cells)


def likeness(left: tuple[float, ...], right: tuple[float, ...]) -> float:
    """Agreement between two fingerprints, 1 for the same ink everywhere."""
    shared = sum(min(a, b) for a, b in zip(left, right))
    total = sum(max(a, b) for a, b in zip(left, right))
    return shared / total if total else 0.0


# ------------------------------------------------------------------ the labelling


class Skipped(Exception):
    """This character cannot be accounted for; say why and move on."""


def count(number: int, thing: str) -> str:
    """`1 piece`, `2 pieces`: a reason a reader will read."""
    return f"{number} {thing}" + ("" if number == 1 else "s")


def runs(pieces: list[int], count: int) -> list[list[list[int]]]:
    """Every way to cut an ordered list of pieces into `count` non-empty runs."""
    if count == 1:
        return [[list(pieces)]]
    out = []
    for cut in range(1, len(pieces) - count + 2):
        for rest in runs(pieces[cut:], count - 1):
            out.append([list(pieces[:cut])] + rest)
    return out


def spreads(pieces: list[int], count: int) -> list[list[list[int]]]:
    """Every way to deal an unordered list of pieces into `count` non-empty groups."""
    if count == 1:
        return [[list(pieces)]]
    out = []
    for mask in range(1, 1 << len(pieces)):
        head = [p for index, p in enumerate(pieces) if mask >> index & 1]
        tail = [p for index, p in enumerate(pieces) if not mask >> index & 1]
        if len(tail) < count - 1:
            continue
        for rest in spreads(tail, count - 1):
            out.append([head] + rest)
    return out


class Cutter:
    """Hands a glyph's untouching pieces to the elements of its description.

    Nothing here invents a boundary. The pieces are the font's own, and the only
    question asked of each node of the description is which pieces fall on which
    side of it. For a stack that question has an order to it — the operands run
    top to bottom — so the pieces are sorted by height and the only candidates
    are the cuts that keep that order. For an overlay, where the operands cover
    each other, every way of dealing the pieces out is a candidate.

    A candidate wins on agreement: each group of pieces is fingerprinted and
    compared with the element it would belong to, as the font draws that element
    alone. The winner has to beat the runner-up by a margin, and no group may
    fall below a floor of recognisability; otherwise the character is skipped
    rather than guessed at.
    """

    def __init__(self, pieces: list[pathops.Path], labels: dict[str, str], faces: list[Face]):
        self.pieces, self.labels, self.faces = pieces, labels, faces
        self.prints: dict[tuple[int, ...], tuple[float, ...]] = {}
        self.marks: list[float] = []

    def group_print(self, group: list[int]) -> tuple[float, ...]:
        key = tuple(sorted(group))
        if key not in self.prints:
            self.prints[key] = fingerprint([self.pieces[index] for index in key])
        return self.prints[key]

    def agreement(self, node: Node, group: list[int]) -> tuple[float, bool] | None:
        """How much a group of pieces looks like the element it is offered to.

        Also whether that reading came from the character's own face. None where
        there is nothing to compare against at all: a nested description no
        pinned face has a glyph for. Its operands are judged a level down.
        """
        glyph = glyph_of(node.text, self.labels)
        found = self.template(glyph) if glyph else None
        if found is None:
            return None
        shape, own = found
        return likeness(self.group_print(group), shape), own

    def template(self, glyph: str) -> tuple[tuple[float, ...], bool] | None:
        """An element as it is drawn alone, from the first pinned face that has it.

        The character's own face comes first. Where it does not carry the element
        — the Jigmo faces cover the extension blocks but not 山 — another pinned
        face supplies the drawing, and the reading is marked as coming from
        elsewhere. The fingerprint reads where ink sits in a normalised box,
        which is what two faces of the same character agree about; how much they
        agree is not a thing to hold a face to, so a borrowed drawing ranks the
        readings without being held to the floor.
        """
        for index, face in enumerate(self.faces):
            shape = face.whole(glyph)
            if shape is not None:
                return shape, index == 0
        return None

    def best(self, node: Node, group: list[int]) -> list[list[int]]:
        """The best way to deal a node's pieces out to its operands."""
        arity = len(node.children)
        if node.operator in ("⿱", "⿳"):
            # Where two pieces sit at the same height, the leftmost reads first.
            order = sorted(group, key=lambda i: (-sum(self.pieces[i].bounds[1::2]),
                                                 self.pieces[i].bounds[0]))
            candidates = runs(order, arity)
        elif node.operator in ("⿰", "⿲"):
            order = sorted(group, key=lambda i: (sum(self.pieces[i].bounds[0::2]),
                                                 -self.pieces[i].bounds[3]))
            candidates = runs(order, arity)
        elif arity ** len(group) <= 4096:
            candidates = spreads(group, arity)
        else:
            raise Skipped(f"{node.text} covers {count(len(group), 'piece')}, "
                          f"too many to deal out")
        if not candidates:
            raise Skipped(f"{node.text} has fewer pieces than operands")
        unknown = [child.text for child in node.children
                   if self.agreement(child, group) is None]
        if len(unknown) > 1:
            raise Skipped(f"two operands of {node.text} have no glyph to be recognised by: "
                          f"{', '.join(unknown)}")
        # The floor is held against the elements the character's own face also
        # draws, because how closely two faces agree about one element is not a
        # thing to hold a face to. Where the character's own face draws none of
        # them — a Jigmo character standing on 山 — the floor falls to all of
        # them instead. What is recorded is the weakest reading of all of them,
        # borrowed or not, which is the number a reader should be judging.
        scored = []
        for option in candidates:
            marks = [self.agreement(child, part)
                     for child, part in zip(node.children, option)]
            known = [mark for mark in marks if mark is not None]
            if not known:
                raise Skipped(f"no glyph to recognise the operands of {node.text} by")
            held = [mark for mark, own in known if own] or [mark for mark, _ in known]
            scored.append((sum(mark for mark, _ in known) / len(known), min(held),
                           min(mark for mark, _ in known), option))
        scored.sort(key=lambda row: -row[0])
        total, lowest, weakest, option = scored[0]
        if lowest < MIN_LIKENESS:
            raise Skipped(
                f"a group of pieces does not look like its element in {node.text} "
                f"({lowest:.2f})")
        if len(scored) > 1 and total - scored[1][0] < MIN_MARGIN:
            raise Skipped(f"two readings of {node.text} fit the pieces equally well")
        self.marks.append(weakest)
        return option

    def cut(self, node: Node, group: list[int]) -> list[tuple[Node, list[int]]]:
        """Every leaf of a description with the pieces that belong to it."""
        if not group:
            raise Skipped(f"no pieces left for {node.text}")
        if node.leaf:
            return [(node, group)]
        out: list[tuple[Node, list[int]]] = []
        for child, part in zip(node.children, self.best(node, group)):
            out.extend(self.cut(child, part))
        return out


def decompose(char: str, ids: str, table, labels, faces: list[Face]) -> dict:
    """One character's entry, or Skipped with the reason it could not be closed.

    `faces` is the pinned faces with the one that draws this character first.
    """
    root = parse(ids)
    face = faces[0]
    pieces = face.pieces(char)
    if not pieces:
        raise Skipped("the glyph draws no ink")
    # The pieces are cut one outer contour at a time, so a glyph that drew a
    # piece inside another piece's outline would lose the inner one. None of
    # this family does, and a character that did would be a wrong answer rather
    # than a missing one, so the division is weighed against the whole glyph
    # before anything is said about it.
    drawn, divided = face.outline(char), union_of(pieces)
    if abs(abs(drawn.area) - abs(divided.area)) > 0.002 * max(abs(drawn.area), 1):
        raise Skipped("the pieces do not add up to the glyph the font draws")
    if len(pieces) < len(terminals(root)):
        raise Skipped(f"the glyph draws {count(len(pieces), 'piece')} for "
                      f"{count(len(terminals(root)), 'element')}")

    cutter = Cutter(pieces, labels, faces)
    cut = cutter.cut(root, list(range(len(pieces))))

    names = [label_of(node.text, labels) for node, _ in cut]
    repeated = {name for name in names if names.count(name) > 1}
    parts = []
    for (node, group), name in zip(cut, names):
        leaf = name + position_of(root, node) if name in repeated else name
        for index in sorted(group, key=lambda i: (round(pieces[i].bounds[0], 3),
                                                  round(pieces[i].bounds[1], 3))):
            parts.append({"leaf": leaf, "path": commands_of(pieces[index])})
    return {
        "char": char,
        "ids": ids,
        "face": face.name,
        # The weakest agreement any element of this character was read at, and
        # whether its own face drew the elements it was recognised by. A row
        # drawn by a face that has none of its elements is recognised against
        # another, and reads lower for that; the floor is not held against those.
        "likeness": round(min(cutter.marks), 3) if cutter.marks else None,
        "ownFace": all(face.whole(glyph_of(node.text, labels)) is not None
                       for node, _ in cut if glyph_of(node.text, labels)),
        "parts": parts,
        "first": [label_of(child.text, labels) for child in root.children],
        "terminal": names,
        "pieces": [commands_of(piece) for piece in pieces],
        "recursive": [
            {"leaf": name, "children": expand(node.text, table, labels)}
            for (node, _), name in zip(cut, names)
        ],
    }


def position_of(root: Node, leaf: Node) -> str:
    """Where a repeated element sits, so two 山 of one description are told apart."""

    def walk(node: Node) -> str | None:
        if node is leaf:
            return ""
        for index, child in enumerate(node.children):
            found = walk(child)
            if found is None:
                continue
            names = POSITIONS.get(node.operator or "")
            return (names[index] if names and index < len(names) else str(index + 1)) + found
        return None

    return walk(root) or ""


# ---------------------------------------------------------------------- the build


def selection(table: dict[str, list[str]]) -> list[tuple[str, str]]:
    """Every character the table describes as a vertical stack standing on 山."""
    found = []
    for char, sequences in table.items():
        ids = sequences[0]
        try:
            root = parse(ids)
        except ValueError:
            continue
        if root.operator in STACKS and root.children[-1].text == FOOT:
            found.append((char, ids))
    return sorted(found)


def build(faces: list[Face], only: str | None = None, report=None) -> dict:
    table, labels = read_table(), read_labels()
    chosen = selection(table)
    if only:
        chosen = [(char, table[char][0]) for char in dict.fromkeys(only) if char in table]

    entries, skipped = [], []
    for char, ids in chosen:
        drawn = [face for face in faces if face.draws(char)]
        if not drawn:
            skipped.append({"char": char, "ids": ids, "reason": "no pinned face draws it"})
        else:
            reasons = []
            for face in drawn:
                try:
                    entries.append(decompose(
                        char, ids, table, labels, [face, *(f for f in faces if f is not face)]))
                    break
                except Skipped as reason:
                    reasons.append(f"{face.name}: {reason}")
                except (ValueError, KeyError) as reason:
                    reasons.append(f"{face.name}: unreadable description: {reason}")
            else:
                skipped.append({"char": char, "ids": ids, "reason": "; ".join(reasons)})
        if report:
            report(char, entries, skipped)
    return {
        "format": "ids-input/donor-parts",
        "version": 1,
        "faces": [{"name": face.name, "version": face.version,
                   "file": face.file, "sha256": face.pin["sha256"]} for face in faces],
        "candidates": len(chosen),
        "entries": entries,
        "skipped": skipped,
    }


def serialise(document: dict) -> str:
    return json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, action="append", default=[],
                        help="a pinned face already on disk; repeat for several")
    parser.add_argument("--cache", type=Path, default=ROOT / "cache", help="where faces are kept")
    parser.add_argument("--refresh", action="store_true", help="fetch the faces again")
    parser.add_argument("--check", action="store_true",
                        help="rebuild in memory and fail if the committed file differs")
    parser.add_argument("--only", help="build just these characters")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    if args.check and args.only:
        raise SystemExit("--check reads the whole file; it has nothing to say about --only.")

    faces = load_faces(args.font, args.cache, args.refresh)

    def report(char, entries, skipped):
        if not args.quiet:
            print(f"\r{len(entries)} written, {len(skipped)} skipped … {char}",
                  end="", file=sys.stderr, flush=True)

    document = build(faces, args.only, report)
    if not args.quiet:
        print("\r" + " " * 48, end="\r", file=sys.stderr)
    output = serialise(document)

    if args.check:
        if not TARGET.exists():
            raise SystemExit(f"{TARGET.relative_to(ROOT)} is missing; run scripts/build_donor_parts.py")
        if TARGET.read_text(encoding="utf-8") != output:
            raise SystemExit(
                f"{TARGET.relative_to(ROOT)} is stale; run scripts/build_donor_parts.py")
        print(f"{TARGET.relative_to(ROOT)} is current: "
              f"{len(document['entries'])} of {document['candidates']} characters.")
        return 0

    TARGET.write_text(output, encoding="utf-8")
    print(f"{TARGET.relative_to(ROOT)}: {len(document['entries'])} of {document['candidates']} "
          f"characters, {len(output):,} bytes")
    if document["skipped"]:
        print(f"\nskipped {len(document['skipped'])}:")
        grouped: dict[str, list[str]] = {}
        for row in document["skipped"]:
            grouped.setdefault(row["reason"], []).append(row["char"])
        for reason, chars in sorted(grouped.items(), key=lambda item: -len(item[1])):
            print(f"  {len(chars):3d}  {reason}")
            print(f"       {''.join(chars)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
