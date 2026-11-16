// The zi.tools IDS Extension specification: the appendix page (demo/Baishi.svelte,
// https://ids.mkpo.li/baishi) as a PDF in one of three editions, `--input lang=en|zh-Hans|zh-Hant`.
// Every text, table, example and quotation comes from /cache/spec-pdf/data.json, which
// scripts/build_spec_pdf.mjs writes from the page's own data, messages and quotations; the grammar
// is read from data/baishi-ids*.ebnf and each rule's railroad diagram is drawn by the page's
// generator. The #said, #examples, #grammar and #at placements follow the page's order, and the
// build stops when they part.
#import "template.typ": (
  accent, fonts, ink, muted, rule-color, rule-strong, soft, spec, sunken,
)

#let D = json("/cache/spec-pdf/data.json")
#let edition = sys.inputs.at("lang", default: "en")
#assert(
  edition in ("en", "zh-Hans", "zh-Hant"),
  message: "lang is en, zh-Hans or zh-Hant, got " + edition,
)
#let commit = sys.inputs.at("commit", default: "")
// Built from uncommitted changes: the commit is named as git describe names it, with -dirty.
#let dirty = sys.inputs.at("dirty", default: "false") == "true"
#let typst-version = sys.inputs.at("typst", default: "")
#let zh = edition != "en"
#let faces = fonts(if edition == "zh-Hant" { "TC" } else { "SC" }, zh)
#let M = D.messages.at(edition)
/// This edition of the specification; raise it when the text changes.
#let edition-number = "1"

/// The faces the editions are set in, as scripts/build_spec_pdf.mjs fetches them.
#let typefaces = (
  (
    name: "Libertinus Serif",
    role: "latin",
    version: "7.051, in typst-assets 0.15.1",
    by: "Philipp H. Poll, Khaled Hosny (The Libertinus Project Authors)",
    licence: "SIL Open Font License 1.1",
    url: "https://github.com/alerque/libertinus",
  ),
  (
    // The region subsets of Noto CJK, named as their files name them; English and Simplified
    // Chinese use SC only.
    name: if edition == "zh-Hant" { "Noto Serif TC, Noto Serif SC" } else {
      "Noto Serif SC"
    },
    role: "serif",
    version: "2.003",
    by: "Adobe",
    licence: "SIL Open Font License 1.1",
    url: "https://github.com/notofonts/noto-cjk/tree/Serif2.003/Serif/SubsetOTF",
  ),
  (
    name: if edition == "zh-Hant" { "Noto Sans TC, Noto Sans SC" } else {
      "Noto Sans SC"
    },
    role: "sans",
    version: "2.004",
    by: "Adobe",
    licence: "SIL Open Font License 1.1",
    url: "https://github.com/notofonts/noto-cjk/tree/Sans2.004/Sans/SubsetOTF",
  ),
  (
    name: "Jigmo, Jigmo2, Jigmo3",
    role: "serifFallback",
    version: "20250912",
    by: "Koichi Kamichi; GlyphWiki contributors",
    licence: "CC0 1.0",
    url: "https://kamichikoichi.github.io/jigmo/",
  ),
  (
    name: "Plangothic P1, P2",
    role: "sansFallback",
    version: "V2.9.5795",
    by: "Plangothic Project (Fitzgerald-Porthmouth-Koenigsegg)",
    licence: "SIL Open Font License 1.1",
    url: "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/tag/V2.9.5795",
  ),
  (
    name: "Noto Emoji",
    role: "emoji",
    version: "3.002",
    by: "Google",
    licence: "SIL Open Font License 1.1",
    url: "https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoemoji",
  ),
  (
    name: "DejaVu Sans Mono",
    role: "mono",
    version: "2.37, in typst-assets 0.15.1",
    by: "Bitstream, Inc.; DejaVu changes in the public domain",
    licence: "Bitstream Vera Fonts licence",
    url: "https://dejavu-fonts.github.io/",
  ),
)

/// A message of this edition, with its {placeholders} filled.
#let t(key, ..args) = {
  let text = M.at(key, default: none)
  assert(text != none, message: "no message " + key)
  for (name, value) in args.named() {
    text = text.replace("{" + name + "}", str(value))
  }
  text
}
/// A quotation's English rendering; a Chinese reader reads the quotation itself.
#let gloss(id) = if zh { "" } else { D.glosses.at(id, default: "") }

