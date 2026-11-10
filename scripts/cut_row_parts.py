# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = ["fonttools==4.63.0", "skia-pathops==0.9.2"]
# ///
"""Cut the left operand of a row character and write the piece outlines.

    uv run scripts/cut_row_parts.py --chars 祣禤䃼 --font PATH [--font PATH ...]

Reads the descriptions from data/babelstone-ids.tsv.gz, cuts each character's row at its
own seam, and prints `{char: {ids, left, right, pieces}}` with each group's path commands.
See docs/part-cutting.md.
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_donor_parts as cut  # noqa: E402

ALLOGRAPHS = {"示": ("示", "礻", "𱍐"), "礻": ("礻", "示", "𱍐")}


def read_ids(char: str) -> str | None:
    with gzip.open(cut.IDS_TABLE, "rt", encoding="utf-8") as source:
        for line in source:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 2 or fields[0] != char:
                continue
            for description in fields[1].split(" "):
                text = re.sub(r"\([^)]*\)$", "", description)
                if text.startswith("⿰"):
                    return text
    corpus = cut.ROOT / "data" / "ids-corpus.json.gz"
    if not corpus.exists():
        return None
    with gzip.open(corpus, "rt", encoding="utf-8") as source:
        document = json.load(source)
    subject = f"ucs:{ord(char):X}"
    for row in document["descriptions"]["rows"]:
        if row[0] == subject and row[1].startswith("⿰"):
            return row[1]
    return None


def enclosed(index: int, group: list[int], pieces) -> bool:
    if not group:
        return False
    x0, x1 = pieces[index].bounds[0], pieces[index].bounds[2]
    span = max(x1 - x0, 1.0)
    left = min(pieces[i].bounds[0] for i in group)
    right = max(pieces[i].bounds[2] for i in group)
    overlap = max(0.0, min(x1, right) - max(x0, left))
    return overlap / span >= 0.8


def close(candidate, pieces):
    groups = [list(group) for group in candidate]
    for _ in range(6):
        moved = False
        for at in range(len(groups) - 1):
            left, right = groups[at], groups[at + 1]
            if len(right) > 1:
                for i in list(right):
                    if enclosed(i, left, pieces):
                        right.remove(i)
                        left.append(i)
                        moved = True
            if len(left) > 1:
                for i in list(left):
                    if enclosed(i, right, pieces) and len(right) == 1:
                        left.remove(i)
                        right.append(i)
                        moved = True
        if not moved:
            break
    return [group for group in groups if group]


def rect_path(x0: float, y0: float, x1: float, y1: float):
    path = cut.pathops.Path()
    pen = path.getPen()
    pen.moveTo((x0, y0))
    pen.lineTo((x1, y0))
    pen.lineTo((x1, y1))
    pen.lineTo((x0, y1))
    pen.closePath()
    return path


def bounds_of(pieces) -> tuple[float, float, float, float]:
    return (min(p.bounds[0] for p in pieces), min(p.bounds[1] for p in pieces),
            max(p.bounds[2] for p in pieces), max(p.bounds[3] for p in pieces))


def seam_ink(piece, x: float) -> int:
    crossings = 0
    for ring in cut.rings_of(piece):
        for index in range(len(ring) - 1):
            (ax, ay), (bx, by) = ring[index], ring[index + 1]
            if (ax > x) != (bx > x):
                crossings += 1
    return crossings


def split_straddlers(pieces):
    """Clip a piece that spans the row seam, and say where the cut fell.

    A piece that reaches into both columns is never dealt whole to one side. It is
    intersected with the left and right half-planes at the thinnest vertical section
    inside the seam window, so the invented boundary lands on the stroke junction.
    Among equally thin sections the cut takes the rightmost, since the leftmost
    minimum already amputates the left operand's top.
    """
    x0, y0, x1, y1 = bounds_of(pieces)
    width = max(x1 - x0, 1.0)
    lo, hi = x0 + 0.32 * width, x0 + 0.48 * width
    out, cuts = [], []
    for piece in pieces:
        bx0, by0, bx1, by1 = piece.bounds
        spans = (bx0 - x0) / width < 0.26 and (bx1 - x0) / width > 0.54
        if spans:
            best = None
            for step in range(16):
                x = lo + (hi - lo) * step / 15
                ink = seam_ink(piece, x)
                if best is None or ink <= best[0]:
                    best = (ink, x)
            x_cut = best[1] if best else (lo + hi) / 2
            left = cut.clip(piece, rect_path(x0 - 2, by0 - 2, x_cut, by1 + 2))
            right = cut.clip(piece, rect_path(x_cut, by0 - 2, bx1 + 2, by1 + 2))
            for half in cut.pieces_of(left) + cut.pieces_of(right):
                if abs(half.area) > 1.0:
                    out.append(half)
            cuts.append(x_cut)
        else:
            out.append(piece)
    return out, cuts


def clip_left_at_middle(pieces, left, right):
    """Keep the left group on its side of the glyph's middle vertical line.

    A left operand is drawn within its column; a piece assigned to it that reaches
    past the middle is clipped there, and the remainder joins the right group. The
    clip is recorded as approximate like the seam split.
    """
    x0, _, x1, _ = bounds_of(pieces)
    middle = (x0 + x1) / 2
    moved, cuts = [], []
    # Routing is gated on the *current* right contents, not the entry-time contents,
    # because the loop itself appends new Path remainders.
    for index in list(left):
        if not isinstance(index, int):
            continue
        piece = pieces[index]
        if piece.bounds[2] <= middle:
            continue
        left.remove(index)
        kept = cut.clip(piece, rect_path(piece.bounds[0] - 2, piece.bounds[1] - 2, middle, piece.bounds[3] + 2))
        rest = cut.clip(piece, rect_path(middle, piece.bounds[1] - 2, piece.bounds[2] + 2, piece.bounds[3] + 2))
        for half in cut.pieces_of(kept):
            if abs(half.area) > 1.0:
                moved.append(half)
        for half in cut.pieces_of(rest):
            if abs(half.area) > 1.0:
                right.append(half)
        cuts.append(middle)
    # Kept halves become new indexed pieces so every entry stays an int;
    # the remainders already appended as Path objects are re-routed to
    # their indices here.
    if moved:
        base = len(pieces)
        pieces.extend(moved)
        left.extend(range(base, base + len(moved)))
    if any(not isinstance(entry, int) for entry in right):
        routed = []
        for entry in right:
            if isinstance(entry, int):
                routed.append(entry)
            else:
                base = len(pieces)
                pieces.append(entry)
                routed.append(base)
        right[:] = routed
    return cuts


def candidates(pieces, arity):
    order = list(range(len(pieces)))
    keys = (
        lambda i: (round(pieces[i].bounds[0], 3), round(pieces[i].bounds[2], 3)),
        lambda i: (round(pieces[i].bounds[0] + pieces[i].bounds[2], 3), round(pieces[i].bounds[2], 3)),
        lambda i: (round(pieces[i].bounds[2], 3), round(pieces[i].bounds[0], 3)),
    )
    found = []
    for key in keys:
        found.extend(cut.runs(sorted(order, key=key), arity))
    x0 = min(pieces[i].bounds[0] for i in order)
    width = max(pieces[i].bounds[2] for i in order) - x0
    for x in [pieces[i].bounds[0] for i in order] + [pieces[i].bounds[2] for i in order]:
        if not 0.22 <= (x - x0) / max(width, 1.0) <= 0.58:
            continue
        left, right = [], []
        for i in order:
            a, b = pieces[i].bounds[0], pieces[i].bounds[2]
            if max(0.0, min(b, x) - a) / max(b - a, 1.0) >= 0.5:
                left.append(i)
            else:
                right.append(i)
        if left and right:
            found.append([left, right])
    unique, seen = [], set()
    for candidate in found:
        key = tuple(tuple(sorted(group)) for group in candidate)
        if key not in seen and len(candidate) == arity:
            seen.add(key)
            unique.append(candidate)
    return unique


def template(face, texts, faces):
    for text in texts:
        if not text or len(text) != 1:
            continue
        for candidate in [face] + [f for f in faces if f is not face]:
            shape = candidate.whole(text)
            if shape is not None:
                return shape
    return None


def leaf_template(node, face, faces, labels):
    """Fingerprint of a leaf operand, trying the 示 allographs for 示/礻."""
    glyph = cut.glyph_of(node.text, labels)
    texts = ALLOGRAPHS.get(node.text, (glyph,) if glyph else ())
    return template(face, texts, faces)


def row_score(node, pieces, cutter, face, faces, labels, gated):
    """Best (score, groups) for a row node, scoring each operand at a leaf.

    A nested operand is scored by its own best division (a row recursively,
    a stack by height runs), so the ranking at every level sees leaf
    agreements rather than a flat fallback. The middle-line gate applies at
    every row against that row's own middle.
    """
    x0 = min(p.bounds[0] for p in pieces)
    width = max(p.bounds[2] for p in pieces) - x0
    middle = x0 + width / 2
    limit = middle + 0.025 * width
    arity = len(node.children)
    best = None
    for candidate in candidates(pieces, arity):
        groups = close(candidate, pieces)
        if len(groups) != arity:
            continue
        if gated and arity >= 2 and any(pieces[i].bounds[2] > limit for i in groups[0]):
            continue
        vals = []
        for child, grp in zip(node.children, groups):
            tiles = [pieces[i] for i in grp]
            if child.leaf:
                shape = leaf_template(child, face, faces, labels)
                if shape is not None:
                    vals.append(cut.likeness(cut.fingerprint(tiles), shape))
            elif child.operator in ("⿰", "⿲"):
                sub = row_score(child, tiles, cut.Cutter(tiles, labels, faces), face, faces, labels, gated)
                if sub is not None:
                    vals.append(sub[0])
            elif child.operator in ("⿱", "⿳"):
                order = sorted(range(len(tiles)), key=lambda i: (-sum(tiles[i].bounds[1::2]), tiles[i].bounds[0]))
                best_stack = None
                for option in cut.runs(order, len(child.children)):
                    sv = []
                    for grand, part in zip(child.children, option):
                        gtiles = [tiles[i] for i in part]
                        if grand.leaf:
                            shape = leaf_template(grand, face, faces, labels)
                            if shape is not None:
                                sv.append(cut.likeness(cut.fingerprint(gtiles), shape))
                        elif grand.operator in ("⿰", "⿲"):
                            sub = row_score(grand, gtiles, cut.Cutter(gtiles, labels, faces), face, faces, labels, gated)
                            if sub is not None:
                                sv.append(sub[0])
                    if sv:
                        score = sum(sv) / len(sv)
                        if best_stack is None or score > best_stack:
                            best_stack = score
                if best_stack is not None:
                    vals.append(best_stack)
        if not vals:
            continue
        if all(child.leaf for child in node.children):
            score = 0.6 * vals[0] + 0.25 * vals[1] if len(vals) > 1 else 0.6 * vals[0]
        else:
            score = 0.6 * vals[0] + 0.15 * (sum(vals[1:]) / max(len(vals) - 1, 1)) if len(vals) > 1 else 0.6 * vals[0]
        # A Shi left operand never stands alone as a single stroke: penalize tiny
        # left groups so right-side strokes cannot hide in the left group.
        if str(node.children[0].text) in ("示", "礻", "𱍐"):
            total = sum(abs(p.area) for p in pieces)
            left_frac = sum(abs(pieces[i].area) for i in groups[0]) / total if total else 1.0
            if left_frac < 0.15:
                score *= 0.3
        if best is None or score > best[0] + 0.002:
            best = (score, groups)
        elif score >= best[0] - 0.002 and len(node.children) >= 2:
            # Prefer the candidate with fewer pieces (left side first).
            if len(groups[0]) < len(best[1][0]):
                best = (score, groups)
    return best


def split_row(node, pieces, cutter, face, faces, labels):
    """Deal a row's pieces to its operands, returning groups or None."""
    return row_score(node, pieces, cutter, face, faces, labels, True) or row_score(node, pieces, cutter, face, faces, labels, False)


