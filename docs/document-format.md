# IDS document format

Status: draft, version 1 (2026-10-26).

A document is one IDS sequence and the transforms of its layers, saved as `.ids.json`. The sequence
says what is drawn; the layers say how each level of the drawing is moved, resized, turned or
warped. One file holds one document.

This draft is the storage design for layer transforms, including nested transforms and
non-affine ones. The editor implementation follows this document; the
[JSON Schema](ids-document.schema.json) validates the structure, and
[the example](ids-document.example.json) is a complete document.

## Model

The sequence is read as a tree, as `parse(sequence, { open: true })` does in the core. A **layer** is
one node of that tree. A **layer path** is the list of operand indices from the root:

| path | layer |
| --- | --- |
| `[]` | the whole character |
| `[0]` | its first operand |
| `[1, 0]` | the first operand of its second operand |
| `[1, 0]` + `stroke: 1` | the second stroke of that leaf |

Indices address the operator's `parts` array, which is the order the operator defines. A path may
name a leaf component, an operator node, or an empty slot (`⬚`). A leaf may also name a **stroke**
with the separate `stroke` field; see [Stroke layers](#stroke-layers).

A transform on a layer applies to the layer's whole subtree. A transform on `[]` affects the whole
character; a transform on `[1]` affects both operands under `[1]`; a transform on `[1, 0]` affects
only that operand. Transforms compose from the outside in:

```
p_canvas = T_root( T_part( T_subpart( p_layer ) ) )
```

Each `T` is the layer's chain, applied in array order with the first operation applied first. A
chain on a child operates in the coordinate space the parent leaves it in, so a child translation is
scaled or turned by its ancestors. Matrices on a layer are therefore **layer-local**, and only the
root's are canvas coordinates.

This is what keeps a transform with its layer when the part changes:

- Replacing the component at `[1, 0]` keeps the path, so its transform still applies.
- Decomposing a leaf at `[1, 0]` with a double click turns that layer into an operator node. The
  transform stays on `[1, 0]` and now applies to the new subtree; new children start with identity.
- Splitting or removing an ancestor can shift paths. A transform whose path no longer exists is
  preserved in the file, ignored for drawing, and reported by the editor. A reader must not invent a
  new path for it.

## Canvas and coordinates

The drawing uses a 1000 × 1000 canvas, origin at the top left, x to the right, y down. This is the
box the composer draws in and the box `Drawing` describes.

Matrices use the SVG convention:

```
x' = a x + c y + e
y' = b x + d y + f
```

stored as `[a, b, c, d, e, f]`, the same order as `matrix(a b c d e f)`.

A move is `[1, 0, 0, 1, dx, dy]`. A resize is `[sx, 0, 0, sy, e, f]`; a uniform resize has
`sx = sy`. Rotation and skew are the matching affine matrices. The editor's resizing rectangle,
rotation handle and skew controls all write one affine matrix; the file stores the matrix, not the
handles. A non-uniform scale therefore needs no separate operation.

## Transforms

A layer's `transform` is an ordered array of operations. Omit it for identity. It has at most
eight operations.

### Affine

```json
{ "type": "affine", "matrix": [0.95, 0, 0, 0.95, 25, 8] }
```

`matrix` has six finite numbers. Its determinant `a d - b c` must be non-zero. This is the operation
for moving, the eight-handle resizing rectangle, uniform scaling, rotation and skew.

### Projective

```json
{ "type": "projective", "matrix": [1, 0, 0, 0, 1, 0, 0.0004, 0, 1] }
```

`matrix` is a 3 × 3 real matrix in row-major order. A point is mapped as

```
[X, Y, W]ᵀ = M [x, y, 1]ᵀ
x' = X / W
y' = Y / W
```

The determinant must be non-zero. `W = 0` is a point at infinity; a renderer clips it away. This
covers perspective and other real projective warps.

### Möbius

```json
{ "type": "mobius", "a": [1, 0], "b": [0, 0], "c": [0.001, 0], "d": [1, 0] }
```

Coefficients are complex numbers written `[real, imaginary]`. With `z = x + i y` (y down),

```
z' = (a z + b) / (c z + d)
```

and `a d - b c` must be non-zero. A point where `c z + d = 0` maps to infinity; a renderer clips it.

A Möbius transformation is conformal: it maps circles and lines to circles and lines. It is not an
affine or real projective transformation, so it cannot be written as an SVG `transform` and is not
the same as the `projective` operation. A renderer applies it to flattened geometry.

`affine` operations may also be baked. A chain that mixes types is applied in order; the renderer
flattens the layer, applies each operation, and clips the result to the 1000-unit canvas.

## Stroke layers

A stroke layer names a leaf path and a zero-based stroke index:

```json
{ "path": [1, 0], "stroke": 1, "transform": [/* ... */] }
```

The index counts contours in the leaf's drawing as the drawing writes them: the leaf's pieces in
reading order, each piece's contours in path order. A stroke transform applies to that contour only,
inside the leaf's transform. A leaf drawn as a whole glyph has its glyph's contours in that order.

Stroke indices are best-effort identities. Replacing the part, decomposing it, or changing a glyph
may change the number or order of contours; a record whose stroke no longer exists is preserved,
ignored and reported, like a missing path.

The composer currently returns each part's ink as one path per piece, not a contour list. A renderer
that supports stroke layers splits those paths into contours; a renderer that does not applies the
stroke transform to the whole leaf or leaves it out, and marks the drawing partial.

## File

A file is UTF-8 JSON without a BOM, two-space indented, with a trailing newline. The extension is
`.ids.json`; the media type is `application/json` (a host may use
`application/vnd.ids-input+json`). The format carries numbers and text only. `title` and `name` are
text for a host to escape when it displays them, never markup.

Minimal document:

```json
{
  "format": "ids-input/document",
  "version": 1,
  "sequence": "⿰亻哥",
  "layers": []
}
```

Fields:

| field | | |
| --- | --- | --- |
| `format` | required | `ids-input/document` |
| `version` | required | `1` |
| `sequence` | required | IDS text, drafts (`⬚`) allowed, at most 64 code points |
| `layers` | required | array of layer records, at most 1000 |
| `title` | | a name for the document, at most 200 characters |
| `created` | | RFC 3339 date-time |
| `modified` | | RFC 3339 date-time |

A layer record:

| field | | |
| --- | --- | --- |
| `path` | required | non-negative integers, depth at most 64 |
| `stroke` | | non-negative contour index; the path must name a leaf when present |
| `name` | | editorial label, at most 80 characters; never an identity |
| `transform` | | ordered operations, at most 8; omit for identity |

At most one record may share the same `(path, stroke)` pair. Layers are unordered; a reader resolves
parents by path.

Unknown fields are preserved. An unknown transform `type`, or a transform the host cannot apply, is
preserved on save, not applied for drawing, and reported by the editor. A reader must reject a
different `format` or `version` rather than guess.

The file keeps the semantic transforms. An SVG or PNG export bakes the geometry; the exported image
does not need to carry the JSON.

## Storage and links

The document is the unit the editor stores:

- A tab or a saved draft stores its document. A sequence-only draft is a document with `layers: []`.
- The current tab's document is written to the host's storage after edits; a double-click
  decomposition only changes `sequence`, and the layer records stay.
- A share link may carry the document. The exact URL encoding is host policy; when a link carries
  transforms it should carry the whole document, not a partial sequence, and fall back to a file
  when the URL is too long for a QR code.
- Importing a `.ids.json` file validates it before replacing the current document. Invalid input
  leaves the open document untouched.

## Validation

A reader checks, in this order:

1. `format` and `version` are exact.
2. `sequence` is readable with `parse(sequence, { open: true })`; empty slots are allowed.
3. Paths, stroke indices, layer keys and limits are in range and unique.
4. Every matrix and coefficient is finite; affine and projective determinants are non-zero, and
   Möbius `a d - b c` is non-zero.
5. Every path names a node in the sequence's tree. Missing paths are preserved, not applied, and
   reported.

The JSON Schema checks the shape; the determinant, uniqueness and tree checks belong to the reader.
A layer path is not required to name a leaf; a transform on an operator node is the nested case.

## Limits

| | |
| --- | --- |
| file size | 1 MiB |
| sequence | 64 code points |
| paths | depth 64 |
| layers | 1000 |
| operations per chain | 8 |

## Example

[The example](ids-document.example.json) uses the sequence `⿰木⿱口木`:

```json
{
  "format": "ids-input/document",
  "version": 1,
  "sequence": "⿰木⿱口木",
  "title": "nested example",
  "layers": [
    {
      "path": [1],
      "name": "the ⿱ part",
      "transform": [{ "type": "affine", "matrix": [0.95, 0, 0, 0.95, 25, 8] }]
    },
    {
      "path": [1, 0],
      "name": "口",
      "transform": [{ "type": "affine", "matrix": [1, 0, 0, 1, -8, 3] }]
    },
    {
      "path": [1, 0],
      "stroke": 1,
      "transform": [{ "type": "mobius", "a": [1, 0], "b": [0, 0], "c": [0.001, 0], "d": [1, 0] }]
    }
  ]
}
```

The `[1]` transform scales the whole ⿱ subtree, the `[1, 0]` transform moves 口 inside that
scaled space, and the stroke transform warps one contour of 口 inside the leaf. Replacing 口 with
another component keeps the `[1, 0]` record and its transform.

## Open questions

- Stroke identity. A contour index is stable for one drawing and fragile across glyphs. KanjiVG
  groups, the composer's stroke groups, or a learned stroke correspondence would make a better
  identifier. Version 1 reserves the field and treats it as best-effort.
- The Möbius editor. The file stores coefficients; the UI for choosing them (a pole and a
  coefficient, presets, or a drag surface) is still open.
- Layer-local matrices and resizing anchors. The draft composes local matrices from the outside in;
  an editor that stores only handle positions would need to resolve them to a matrix at save time.
- Multiple documents in one file, for a workspace or a set of tabs. Version 1 has one document per
  file.
- Share-link encoding. A compact binary or base64url representation can follow once the document
  shape settles.