// ---------------------------------------------------------------- pieces

/// Simplified Chinese as the documents write it, in every edition.
#let hans(body) = text(lang: "zh", region: "CN", font: faces.hans-serif, body)
/// A Simplified Chinese quotation in the edition's quotation marks.
#let quoted(body) = {
  let (open, close) = if edition == "zh-Hant" { ("「", "」") } else {
    ("“", "”")
  }
  open + hans(body) + close
}
#let hans-sans(body) = text(
  lang: "zh",
  region: "CN",
  font: faces.hans-sans,
  body,
)
/// IDS as printed, in a paragraph of its own: no spacing goes between its CJK and Latin
/// characters, and Typst decides that spacing per paragraph, so `text` alone cannot turn it off.
#let ids-text(body, before: none, after: none) = block(spacing: 0.3em, {
  set text(
    lang: "zh",
    region: "CN",
    font: faces.hans-sans,
    cjk-latin-spacing: none,
  )
  set par(justify: false)
  if before != none { before }
  body
  if after != none {
    [ ]
    after
  }
})
#let mono(body, ..args) = text(font: faces.mono, ..args, body)
#let char(c, size: 15pt) = hans-sans(text(size: size, c))

/// Where something is printed: a document key and its page, linking to the document's entry.
#let at(cite) = link(label("doc-" + cite.at(0)), box(
  inset: (x: 2.5pt, y: 1pt),
  outset: (y: 1pt),
  radius: 1.5pt,
  stroke: 0.4pt + rule-color,
  mono(size: 6.8pt, fill: accent, cite.at(0) + " " + cite.at(1)),
))

/// A badge's word: proposal, draft, inference and the like.
#let kind-name(kind) = t("baishi." + kind)
#let badge(kind) = box(
  inset: (x: 3pt, y: 1.5pt),
  outset: (y: 1pt),
  radius: 1.5pt,
  stroke: (
    paint: if kind in ("proposal", "searchOnly") { accent } else {
      rule-strong
    },
    thickness: 0.5pt,
    dash: if kind == "inference" { "dashed" } else { none },
  ),
  text(
    font: faces.sans,
    size: 6.8pt,
    weight: "regular",
    fill: if kind in ("proposal", "searchOnly") { accent } else { soft },
    kind-name(kind),
  ),
)

/// A quotation, word for word, with its rendering and where it is printed.
#let said(id, cite) = block(
  width: 100%,
  inset: (left: 8pt, y: 2pt),
  stroke: (left: 1.6pt + rule-strong),
  above: 0.9em,
  below: 0.9em,
  {
    set par(spacing: 0.45em)
    hans(D.QUOTES.at(id, default: D.OTHER_QUOTES.at(id, default: "")))
    let rendering = gloss(id)
    if rendering != "" {
      parbreak()
      text(size: 0.92em, fill: soft, rendering)
    }
    if cite != none {
      parbreak()
      at(cite)
    }
  },
)

/// One description of a printed text: the text before its identifier and the identifier, as
/// demo/lib/baishi.js splitTag reads it. A chain's own parentheses are not an identifier.
#let split-tag(piece) = {
  let found = piece.trim().match(regex("(?s)^(.*[^#\s])\(([^()]*)\)$"))
  if found == none { (body: piece.trim(), tag: "") } else {
    (body: found.captures.at(0), tag: found.captures.at(1))
  }
}
/// A printed text: groups at TAB (⇥), descriptions at `;`, identifiers set off.
#let written(source, before: none, after: none) = ids-text(
  before: before,
  after: after,
  {
    for (g, group) in source.split("\t").enumerate() {
      if g > 0 {
        h(2pt)
        text(fill: muted, "⇥")
        h(2pt)
      }
      for (p, piece) in group.split(";").enumerate() {
        if p > 0 { text(fill: muted, ";") }
        let lead = piece.match(regex("^\s*")).text
        let one = split-tag(piece)
        lead + one.body
        if one.tag != "" { text(fill: accent, "(" + one.tag + ")") }
      }
    }
  },
)