def find_shi(node, pieces, cutter, face, faces, labels):
    """The piece indices, in `pieces` coordinates, that read as 示/礻."""
    if node.leaf:
        return list(range(len(pieces))) if node.text in ("示", "礻", "𱍐") else []
    if node.operator in ("⿰", "⿲"):
        best = split_row(node, pieces, cutter, face, faces, labels)
        if best is None:
            return []
        for child, grp in zip(node.children, best[1]):
            if not child.leaf:
                sub = [pieces[i] for i in grp]
                found = find_shi(child, sub, cut.Cutter(sub, labels, faces), face, faces, labels)
                if found:
                    return [grp[i] for i in found]
            elif child.text in ("示", "礻", "𱍐"):
                return list(grp)
        return []
    arity = len(node.children)
    order = sorted(range(len(pieces)), key=lambda i: (-sum(pieces[i].bounds[1::2]), pieces[i].bounds[0]))
    best = None
    for option in cut.runs(order, arity):
        sv = []
        for grand, part in zip(node.children, option):
            gtiles = [pieces[i] for i in part]
            if grand.leaf:
                shape = leaf_template(grand, face, faces, labels)
                if shape is not None:
                    sv.append(cut.likeness(cut.fingerprint(gtiles), shape))
            elif grand.operator in ("⿰", "⿲"):
                sub = row_score(grand, gtiles, cut.Cutter(gtiles, labels, faces), face, faces, labels, True)
                if sub is not None:
                    sv.append(sub[0])
        if sv:
            score = sum(sv) / len(sv)
            if best is None or score > best[0]:
                best = (score, option)
    if best is None:
        return []
    for child, part in zip(node.children, best[1]):
        if child.leaf:
            if child.text in ("示", "礻", "𱍐"):
                return list(part)
        else:
            sub = [pieces[i] for i in part]
            found = find_shi(child, sub, cut.Cutter(sub, labels, faces), face, faces, labels)
            if found:
                return [part[i] for i in found]
    return []



