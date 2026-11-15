// The look of the specification's PDF editions: A4, serif text, sans-serif headings and IDS, and
// the font stacks of each edition. scripts/build_spec_pdf.mjs fetches every family named here.

/// Colours, as the appendix page uses them in print.
#let ink = rgb("#1d2128")
#let soft = rgb("#4b5260")
#let muted = rgb("#6b7280")
#let accent = rgb("#1f5fa8")
#let rule-color = rgb("#d5d9df")
#let rule-strong = rgb("#9aa1ab")
#let sunken = rgb("#f3f4f6")

// Characters the Noto CJK subsets lack (⿼–⿿, ㇯, ㇥, Extensions B–J) come from Jigmo in serif text
// and Plangothic in sans-serif text; 🔄 from Noto Emoji's outlines; ◜◝◞◟ and ⇥ from DejaVu Sans Mono.
#let _serif-fallback = (
  "Jigmo",
  "Jigmo2",
  "Jigmo3",
  "Noto Emoji",
  "DejaVu Sans Mono",
)
#let _sans-fallback = (
  "Plangothic P1",
  "Plangothic P2",
  "Noto Emoji",
  "DejaVu Sans Mono",
)

/// The font stacks of an edition. `region` is "SC" or "TC", the Noto subset its prose is set in.
/// English keeps Libertinus Serif for all Latin text; the Chinese editions limit it to Latin
/// letters so that CJK punctuation stays in the CJK face.
///
/// - region (str): "SC" or "TC".
/// - latin-only (bool): whether Libertinus Serif covers only Latin within CJK text.
/// -> dictionary
#let fonts(region, latin-only) = {
  assert(
    region in ("SC", "TC"),
    message: "fonts: region is SC or TC, got " + region,
  )
  let latin = if latin-only {
    (name: "Libertinus Serif", covers: "latin-in-cjk")
  } else { "Libertinus Serif" }
  (
    // A Traditional Chinese text quoting Simplified forms takes them from the SC subset.
    serif: (latin, "Noto Serif " + region, "Noto Serif SC", .._serif-fallback),
    sans: ("Noto Sans " + region, "Noto Sans SC", .._sans-fallback),
    mono: (
      "DejaVu Sans Mono",
      "Noto Sans " + region,
      "Noto Sans SC",
      .._sans-fallback,
    ),
    // Quotations, document titles and IDS are Simplified Chinese in every edition.
    hans-serif: (
      (name: "Libertinus Serif", covers: "latin-in-cjk"),
      "Noto Serif SC",
      .._serif-fallback,
    ),
    hans-sans: ("Noto Sans SC", .._sans-fallback),
    hans-mono: ("DejaVu Sans Mono", "Noto Sans SC", .._sans-fallback),
  )
}

/// The document: metadata, page, type and headings.
///
/// - title (str): the title, also the PDF's.
/// - lang (str): "en" or "zh".
/// - region (str, none): "CN" or "TW" for Chinese.
/// - faces (dictionary): from `fonts`.
/// - keywords (array): PDF keywords.
/// - author (str): PDF author.
/// - running (str): the running head.
#let spec(
  title: "",
  lang: "en",
  region: none,
  faces: (:),
  keywords: (),
  author: "",
  running: "",
  body,
) = {
  set document(title: title, author: author, keywords: keywords)
  set text(
    lang: lang,
    region: region,
    font: faces.serif,
    size: 9.6pt,
    fill: ink,
  )
  let zh = lang == "zh"
  set par(
    justify: true,
    leading: if zh { 0.85em } else { 0.62em },
    spacing: if zh { 1.1em } else { 0.95em },
  )
  set page(
    paper: "a4",
    margin: (x: 21mm, top: 22mm, bottom: 22mm),
    header: context {
      if counter(page).get().first() > 1 {
        set text(font: faces.sans, size: 7.5pt, fill: muted)
        h(1fr)
        running
      }
    },
    footer: context {
      set text(font: faces.sans, size: 7.5pt, fill: muted)
      h(1fr)
      counter(page).display()
      h(1fr)
    },
  )
  set heading(numbering: "1.1")
  show heading: set text(font: faces.sans, fill: ink, weight: "bold")
  show heading.where(level: 1): set text(size: 15pt)
  show heading.where(level: 1): set block(above: 2.4em, below: 1em)
  show heading.where(level: 2): set text(size: 11pt)
  show heading.where(level: 2): set block(above: 1.6em, below: 0.8em)
  show heading.where(level: 3): set text(size: 9.6pt)
  show link: set text(fill: accent)
  show raw: set text(font: faces.mono, size: 7.6pt)
  set table(
    stroke: (_, y) => (bottom: 0.4pt + rule-color),
    inset: (x: 5pt, y: 4pt),
  )
  set list(indent: 0.6em)
  set enum(indent: 0.6em)
  body
}