/// An example: the character, the text as printed and what it becomes, a quotation about it, a
/// label and where it is printed. `current` is false for what another document writes, framed dashed.
#let example(one, current) = block(
  width: 100%,
  breakable: false,
  inset: (x: 6pt, y: 5pt),
  radius: 2pt,
  stroke: (
    paint: rule-color,
    thickness: 0.6pt,
    dash: if current { none } else { "dashed" },
  ),
  {
    grid(
      columns: (auto, 1fr, auto),
      column-gutter: 7pt,
      align: (horizon, horizon + left, horizon + right),
      if "char" in one { char(one.char) } else { [] },
      {
        set par(justify: false)
        written(one.text)
        if "to" in one { written(one.to, before: text(fill: muted, "→ ")) }
      },
      {
        if "label" in one {
          mono(size: 6.8pt, fill: muted, one.label)
          h(4pt)
        }
        at(one.at)
      },
    )
    if "quote" in one {
      set par(spacing: 0.4em, justify: false)
      v(2pt)
      text(size: 0.9em, hans(D.QUOTES.at(one.quote)))
      let rendering = gloss(one.quote)
      if rendering != "" {
        parbreak()
        text(size: 0.86em, fill: soft, rendering)
      }
    }
  },
)
#let examples(key, current: true) = block(width: 100%, grid(
  columns: (1fr, 1fr), gutter: 5pt,
  ..(if current { D.EXAMPLES } else { D.OTHER_EXAMPLES }).at(key).map(one => example(one, current)),
))

#let rule-of(name) = {
  let found = D.rules.find(one => one.name == name)
  assert(found != none, message: "no rule " + name)
  found
}
/// A rule's railroad diagram from the page's generator, at the page's scale or narrower.
#let diagram(rule) = layout(size => image(
  "/cache/spec-pdf/railroad/" + rule.file,
  width: calc.min(rule.width * 0.6pt, size.width),
  alt: t("spec.diagramAlt", name: rule.name),
))
/// Rules as the file writes them, each with its diagram.
#let grammar(names) = for name in names {
  let rule = rule-of(name)
  block(width: 100%, breakable: false, above: 0.8em, below: 0.8em, {
    link(label("rule-" + rule.file), block(
      width: 100%,
      fill: sunken,
      inset: (x: 7pt, y: 5pt),
      radius: 2pt,
      raw(rule.text, block: true),
    ))
    v(3pt)
    diagram(rule)
  })
}

#let th(body) = text(
  font: faces.sans,
  size: 7.5pt,
  weight: "bold",
  fill: muted,
  body,
)
/// A header row. A repeated header is a PDF artifact, which may hold no link, so a header that
/// cites (`at`) does not repeat.
#let head(..cells, repeat: true) = table.header(
  repeat: repeat,
  ..cells.pos().map(th),
)
#let code(body) = mono(size: 7.6pt, body)
#let strong-code(body) = mono(size: 7.6pt, weight: "bold", body)

// ---------------------------------------------------------------- the document

#show: spec.with(
  title: t("spec.title"),
  lang: if zh { "zh" } else { "en" },
  region: if edition == "zh-Hans" { "CN" } else if edition == "zh-Hant" {
    "TW"
  } else { none },
  faces: faces,
  keywords: (
    "IDS",
    "ideographic description sequence",
    "zi.tools",
    "白式",
    "EBNF",
  ),
  author: "mkpoli",
  running: t("spec.title"),
)
// A compatibility ideograph stays itself: the shaper would draw a font's unified ideograph in its
// place (者 for U+FA5B), so these take the fallback faces that have them.
#show regex("[\u{F900}-\u{FAFF}\u{2F800}-\u{2FA1F}]"): set text(font: (
  "Plangothic P1",
  "Jigmo",
  "Jigmo2",
))