def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chars", required=True)
    parser.add_argument("--font", type=Path, action="append", required=True)
    args = parser.parse_args()

    labels = cut.read_labels()
    faces = [cut.Face(path, {"file": path.name}) for path in args.font]
    out = {}
    for char in args.chars:
        ids = read_ids(char)
        if not ids:
            out[char] = {"error": "no row description"}
            continue
        face = next((f for f in faces if f.draws(char)), None)
        if face is None:
            out[char] = {"error": "no glyph"}
            continue
        try:
            root = cut.parse(ids)
        except ValueError:
            out[char] = {"error": "unparsable description"}
            continue
        if root.operator not in ("⿰", "⿲", "⿳", "⿱"):
            out[char] = {"error": "not a row"}
            continue
        pieces = face.pieces(char)
        if not pieces or len(pieces) < 2:
            out[char] = {"error": "fewer than two pieces"}
            continue
        pieces, cuts_x = split_straddlers(pieces)
        cutter = cut.Cutter(pieces, labels, faces)
        shi = find_shi(root, pieces, cutter, face, faces, labels)
        if not shi:
            out[char] = {"error": "no split"}
            continue
        others = [i for i in range(len(pieces)) if i not in shi]
        if any(grand.leaf and grand.text in ("示", "礻", "𱍐") for grand in getattr(root, "children", [])):
            middle_cuts = clip_left_at_middle(pieces, list(shi), others)
        else:
            middle_cuts = []
        out[char] = {
            "ids": ids,
            "left": cut.commands_of(cut.union_of([pieces[i] for i in shi])),
            "right": cut.commands_of(cut.union_of([pieces[i] for i in others])),
            "shi": sorted(shi),
        }
        if cuts_x or middle_cuts:
            out[char]["approximate"] = True
            out[char]["cutX"] = round((cuts_x or middle_cuts)[0], 3)
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
