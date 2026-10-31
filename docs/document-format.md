# IDS document format

Status: draft, version 1 (2026-10-26). This is a proposed storage and rendering
contract. The workshop reads and writes `.ids.json`, and embeds the document in
exported SVG and PNG files.

A `.ids.json` file holds one editable character: a tree of identified layers,
their transforms, and a rendering recipe. IDS text is derived from the tree.
[The schema](ids-document.schema.json) checks the JSON structure;
[the example](ids-document.example.json) describes `⿰木⿱口木`.

## Document and layers

```json
{
  "format": "ids-input/document",
  "version": 1,
  "render": { "mode": "unbound" },
  "root": { "id": "root", "kind": "slot" }
}
```

The root is required, including for an empty document. A slot represents `⬚`;
an empty input field imports as a root slot. There is no separately stored
`sequence` or path-indexed layer table to keep in sync.

Every layer has a document-unique, opaque `id` of 1–80 ASCII letters, digits,
underscores or hyphens. IDs are created by the editor, persist through saves,
and are never inferred from character text or position. Allocation reserves all
current layer IDs, retained history IDs, and every stored `geometryEdits[].node`
reference, including unresolved references after reload. A new layer cannot
reactivate an old geometry edit by reusing its removed target ID. Labels use an optional
`name` (up to 80 Unicode code points). A layer can be:

| `kind` | required content | IDS projection |
| --- | --- | --- |
| `component` | `char`: one core component, optionally followed by one variation selector and loose marks, or one conjoining Hangul jamo run | `char` |
| `operator` | `op`, `children` in operand order, optional `marks`, optional `note` | `op`, its `note` in brackets if it has one, each child's projection, then `marks` |
| `slot` | none | `⬚` |
| `group` | one `child` | child's projection |

A loose mark is a combining mark, a modifier letter or a superscript written after the whole
description (`⿰亻木ˊ`): it annotates the character rather than taking an operand's place. Marks
therefore belong where the projection ends—the root, the last child of its last child, or the child of
a root group—and an edit that would carry them inside the tree hoists them back to the root, in
reading order. A slot cannot carry them.

A `note` holds a zi.tools modifier (`1`, `1:`, `.,x`) written after the operator, before its parts; the
projection prints it in brackets, and the composer draws the description's parts as it does without
one. A group has an

identity layout and carries an authored transform independently of an IDS
operator. Groups can be nested and remain in the document even when their
transforms are identity. Their IDs can be selected and named in a layer view.

Every kind can have `transform`, an ordered array of operations; omission or
`[]` means identity. The tree is authoritative. For core parsing, searching,
sharing plain IDS or looking up a decomposition, project it to IDS and use the
existing core API. A plain IDS copy carries structure only; file and document
sharing carry the tree and its edits.

## Editing identity

Paths are temporary addresses for selection and layout. Edits operate on IDs.
Each edit is one transaction over the complete document; undo and redo restore
IDs, content, transforms, render binding and geometry edits together.

| operation | identity and transform rule |
| --- | --- |
| Replace a selected layer | Keep its ID, name, extensions and transform. Replace its content; descendants removed by the replacement leave the tree. |
| Decompose a component | Keep its ID and transform; change its kind to `operator`. Give its new children fresh IDs and identity transforms. |
| Fill or clear a slot | Keep the selected ID and transform; change its kind/content. Clearing a subtree removes its descendants. |
| Wrap a layer in an operator | Create a new operator ID with identity transform. Move the existing layer, with its ID and transform, into the first operand. Create fresh slots for the other operands. |
| Change an operator | Keep its ID, transform and retained children. Give added slots fresh IDs. Refuse to discard a filled operand without an explicit destructive edit. |
| Unwrap an operator | Keep its ID and transform as a `group`. Its child is the first non-slot operand, with that operand's existing ID and transform; if all operands project to `⬚`, retain the first operand. Remove the other operands. |
| Move a subtree | Preserve every ID and transform within it. Layout is recomputed in the destination frame. |
| Duplicate a subtree | Give every copied layer a fresh ID. Copy geometry edits whose `node` belongs to that subtree, give them fresh edit IDs, preserve their relative array order, and rewrite their node references. References to removed layers outside the subtree are not copied. |
| Delete a layer | Remove its subtree; if the parent's arity requires an operand, insert a fresh identity slot. A document always retains a root. |