#{
  set par(justify: false)
  v(30mm)
  text(font: faces.sans, size: 22pt, weight: "bold", t("spec.title"))
  v(4mm)
  text(font: faces.sans, size: 12pt, fill: soft, t("spec.subtitle"))
  v(14mm)
  let facts = (
    (t("spec.edition"), edition-number),
    (t("spec.date"), sys.inputs.at("date", default: "")),
    (
      t("spec.data"),
      link(D.DATABASE.tree, mono(
        "yi-bai/ids " + D.DATABASE.commit,
      ))
        + [ (#D.DATABASE.date)],
    ),
    (
      t("spec.source"),
      link("https://github.com/mkpoli/ids-input/tree/" + commit, mono(
        "mkpoli/ids-input " + commit + if dirty { "-dirty" } else { "" },
      )),
    ),
  )
  grid(columns: (auto, 1fr), column-gutter: 8mm, row-gutter: 3mm, ..facts
      .map(((name, value)) => (
        text(font: faces.sans, fill: muted, name),
        value,
      ))
      .flatten())
  v(14mm)
  block(width: 100%, text(size: 10.5pt, t("baishi.lead", date: D.GUIDE.date)))
  v(1fr)
  text(size: 8pt, fill: muted, t(
    "spec.follows",
    url: "https://ids.mkpo.li/baishi",
  ))
}

#pagebreak()
#outline(title: t("baishi.contents"), depth: 2)
#pagebreak()

= #t("baishi.heading.rows") <rows>
#t("baishi.row.body")
#grammar((
  "row",
  "headword",
  "tab",
  "primary group",
  "alternative group",
  "entry",
))
#said("rowGroups", ("I26", "§3.1"))
#said("rowVariants", ("I26", "§4.2"))
#examples("row")

= #t("baishi.heading.operators") <operators>
#t("baishi.operators.body") #at(("I26", "§2.1"))

#table(
  columns: (auto, auto, 1fr, auto, auto),
  align: horizon,
  table.header(
    th(t("baishi.operators.char")),
    th(t("baishi.operators.code") + " · " + t("baishi.operators.key")),
    th(t("baishi.operators.meaning")),
    table.cell(colspan: 2, th(t("baishi.operators.example"))),
  ),
  ..D
    .OPERATORS
    .map(((op, code-point, key, meaning, example-char, example-text)) => (
      char(op, size: 13pt),
      code("U+" + code-point) + linebreak() + code(key),
      {
        hans(meaning)
        let rendering = gloss("idc." + op)
        if rendering != "" {
          [ ]
          text(fill: soft, rendering)
        }
      },
      char(example-char, size: 13pt),
      written(example-text),
    ))
    .flatten(),
)
#t("baishi.operators.arity")
#grammar((
  "ids",
  "component",
  "unary operator",
  "binary operator",
  "overlap operator",
  "indexed operator",
  "ternary operator",
))
#said("nest", ("I26", "§2.3"))
#said("u31ef", ("I26", "§2.1"))

= #t("baishi.heading.variants") <variants>
#t("baishi.variants.body")
#grammar(("component variant", "sequence variants"))
#said("tagUse", ("I26", "§4.2"))
#said("tagOmit", ("I26", "§4.2"))
#examples("tags")
#examples("lists")

#t("baishi.variants.kinds")
#grammar(("variant id", "style tag", "tag char", "lower letter"))
#text(fill: soft)[#badge("inference") #t("baishi.kind.order")]

#table(
  columns: (auto, 1fr),
  head(
    t("baishi.kind.name"),
    t("baishi.kind.pattern"),
    repeat: false,
  ),
  ..D
    .KINDS
    .map(((kind, pattern)) => (t("baishi.kind." + kind), code(pattern)))
    .flatten(),
)

== #t("baishi.heading.sources") <source-letters>
#grammar(("source letter",))
#table(
  columns: (auto, auto, 1fr),
  head(
    t("baishi.sources.letter"),
    t("baishi.sources.source"),
    [#t("baishi.sources.region") #at(("I26", "§4.3.1"))],
    repeat: false,
  ),
  ..D
    .SOURCES
    .map(((letter, source, region)) => (
      strong-code(letter),
      if source.starts-with(regex("[A-Z]")) { code(source) } else {
        hans(source)
      },
      if region.starts-with("@") {
        hans(D.QUOTES.at(region.slice(1)))
        let rendering = gloss(region.slice(1))
        if rendering != "" {
          linebreak()
          text(fill: soft, rendering)
        }
      } else { hans(region) },
    ))
    .flatten(),
)
#said("precedence", ("I26", "§4.3.1"))
#text(fill: muted, t("baishi.sources.order")) #code("Q>G>H>T>J>K>P>V>M>U>S>B")
#examples("precedence")

== #t("baishi.heading.ucv") <ucv-position>
#said("ucv", ("I26", "§4.3.2"))
#examples("ucv")

== #t("baishi.heading.imaginary") <imaginary-ucv>
#said("imaginary", ("I26", "§4.3.2"))
#examples("imaginary")

