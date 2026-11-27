# /// script
# requires-python = ">=3.11"
# ///
"""Write data/positional-forms.tsv: the components a description spells in their full form in a
place where characters write a positional form of them instead (竹 on top, written 𥫗).

A row of data/component-forms.tsv marked `radical-variant <place>` names the form. BabelStone's
descriptions say how characters write the place. A pair is listed when at least FORMED characters
write the form there, at most one in RARE as many write the component itself, and at least one
does: where none does, the full spelling can only mean the form (言 on the left), and where some
do, it also names a shape of its own (the 竹 on top of 𥴒). The commonest form is kept.

Run with `uv run scripts/build_positional_forms.py`.
"""
import gzip
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
#: The operators whose first and last operands stand at a named place.
PLACES = {"⿰": ("left", "right"), "⿲": ("left", "right"), "⿱": ("top", "bottom"), "⿳": ("top", "bottom")}
ARITY = {**{op: 2 for op in "⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯"}, "⿲": 3, "⿳": 3, "⿾": 1, "⿿": 1}
FORMED, RARE = 3, 20


def operands(text: str, at: int = 0):
    """Each (place, operand) a description writes at a named place, and where its reading ends."""
    found = []
    char = text[at] if at < len(text) else ""
    if char not in ARITY:
        # A numbered or named component is read whole, and so is a character with its selector.
        if char == "{":
            return found, text.index("}", at) + 1
        if char == "&":
            return found, text.index(";", at) + 1
        end = at + 1
        while end < len(text) and (0xFE00 <= ord(text[end]) <= 0xFE0F or 0xE0100 <= ord(text[end]) <= 0xE01EF):
            end += 1
        return found, end
    start = at + 1
    for index in range(ARITY[char]):
        inner, end = operands(text, start)
        found.extend(inner)
        if char in PLACES and index in (0, ARITY[char] - 1):
            found.append((PLACES[char][0 if index == 0 else 1], text[start:end]))
        start = end
    return found, start


def main() -> None:
    forms = []
    for line in (DATA / "component-forms.tsv").read_text(encoding="utf-8").splitlines():
        cells = line.split("\t")
        if len(cells) == 4 and cells[3].startswith("radical-variant ") and cells[3].split()[1] in ("left", "right", "top", "bottom"):
            forms.append((cells[3].split()[1], cells[1], cells[0]))
    written: Counter = Counter()
    with gzip.open(DATA / "babelstone-ids.tsv.gz", "rt", encoding="utf-8") as lines:
        for line in lines:
            if line.startswith("#") or "\t" not in line:
                continue
            _, *sequences = line.rstrip("\n").split("\t")
            seen = set()
            for sequence in sequences:
                body = sequence.split("(")[0]
                try:
                    seen.update(operands(body)[0])
                except (ValueError, IndexError):
                    continue
            written.update(seen)
    best: dict = {}
    for place, char, form in sorted(forms):
        itself, formed = written[(place, char)], written[(place, form)]
        if itself >= 1 and formed >= FORMED and itself * RARE <= formed and formed > best.get((place, char), ("", 0, 0))[2]:
            best[(place, char)] = (form, itself, formed)
    rows = [f"{place}\t{char}\t{form}\t{itself}\t{formed}" for (place, char), (form, itself, formed) in sorted(best.items())]
    head = ("# Components a description spells in full where characters write a positional form: place, component,\n"
            "# form, and how many characters BabelStone IDS describes with each in that place.\n"
            "# From component-forms.tsv (`radical-variant <place>` rows) and babelstone-ids.tsv.gz, by\n"
            f"# scripts/build_positional_forms.py: the form in at least {FORMED} characters, the component\n"
            f"# itself in at least one and at most one for every {RARE}.\n")
    (DATA / "positional-forms.tsv").write_text(head + "\n".join(rows) + "\n", encoding="utf-8")
    print(len(rows), "rows")


if __name__ == "__main__":
    main()
