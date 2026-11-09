# Cutting a glyph into its parts

A description names a character's parts. The donor-part build turns that naming into
outlines: it cuts a glyph at ink the font already separates, and never at a boundary it
invents.

## Pieces

`Face.outline()` draws the glyph into a `pathops.Path`; `simplify()` merges contours that
overlap; `pieces_of()` splits the result into closed pieces that touch nowhere. A piece is
therefore one element's ink or a group of strokes that the font draws joined — the 礻 of
社 is one piece, its 土 another.

A boundary the font does cross is not cut. A piece that spans the row seam is reported,
not dealt to one side.

## Grouping

`Cutter` hands whole pieces to the operands of one node. The candidates depend on the
operator:

- `⿱`/`⿳` sort pieces by height and keep the runs that preserve the reading order.
- `⿰`/`⿲` sort by width and sweep the row: left edge, midpoint and right edge each give
  an order, and each seam coordinate in the middle band gives a partition.

A candidate is scored by fingerprint: the group's ink as coverage over a 16×16 grid of its
own box, compared with the element drawn alone. Scaling to the box lets a squashed 山 read
as 山.

## Rows

Three corrections keep a row honest:

- Enclosure closure. A piece whose horizontal span lies inside the neighbouring group's
  span belongs with that group. In 祣 the left dot (313–386) sits inside the enclosing
  stroke (43–427) and would otherwise fall on the wrong side of an x-only sweep.
- Layout correction. A piece wholly inside the left column belongs to the left operand.
  This keeps a detached dot with its radical when the shape score is low.
- Allographs. The left operand may be drawn as 示, 礻 or the variant 𱍐 (U+31350); the
  templates are tried in turn, from the character's own face first.

## Faces

The pinned build draws with Noto Sans CJK JP and, for the extension blocks Noto omits,
Jigmo, Jigmo2 and Jigmo3. The Jigmo faces follow the description's own spelling, so a
character written `⿰示X` draws 示 on the left even where the conventional glyph uses 礻;
they supply geometry for the cutter, not a verdict on which form a character should use.

## Output

`scripts/cut_row_parts.py` cuts the left operand of a row and writes each group's outline
commands, so the pieces can be replayed without the font. `build_donor_parts.py` writes
the stack build's `data/donor-parts.json`.