== #t("baishi.heading.alternate") <alternate>
#said("alternate", ("I26", "§4.3.3"))
#table(
  columns: (auto, 1fr),
  head(
    t("baishi.alternate.letter"),
    [#t("baishi.alternate.gloss") #at(("I26", "§4.3.3"))],
    repeat: false,
  ),
  ..D
    .STYLE_LETTERS
    .map(((letter, gloss-text)) => (
      strong-code(letter),
      {
        hans(gloss-text)
        let rendering = gloss("style." + letter)
        if rendering != "" {
          [ ]
          text(fill: soft, rendering)
        }
      },
    ))
    .flatten(),
)
#said("compose", ("I26", "§4.3.3"))
#examples("alternate")

== #t("baishi.heading.other") <other>
#examples("other")
#said("custom", ("I26", "§4.3.5"))

= #t("baishi.heading.chains") <chains>
#said("chainWhy", ("I26", "§5.1"))
#t("baishi.chains.body")
#grammar(("stroke chain", "stroke part", "stroke"))
#said("chain", ("I26", "§5.2"))

== #t("baishi.heading.letters") <letters>
#grammar(("stroke letter",))
#table(
  columns: (auto, auto, 1fr),
  head(
    t("baishi.letters.letter"),
    t("baishi.letters.stroke"),
    [#t("baishi.alternate.gloss") #at(("I26", "§5.3"))],
    repeat: false,
  ),
  ..D
    .STROKE_LETTERS
    .map(((letter, stroke, gloss-text)) => (
      strong-code(letter),
      char(stroke, size: 13pt),
      {
        if gloss-text != "" {
          hans(gloss-text)
          let rendering = gloss("stroke." + letter)
          if rendering != "" {
            [ ]
            text(fill: soft, rendering)
          }
        }
      },
    ))
    .flatten(),
)
#said("clockwise", ("I26", "§5.3"))

== #t("baishi.heading.modifiers") <modifiers>
#examples("modifiers")

== #t("baishi.heading.characters") <characters>
#t("baishi.characters.body") #at(("I26", "§9"))
#grammar(("ideograph char", "taggable char", "hanzi", "cjk stroke", "curve"))
#examples("katakana")

== #t("baishi.heading.compounds") <compounds>
#at(("I26", "§5.3"))
#grid(
  columns: (1fr,) * 5, gutter: 4pt,
  ..D.COMPOUNDS.map(((c, chain)) => block(
    width: 100%,
    inset: (x: 5pt, y: 4pt),
    radius: 2pt,
    stroke: 0.6pt + rule-color,
    grid(
      columns: (auto, 1fr),
      column-gutter: 5pt,
      align: horizon,
      char(c, size: 13pt), ids-text(text(size: 8.4pt, chain)),
    ),
  )),
)

== #raw("-") #t("baishi.heading.reverse") <reverse>
#grammar(("reversal",))
#said("reverse", ("I26", "§5.3"))
#examples("reverse")

== #raw("x") #t("baishi.heading.cross") <cross>
#grammar(("crossing",))
#said("cross", ("I26", "§5.3"))
#examples("cross")

== #raw("b") #t("baishi.heading.break") <break-mark>
#grammar(("break",))
#said("break", ("I26", "§5.3"))
#examples("break")

== #raw("z") #t("baishi.heading.closed") <closing>
#said("closed", ("I26", "§5.3"))
#examples("closed")

== #t("baishi.heading.curves") <curves>
#t("baishi.curves.body") #at(("I26", "§5.3"))

= #t("baishi.heading.overlap") <overlap>
#said("roles", ("I26", "§6.1"))
#t("baishi.overlap.body")
#grammar(("overlap modifier", "overlap spec"))

== #t("baishi.heading.slice") <quick-slice>
#grammar((
  "slice",
  "slice bound",
  "number",
  "negative number",
  "nonzero digit",
  "digit",
))
#said("slice", ("I26", "§6.2"))
#said("sliceTouch", ("I26", "§6.2.1"))
#said("sliceCount", ("I26", "§6.2.1"))
#said("sign", ("I26", "§6.2.2"))
#said("sliceTop", ("I26", "§6.2.3"))
#said("sliceBottom", ("I26", "§6.2.3"))
#table(
  columns: (auto, auto, 1fr),
  head(
    t("baishi.slice.char"),
    [#t("baishi.slice.written") #at(("I26", "§6.2.4"))],
    t("baishi.slice.wrong"),
    repeat: false,
  ),
  ..D
    .SLICES
    .map(((c, form, wrong)) => (
      char(c, size: 13pt),
      written(form),
      text(fill: muted, wrong.map(written).join()),
    ))
    .flatten(),
)
#said("you", ("I26", "§3.1"))

