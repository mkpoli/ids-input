# Enclosure grafts

The composer draws a ⿺ enclosure from the outer part's own glyph when the face has one, and presses
the outer part when it does not: the box shrinks and the foot stretches into a blunt 乚. 电 is such a
case. Kureedo draws a foot for this kind of enclosure elsewhere — 巴's sweep in 𠀧 (⿺巴三) — and the
composer grafts that sweep onto the pressed 电. This is how the graft works and what it needs.

## When a graft applies

- The face has no ⿺ form for the outer part, so the composer presses it.
- The outer part is one drawn outline with counters and a leg hanging from it, so the press leaves a
  foot where a designed one can sit: 电 is a 日 with the 乚 hanging from the stroke between its
  counters.
- The face draws the same kind of foot in another glyph, named by that glyph's digest so another
  face's drawing never substitutes.

## The method

1. **The host's cut.** A horizontal cut runs as deep down the host's leg as the leg stays a leg. The
   ink beside the leg — the 乚's hook — is dropped by a scanline-correct polygon cut rather than
   welded to the box, which is what a rectangular clip does.
2. **The donor's cut.** The donor's sweep is cut below its own bottom stroke and above its rising
   tip, so one cut crosses its leg alone. Both masters are cut at the same places along their
   outlines, which keeps their points paired.
3. **The join.** The donor's leg is mapped onto the host's two edges at every level of the overlap,
   holding the cut-level width below it. The host's and the donor's outlines are measured on both
   masters, so the light and the heavy thicknesses match across the seam rather than one freezing at
   the other's shape.
4. **The floor.** Beyond the leg the donor's floor runs out to the glyph's right edge through the
   Möbius foot map, whose stretch reaches 1 at the tip. Nothing is scaled vertically, so the brush's
   proportions survive.
5. **The pieces.** The host's body keeps the box and the counters; the counters stay holes. The
   donor's piece follows the host's placement, source and weight.

## In the code

- `ENCLOSURE_TAILS` in `src/composer/compose.js` names the donor glyph by digest and the indices of
  its contours: 电 takes 巴's outline and two windows from 𠀧.
- `tailForm` cuts the named contours off the donor and checks the digest; a face without the glyph
  falls back to the plain press.
- `graftTail` plans the cuts and joins the pieces; `pressedEnclosure` passes the optional tail, so
  the Kaisho press path uses it while Sans and Serif keep their designed forms.
- `tests/enclosure-form.test.js` pins the join: the leg width through the seam in both masters, the
  host's own foot, the paired rings, the windows as holes, and the untouched ⿰ paths.

## Candidates

The BabelStone IDS (2025-06-27) lists 3,567 characters whose description starts with ⿺, over 198
distinct outer parts. In Klee One's coverage 74 of those outers appear in a drawn ⿺ glyph — 辶, 走,
風, 鬼, 瓦, 廴, 尢, 毛, 是, 光, 兀, 九, 元, 克 and others — and 163 appear only in missing glyphs,
which the composer presses. The outers with a leg and counters, where a graft could fit, include 毛,
走, 風, 鬼, 尢, 瓦, 九, 乙, 元, 克, 爪, 瓜, 是, 見, 虎 and 尾; each needs its donor checked the way
电's did.

The coverage counts Klee One's scope, not the Kureedo export's glyphs — 𠀧 is drawn in the export and
missing from the coverage — so the split above is a first filter. The export's records are the
answer for a given face.

## Sources

- [BabelStone IDS](https://www.babelstone.co.uk/CJK/IDS.TXT), Andrew West, file date 2025-06-27.
- The 𠀧 glyph (⿺巴三) in Kureedo Full, the donor for 电's foot.
- PR #512, the 电 graft; PR #484, the Möbius foot map it uses.