For unwrap, “non-slot” means an operand whose IDS projection differs from `⬚`;
an identity group around a slot is still empty. The group places its retained
child in the full former parent frame. The retained subtree reflows to that
frame, with both sets of authored transforms intact. Removing an identity group
is a separate edit that preserves its child's ID; removing a transformed group
requires an explicit transform-baking operation or an explicit discard action.

For example, in `⿰⿱木火口`, a layer ID on 口 stays on 口. Unwrapping the root
retains the ⿱ subtree in a group and removes the 口 layer. An edit referencing
口 becomes unresolved; it cannot attach itself to 火 merely because 火 occupies
path `[1]` afterward.

Opening plain IDS as a new document creates fresh IDs and no authored edits.
Replacing the entire tree in an existing document creates fresh IDs, retains
geometry edits as unresolved records, and discards the old layer transforms as
one explicitly accepted, undoable action. Text editing that cannot establish an
unambiguous structural edit must offer this replacement. Repeated characters are
never matched by text alone.

Geometry edits referencing a removed or changed layer are retained separately
and reported as unresolved. Undo restores their targets. They are never assigned
to a replacement layer by path, contour count or visual similarity.

## Coordinates and layout

Every layer has a local frame of 1000 × 1000 units, with origin at the top left,
x right and y down. This frame is independent of the ink bounding box. The root
frame is also the document canvas.

The renderer first computes **base layout**, using the tree and rendering recipe
with all authored transforms and geometry edits disabled. It returns local
geometry for components and an invertible affine placement `P_child` for each
parent-child edge. Operator placements include the operator's positioning,
scaling and reflection. The root placement and every group's child placement
are identity. Contextual glyph selection and shape fitting belong to base layout.

A component's authored transform `E_child` acts in its local frame before its
placement into its parent. For column vectors, the affine case is:

```
F_root = E_root
F_child = F_parent × P_child × E_child
p_canvas = F_child × p_local
```

For nonlinear operations, the same rule is functional composition:
`F_child(p) = F_parent(P_child(E_child(p)))`. Each layer's operation array applies
its first entry first. An ancestor therefore also transforms the placements
and edits of its descendants. Editing transforms does not recompute base layout;
changing the tree or rendering recipe does.

A local translation of 100 units in a half-width child placement moves it 50
parent units before the parent's edits. Handles report canvas positions, then
convert the intended operation into the layer's local frame. A canvas rotation
generally becomes a shear in an anisotropic local frame, so the editor exposes
a six-coefficient affine matrix mode for transforms the simpler fields cannot
represent. Rotation about a chosen point is stored with its compensating
translations in the matrix or operation chain; no implicit bounding-box pivot
is read from the file.

This requires a renderer interface beyond the current `Drawing.parts`, whose
paths and boxes are already positioned in canvas coordinates. A document renderer
must expose ID-addressed local geometry and placements, and must not substitute
an indivisible whole-glyph drawing for a subtree with descendant edits. If the
requested separation is unavailable, rendering is incomplete. The current global
cut path also needs replacement with the scoped compositing contract below.

The frame and matrix conventions follow the [SVG coordinate model][svg-coordinates].
The normalized layer frame and placement/edit order above are this format's rules.

## Compositing scope

Each component produces a filled region: union its ink pieces and subtract the
union of its cut pieces, using each piece's fill rule. These cut roles apply only
to that component. Geometry edits modify its pieces before this operation.

Each operator combines the already-transformed, placed results of its children
in its own local frame. `㇯` subtracts its second child's result from its first;
all other operators union their child results after the placements supplied by
base layout. A group forwards its child's result. Apply the node's authored
transform to that combined region, then its parent placement. Ordinary overlap
uses monochrome union, without a document-global subtraction pass.

For example, `⿻㇯木口口` overlays the result of `㇯木口` with the final 口.
The subtraction inside the first child cannot erase ink in the final child.
Implementations may use scoped masks or boolean geometry, but must preserve this
nesting. Internal set operations do not introduce local canvas clips; only the
fully composed root is clipped to the document canvas.

## Transform operations

Each layer or geometry edit has at most 64 operations. All numeric values must
be finite binary64 values. The schema checks array shapes; semantic validation
checks coefficients and invertibility.

### Affine

```json
{ "type": "affine", "matrix": [0.95, 0, 0, 0.95, 25, 8] }
```