== #t("baishi.heading.matrix") <matrix>
#grammar(("crossing matrix", "matrix row", "matrix cell"))
#t("baishi.matrix.body") #at(("I26", "§6.3"))

#table(
  columns: (auto, 1fr),
  head(t("baishi.matrix.cell"), t("baishi.matrix.means")),
  ..D
    .CELLS
    .map(((cell, meaning)) => (
      strong-code(cell),
      if meaning.starts-with("@") {
        hans(D.QUOTES.at(meaning.slice(1)))
        let rendering = gloss(meaning.slice(1))
        if rendering != "" {
          linebreak()
          text(fill: soft, rendering)
        }
      } else { t("baishi." + meaning) },
    ))
    .flatten(),
)
#t("baishi.matrix.simplify") #at(("I26", "§6.3"))
#said("slicePython", ("I26", "§6.3"))

#block[
  #text(fill: muted, t("baishi.matrix.qu"))
  #D.QU_STEPS.map(code).join(text(fill: muted, " → "))
  #at(("I26", "§6.3"))
]
#said("qu", ("I26", "§6.3"))
#examples("segments")
#examples("matrix")

== #t("baishi.heading.reverseMatrix") <reverse-matrix>
#t("baishi.reverseMatrix.body")
#said("reverseMatrix", ("I26", "§6.4"))
#examples("reverseMatrix")

== #t("baishi.heading.curveCase") <curveCase>
#examples("curveCase")

= #t("baishi.heading.index") <index>
#grammar(("index modifier",))
#said("index", ("I26", "§6.6"))
#said("indexHalf", ("I26", "§6.6"))
#examples("index")

= #t("baishi.heading.subtract") #badge("searchOnly") <subtract>
#said("subtract", ("I26", "§6.7"))
#table(
  columns: (auto, auto, 1fr),
  head(
    [#t("baishi.subtract.ids") #at(("I26", "§6.7"))],
    t("baishi.subtract.char"),
    t("baishi.subtract.which"),
    repeat: false,
  ),
  ..D
    .SUBTRACTIONS
    .map(((source, c, which)) => (
      written(source),
      char(c, size: 13pt),
      {
        hans(D.QUOTES.at(which))
        let rendering = gloss(which)
        if rendering != "" {
          [ ]
          text(fill: soft, rendering)
        }
      },
    ))
    .flatten(),
)
#said("subtractSearch", ("I26", "§6.7"))
#said("subtractChain", ("I26", "§6.7"))

= #t("baishi.heading.prefix") <prefix>
#grammar(("uniqueness prefix",))
#said("unique", ("I26", "§7.1"))
#said("uniqueRare", ("I26", "§7.1"))
#said("uniqueStroke", ("I26", "§7.1"))
#said("uniqueQuestion", ("I26", "§7.1"))
#said("uniqueSource", ("I26", "§7.1"))
#said("abstract", ("I26", "§7.1"))
#link(D.DATABASE.abstractShape) #at(("I26", "§7.1"))
#examples("unique")

= #hans-sans("🔄") #t("baishi.heading.replace") #badge("searchOnly") <replace>
#said("replace", ("I26", "§3.2"))
#examples("replace")

= #t("baishi.heading.levels") <levels>
#t("baishi.levels.body") #at(("I26", "§3.3"))
#said("lv0", ("I26", "§3.3"))
#said("lv1", ("I26", "§3.3"))
#said("lv2", ("I26", "§3.3"))
#said("lv1Merge", ("I26", "§7.2"))
#examples("merge")
#said("lv2Merge", ("I26", "§7.3"))
#examples("levels")

= #t("baishi.heading.data") <differences>
#t(
  "baishi.data.body",
  commit: D.DATABASE.commit.slice(0, 8),
  date: D.DATABASE.date,
  rows: D.DATABASE.rows,
  rejected: D.DATABASE.rejected,
)
#link(D.DATABASE.tree, mono(
  size: 7.6pt,
  "yi-bai/ids@" + D.DATABASE.commit.slice(0, 8),
))
#link(D.DATABASE.verified, mono(size: 7.6pt, "check_out.txt"))
#said("verify", ("I26", "§9"))

