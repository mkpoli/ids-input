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
        for candidate in [face] + [f for f in faces if f is not face]:
            shape = candidate.whole(text)
            if shape is not None:
                return shape
    return None


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
        root = cut.parse(ids)
        if root.operator not in ("⿰", "⿲"):
            out[char] = {"error": "not a row"}
            continue
        pieces = face.pieces(char)
        if not pieces or len(pieces) < 2:
            out[char] = {"error": "fewer than two pieces"}
            continue
        cutter = cut.Cutter(pieces, labels, faces)
        x0 = min(p.bounds[0] for p in pieces)
        width = max(p.bounds[2] for p in pieces) - x0
        boundary = x0 + 0.48 * width
        left_shape = template(face, ALLOGRAPHS.get(root.children[0].text, (root.children[0].text,)), faces)
        right_text = cut.glyph_of(root.children[1].text, labels)
        right_shape = template(face, (right_text,), faces) if right_text else None
        best = None
        for candidate in candidates(pieces, len(root.children)):
            groups = close(candidate, pieces)
            if len(groups) != len(root.children):
                continue
            left_print = cutter.group_print(groups[0])
            right_print = cutter.group_print(groups[1]) if len(groups) > 1 else None
            shape_score = cut.likeness(left_print, left_shape) if left_shape else 0.0
            right_score = cut.likeness(right_print, right_shape) if right_shape and right_print else shape_score
            score = 0.6 * shape_score + 0.25 * right_score
            if best is None or score > best[0]:
                best = (score, groups)
        if best is None:
            out[char] = {"error": "no split"}
            continue
        left, right = best[1][0], best[1][1]
        for i in list(right):
            if pieces[i].bounds[2] <= boundary:
                right.remove(i)
                left.append(i)
        out[char] = {
            "ids": ids,
            "left": cut.commands_of(cut.union_of([pieces[i] for i in left])),
            "right": cut.commands_of(cut.union_of([pieces[i] for i in right])),
        }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