The SVG order `[a, b, c, d, e, f]` means `x' = ax + cy + e` and
`y' = bx + dy + f`. Require `ad − bc ≠ 0`. Translation, independent x/y scaling,
rotation and skew all use this operation. Consecutive affine operations may be
combined without changing their order of application.

### Projective

```json
{ "type": "projective", "matrix": [1, 0, 0, 0, 1, 0, 0.0004, 0, 1] }
```

The matrix is row-major. Compute `[X, Y, W]ᵀ = M[x, y, 1]ᵀ`, then
`(x', y') = (X/W, Y/W)`. Require a non-zero determinant. The denominator can
still vanish within the drawing domain; see [Rendering completeness](#rendering-completeness).

### Möbius

```json
{ "type": "mobius", "a": [1, 0], "b": [0, 0], "c": [0.001, 0], "d": [1, 0] }
```

Each coefficient is `[real, imaginary]`. With `z = x + iy` (y down), apply
`z' = (az + b)/(cz + d)` and require `ad − bc ≠ 0`. Some special cases are
also affine; a general Möbius operation needs transformed geometry rather than
an SVG `transform` attribute.

Unknown operation types retain their complete JSON object and array position.
They make the affected drawing incomplete. No code, resource loader or evaluator
is selected directly from an operation's type or payload.

## Rendering recipe

`render` is required and has one of two modes:

- `unbound`: the host may choose its available renderer and assets. The editor
  displays that the appearance is unbound. Semantic layer transforms still use
  the specified local frames. Geometry-specific edits require a pinned recipe.
- `pinned`: the file names `engine`, an immutable `revision`, all effective
  `options`, and an `assets` array. Each asset has a unique `role` and a lowercase
  SHA-256 digest of its bytes. An optional `uri` is a retrieval hint. Fonts,
  decomposition/layout data and other appearance-affecting resources must be
  covered, either directly or through a manifest that pins its transitive inputs.

The engine identifier names a registered renderer profile. That profile defines
its revision identifiers, required asset roles and complete option vocabulary,
including style, locale and glyph-selection policy where relevant. Omitting
required options or using unknown appearance-affecting options makes the recipe
unusable. The same profile, revision, asset bytes and options must produce the
same base geometry and placements. A URL alone cannot pin a recipe.

Before displaying a pinned drawing as complete, verify its recipe and assets.
If an asset or renderer revision is unavailable, retain the document and report
it as unavailable. A user can explicitly rebind to another recipe as one undoable
edit; the host must not silently choose a newer export or fallback font.

Version 1 stores references rather than embedding fonts or outline snapshots.
SVG exports embed the document in `<metadata>` and PNG exports in an `iTXt`
chunk, alongside the rendered appearance. Reopening restores the tree, IDs and
transforms; a pinned document still needs its rendering resources, and an
unbound document can be pinned once the host records its complete effective
recipe.

## Geometry-specific edits

The optional document-level `geometryEdits` array contains edits to exact rendered
geometry. Each record has its own unique `id`, a `node` layer ID, a `geometry`
fingerprint, a `target`, and a transform chain. The node must resolve to a
component before an edit can apply. The array order is the application order;
a whole-layer transform is applied after its geometry edits. Geometry-edit
matrices use the owning component's 1000-unit local frame, with no implicit
contour/stroke frame or pivot.

A target is one of:

| `kind` | identity | meaning |
| --- | --- | --- |
| `contour` | `piece`, `contour`: zero-based indices | one outline subpath within a piece |
| `stroke` | `id`: source-provided stroke ID | the pieces explicitly grouped as that writing stroke |

[SVG subpaths][svg-paths] describe outline boundaries and can describe holes.
They do not supply writing-stroke identities. A renderer without stroke groups
cannot apply a stroke edit. It must never broaden an unsupported target to the
whole component.

The geometry fingerprint is lowercase SHA-256 of UTF-8 [JCS][jcs] for this
renderer-produced descriptor, before any authored edits:

```
{
  "units": 1000,
  "pieces": [{ "d": "...", "fillRule": "nonzero", "cut": false }],
  "strokes": [{ "id": "...", "pieces": [0] }]
}
```

`pieces` is in renderer order. Each `d` uses finite absolute SVG M, L, Q, C and Z
commands and closed subpaths, in contour order. Each piece has an explicit
`fillRule` (`nonzero` or `evenodd`) and `cut` boolean. `strokes` is in source order;
IDs are unique, each group has distinct valid piece indices, and different stroke
groups must not share pieces. It is `[]` when no stroke grouping is supplied.
Path text is hashed exactly; equivalent path spellings are not normalized by JCS.
The recipe supplies provenance; the fingerprint binds the actual local geometry.

An edit applies only if the layer ID, component kind, fingerprint and target all
match. A missing layer, changed glyph, changed contour order, or unavailable stroke
group leaves it unresolved. Counts being equal is insufficient. Rendering checks
all fingerprints against the same unedited base geometry; later edits retain
those target identities even when earlier edits have moved their geometry.

Apply selected contour edits within their original compound path, preserving
subpath orientation and fill rule. Apply stroke edits to all pieces in that
stroke group. Cut pieces remain subtractive within their owning component through every transform. Preserve
unresolved records on save so undo or explicit rebinding can recover them.
Rebinding a target must be an explicit edit that records the new fingerprint.

## Rendering completeness

A preview can be `complete`, `partial`, or `unavailable`. Unknown operations,
unresolved geometry edits, missing separation, and unimplemented warps make it
partial. A missing pinned recipe or required resource makes it unavailable.
The editor lists the affected layer/edit IDs and reasons. Saving JSON retains all
operations and unresolved references. Normal SVG/PNG export requires a complete
drawing; an explicitly selected partial export must be identified as such to the
user. A partial preview may omit unsupported edits but must show its partial state.

Apply the full geometry-edit, layer-edit and ancestor-placement pipeline before
clipping to the root canvas. A layer has no implicit local clip. For example,
a child translation of +1000 followed by a parent translation of −1000 restores
the geometry. Intermediate canvas clipping would incorrectly discard it.

Projective and Möbius renderers must certify that their denominators stay away
from zero over the complete filled region being transformed, including its
interior. Independently transformed contours and cut pieces include their own
interiors in this check. Finite boundary samples alone are insufficient. A pole
crossing, an unbounded
result, or a failure to establish a finite error bound makes rendering partial;
the operation remains in the document. Never join sampled points across a pole.
Conservative rejection is permitted when the renderer cannot certify the domain.

Affine curves can remain exact. Nonlinear geometry requires adaptive subdivision
measured after the complete chain: maximum deviation is 0.25 output pixels for
raster output and 0.1 canvas units for SVG. Include transformed geometry edits and
ancestors when measuring error. Hitting the renderer's work limit produces an
incomplete result, never an asserted-complete coarse approximation. Root clipping
and subtractive compositing must preserve filled regions, holes and cut roles.

## Serialization and validation

Files use UTF-8 JSON, extension `.ids.json`, media type `application/json`.
Writers use two-space indentation and a trailing newline. Readers accept JSON
whitespace. Reject duplicate object keys and numbers outside the finite binary64 range
before schema validation. `format` and `version` must match exactly.

Core objects have closed fields. Optional `extensions` objects hold opaque
metadata, keyed by namespace (for example, `example.org/editor`). Readers preserve
these objects; they do not affect drawing semantics. Future drawing operations
use the transform chain, where unsupported operations are detectable. A future
structural node kind requires a new format version.

The schema checks field types, node variants, operator arity, transform shapes,
ID syntax, render modes and per-array limits. A semantic reader additionally:

1. Enforces global node/edit counts, depth and unique IDs. Layer IDs and geometry
   edit IDs each have their own document-wide namespace. ID allocation reserves
   current/history IDs and stored target references, including after reload.
2. Projects the tree to IDS, validates with the core open parser, and requires
   each component to be one accepted component plus at most one selector, or one
   conjoining Hangul jamo run.
3. Checks every known operation's mathematical validity and finite coefficients.
4. Checks pinned recipe completeness and resolves geometry references without
   retargeting them. Unresolved geometry edits are valid stored records.
5. Computes rendering status using supported operations, verified inputs and
   the numerical guarantees above.

A singular known matrix is invalid input; an invertible operation with a pole in
the current drawing domain is valid stored input with an incomplete rendering.
Unknown operations are preserved and reported, not rejected as malformed known
operations. Invalid import leaves the open document untouched.

| limit | value |
| --- | --- |
| file bytes | 1 MiB |
| projected IDS | 64 Unicode code points |
| layers, including groups and slots | 1000 |
| layer depth, root at depth 0 | 64 |
| geometry edits | 1000 |
| operations per chain | 64 |
| pinned asset roles | 128 |

Tabs, drafts, dirty-state comparisons and undo histories store the complete
document. Raw invalid text being typed is separate editor-session state; it
cannot masquerade as a valid document tree. Multiple documents per file are
outside version 1.

A share link carries the sequence in its path and, only where the document
holds more than that sequence, the difference in a `doc` parameter: base64url of
a small JSON object with the sequence, the title, the render recipe and each
layer's path, kind, name, transform and extensions. IDs are fresh on arrival,
the same ones every read. A document its sequence already spells shares the
path alone; use a file when the difference exceeds the host's URL or QR-code
budget. The older `#` and `?ids=` forms still open. The worker writes the title,
the description and the canonical for a sequence into the head the host serves.
A path that names no sequence answers 404 with the text and a link that opens it
as a draft. Text in a sequence's own letters that does not parse, like `木口`,
is sent on to the editor with 303. A text holding `.` or `/` is no path segment
as it stands, so the app keeps it in `?ids=`, as it does text the parser
rejects.

A tab or draft keeps an `ids-input/session` envelope beside its document: the
current document, the chosen layer and every ID the session has issued. Undo
history stays in memory. The envelope is host storage, not a file format; the
document inside it is the same `.ids.json` document.

## Implementation boundary and checks

The editor still uses positional core trees, with the document reconciled from
them by `syncDocument`; the workshop keeps a session with each tab and saved
draft. `layerAtPath` and `pathOfLayer` bridge editor paths and layer IDs;
`layerFrames` gives the inspector and preview one layout frame per layer. The
main preview renders the scoped document drawing, Adjust layout writes layer
transforms, export uses the same scoped drawing, and a share link carries the
difference from the sequence. The workshop’s Undo and Redo consume the session’s
transform steps before falling back to the editor’s structural history. The
address keeps the sequence in its path and adds the token while the document holds more than that
sequence. The core IDS parser and writer remain the projection boundary.

The model layer lives in [`src/document`](../src/document/index.js): it imports
and projects IDS, checks the document structure and transforms, reads and writes
the JSON, and implements the identity-preserving edits above. The module also
evaluates affine, projective and Möbius transform chains, traverses a document
with host-supplied local geometry and placements, and writes a scoped tree whose
component cuts and ㇯ subtraction become SVG masks. It also provides a session that
keeps the chosen layer, an allocator and undo/redo over whole documents. A
separated composer drawing supplies the base layout through
[`src/composer/document-source.js`](../src/composer/document-source.js); it
uses leaf ownership when present and otherwise infers one non-cut part per
component in reading order. Session records and file bindings live in
[`src/document/store.js`](../src/document/store.js) and
[`demo/lib/documents.js`](../demo/lib/documents.js).

Before implementing import/export, the conformance cases must cover identity
through replace/decompose/wrap/unwrap/move/duplicate; duplicate IDs; empty roots;
projection limits; local placement versus edits; child/parent clipping order;
geometry fingerprint mismatch; holes and cuts; unknown operations; unavailable
assets; poles; and complete versus partial export. Schema fixtures validate only
structure and must not be presented as renderer or identity tests.

Run the structural fixtures with `uv run scripts/check_document_schema.py`.
The example intentionally uses an unbound recipe; it demonstrates semantic layer
transforms without claiming a particular font or export is available.

## References

- [SVG 2 coordinate systems][svg-coordinates]: coordinate spaces and affine matrices.
- [SVG 2 paths][svg-paths]: subpaths, closed contours and compound paths.
- [RFC 8785, JSON Canonicalization Scheme][jcs]: canonical JSON bytes for fingerprints.
- [JSON Schema 2020-12][schema]: structural validation vocabulary.
- [`src/core/ids.js`](../src/core/ids.js): component grammar, operator arities and IDS projection limits.
- [`src/composer/loader.js`](../src/composer/loader.js) and
  [`src/core/preview.js`](../src/core/preview.js): current drawing and adjustment boundaries.

[svg-coordinates]: https://www.w3.org/TR/SVG2/coords.html
[svg-paths]: https://www.w3.org/TR/SVG2/paths.html
[jcs]: https://www.rfc-editor.org/rfc/rfc8785
[schema]: https://json-schema.org/draft/2020-12/json-schema-core