== #t("baishi.heading.malformed")
#table(
  columns: (auto, auto, 1fr),
  ..D
    .MALFORMED
    .map(((level, line, source, why)) => (
      code(level + " l." + str(line)),
      written(source.split("\t").at(1), after: text(fill: muted, hans(
        source.split("\t").at(0),
      ))),
      t("baishi." + why),
    ))
    .flatten(),
)

== #t("baishi.heading.dataDifferences")
#enum(..D.DATA_DIFFERENCES.map(((id, cites)) => [#t("baishi.datadiff." + id) #(
    cites.map(at).join(h(3pt))
  )]))

= #t("baishi.heading.unsettled") <unsettled>
#list(..D.UNSETTLED.map(id => [#badge("open") #t("baishi.unsettled." + id)]))

= #t("baishi.heading.ebnf") <ebnf>
#t("baishi.formal") #at(("I26", "§9"))

#block(width: 100%, fill: sunken, inset: 8pt, radius: 2pt, raw(
  read(
    "/data/baishi-ids"
      + (if edition == "en" { "" } else { "." + edition })
      + ".ebnf",
  ),
  block: true,
))
#table(
  columns: (auto, 1fr),
  ..D
    .SPECIAL
    .map(((sequence, meaning)) => (strong-code(sequence), code(meaning)))
    .flatten(),
)

== #t("baishi.heading.diagrams") <diagrams>
#for rule in D.rules [
  #block(width: 100%, breakable: false, above: 1em, {
    text(font: faces.mono, size: 7.6pt, weight: "bold", rule.name)
    v(2pt)
    diagram(rule)
  }) #label("rule-" + rule.file)
]

== #t("baishi.i26grammar") · I26 §9 <i26-grammar>
#said("ebnf", ("I26", "§9"))
#block(width: 100%, fill: sunken, inset: 8pt, radius: 2pt, raw(
  D.EBNF,
  block: true,
))

= #t("baishi.heading.documents") <sources>
#let entry(key, body, shown: none) = [
  #block(
    width: 100%,
    inset: (x: 7pt, y: 6pt),
    radius: 2pt,
    stroke: 0.6pt + rule-color,
    breakable: false,
    grid(
      columns: (11mm, 1fr),
      column-gutter: 6pt,
      mono(size: 7.6pt, weight: "bold", fill: accent, if shown == none {
        key
      } else { shown }),
      body,
    ),
  ) #label("doc-" + key)
]
#{
  entry(D.GUIDE.key, {
    set par(spacing: 0.4em, justify: false)
    text(weight: "bold", hans(D.GUIDE.title))
    parbreak()
    text(fill: soft, hans(D.GUIDE.people.join(" · ")))
    parbreak()
    (
      [#text(fill: muted, t("baishi.doc.version")) #hans(D.GUIDE.version)],
      link(D.GUIDE.repository + "/tree/" + D.GUIDE.commit, mono(
        size: 7.6pt,
        D.GUIDE.commit.slice(0, 8),
      )),
      D.GUIDE.licence,
    ).join(h(10pt))
    parbreak()
    link(D.GUIDE.url, text(size: 8pt, D.GUIDE.url))
    parbreak()
    link(D.GUIDE.repository, text(size: 8pt, D.GUIDE.repository))
    parbreak()
    text(fill: soft, t("baishi.doc.note.I26"))
  })
  entry("tools", shown: "EBNF", {
    set par(spacing: 0.4em, justify: false)
    for (title, url) in D.TOOLS {
      [#title #if url != "" { link(url, text(size: 8pt, url)) }]
      parbreak()
    }
  })
  entry("DB", {
    set par(spacing: 0.4em, justify: false)
    text(weight: "bold", t("baishi.heading.database"))
    parbreak()
    link(D.DATABASE.url, text(size: 8pt, D.DATABASE.url))
    parbreak()
    text(fill: soft)[#t(
        "baishi.database.note",
        version: D.DATABASE.version,
        date: D.DATABASE.date,
      ) #link(D.DATABASE.tree, mono(
        size: 7.6pt,
        D.DATABASE.commit.slice(0, 8),
      ))]
  })
}

= #t("baishi.heading.otherSources") <other-sources>
#t("baishi.other.body")
#for doc in D.OTHER_DOCUMENTS {
  entry(doc.key, {
    set par(spacing: 0.4em, justify: false)
    text(weight: "bold", hans(doc.title))
    [ ]
    badge(doc.kind)
    parbreak()
    text(fill: soft, hans(if doc.people.len() > 0 {
      doc.people.join(" · ")
    } else { "—" }))
    parbreak()
    let facts = ()
    if doc.version != "" {
      facts.push([#text(fill: muted, t("baishi.doc.version")) #hans(
          doc.version,
        )])
    }
    facts.push([#text(fill: muted, t("baishi.doc.date")) #doc.date #text(
        fill: muted,
      )[(#t("baishi.doc.fromFile"))]])
    facts.push(doc.extent)
    facts.join(h(10pt))
    parbreak()
    text(fill: soft, t("baishi.doc.note." + doc.key))
  })
}

== #t("baishi.heading.angles") #badge("proposal") <angles>
#t("baishi.angles.body")

#table(
  columns: (1fr, auto, auto),
  head(t("baishi.angles.form"), link(<doc-R101>)[R101], link(<doc-R102>)[R102]),
  ..D
    .ANGLES
    .map(((form, first, second)) => (written(form), code(first), code(second)))
    .flatten(),
)
#said("omit180", ("R101", "slide 4"))
#said("omitPm180", ("R102", "slide 4"))
#text(fill: soft)[#badge("inference") #t("baishi.angles.inference")]

== #t("baishi.heading.drafts") #badge("draft") <drafts>
#enum(..D.CHANGES.map(((id, cites)) => [#t("baishi.change." + id) #(
    cites.map(at).join(h(3pt))
  )]))
#t("baishi.drafts.variants")
#said("tagAfter", ("D1", "p.1"))
#said("tagEnd", ("D1", "p.1"))
#t("baishi.chainsHistory.letters")
#said("oldLetters", ("D1", "p.1"))
#said("oldConnector", ("D1", "p.2"))
#said("curveStart", ("D1", "p.2"))
#said("curveReverse", ("D1", "p.2"))
#t("baishi.chainsHistory.first")
#said("firstLetters", ("J22", "p.1"))
#said("firstJoins", ("J22", "p.1"))
#said("firstCurves", ("J22", "pp.1–2"))
#examples("firstChains", current: false)
#t("baishi.overlapHistory")
#said("oldMarks", ("D2", "p.4"))
#examples("oldMarks", current: false)

// ---------------------------------------------------------------- the edition's own sections
// The page ends above; the build compares the placements up to this line.

= #t("spec.licences") <licences>
#list(
  t("spec.licence.edition"),
  [#t("spec.licence.i26") #quoted("本文以 MIT 协议授权发布。") #at((
      "I26",
      "§10",
    ))],
  [#t("spec.licence.drafts") #quoted(
      "Copyright © 2024 Losketch, Yi-Bai, 等 | QQ群: 668364339",
    ) #at(("D3", "pp.1–5"))],
  [#t("spec.licence.data") #link(
      "https://github.com/yi-bai/ids/blob/2597437b928e8d530b7ae09cf53fe5ec7868569c/LICENSE",
    )[LICENSE] #at(("I26", "§1"))],
)

= #t("spec.typesetting") <typesetting>
#t("spec.typeset", version: typst-version) #link(
  "https://github.com/typst/typst/releases/tag/v" + typst-version,
  text(
    size: 8pt,
    "https://github.com/typst/typst/releases/tag/v" + typst-version,
  ),
)

#table(
  columns: (auto, 1fr),
  head(t("spec.font"), t("spec.font.use")),
  ..typefaces
    .map(font => (
      text(weight: "bold", font.name),
      {
        set par(spacing: 0.45em, leading: 0.45em, justify: false)
        t("spec.font.role." + font.role)
        parbreak()
        text(fill: soft, font.version + " · " + font.by + " · " + font.licence)
        parbreak()
        link(font.url, text(size: 7.6pt, font.url))
        if font.role == "serifFallback" {
          parbreak()
          (
            text(fill: soft, t("spec.font.glyphwiki"))
              + [ ]
              + link(
                "https://sources.debian.org/src/thunderbird/1%3A78.8.0-1~deb10u1/layout/reftests/fonts/glyphwiki-license.txt/",
                text(size: 7.6pt, "glyphwiki-license.txt"),
              )
          )
        }
      },
    ))
    .flatten(),
)
