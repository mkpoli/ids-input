// The audit view for data/donor-parts.json: every character the build shipped, its glyph
// cut into the parts its description names, drawn layer by layer so a reader can say
// whether the cut and the labels are right. Verdicts are kept in this browser and can be
// copied out as JSON.
import '../design/index.css'
import '../fonts/fonts.css'
import './donor-review.css'
import data from '../data/donor-parts.json'

const STORE = 'ids-input:donor-review'
const PALETTE = ['#d02020', '#2f6db5', '#2f8a4a', '#a06a10', '#8a3fa0', '#1f8a8a', '#b0447a', '#555555']
// The pieces figure has no description behind it, so it uses its own hues: a colour
// never means two things across two figures of one row.
const PIECE_PALETTE = ['#e0b000', '#1f7a7a', '#7a3fb0', '#c24a1a', '#3b5bbf', '#6a8a1f', '#b02f6a',
  '#2f2f2f', '#8a6a00', '#0f9b9b', '#4a2a80', '#e0714a', '#6f86d6', '#9fb84a', '#d47aa0', '#767682']

/** A path arrives as a list of contours of commands, or as one contour. */
const contoursOf = path => (typeof path[0][0] === 'string' ? [path] : path)
/** SVG path data: M and L take a point, Q two, C three, Z none. */
const d = path => contoursOf(path).flat().map(([op, ...numbers]) => op + numbers.join(' ')).join(' ')

/** `{42} 彐` as the description itself writes it: `{42}`. */
const rawOf = label => label.replace(/^(\{\d+\})\s.*$/u, '$1')
/** How many elements an operand of the description ends in. */
const elementsIn = operand =>
  (rawOf(operand).match(/\{\d+\}|./gu) ?? []).filter(token => !/^[⿰-⿿㇯〾]$/u.test(token)).length

const verdicts = read()
function read() {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') } catch { return {} }
}

const state = { show: 'all' }

/** One figure: the parts of a row, each painted the colour its group was given. */
function figure(label, shapes, legend) {
  return `<svg viewBox="0 0 1000 1000" class="figure" aria-label="${label}">
      <g transform="translate(0 900) scale(0.8 -0.8)">${shapes}</g>
    </svg><p class="legend">${legend}</p>`
}

const swatch = (text, colour) => `<span style="color:${colour}">${text}</span>`

function row(entry) {
  const verdict = verdicts[entry.char]
  // The pieces figure: the font's own untouching outlines, one colour each.
  const pieces = entry.pieces
    .map((path, i) => `<path d="${d(path)}" fill="${PIECE_PALETTE[i % PIECE_PALETTE.length]}"/>`).join('')

  // The first layer: one colour per operand of the outer operator. The operands take the
  // description's elements in order, so counting says which operand a part came out of —
  // where matching names would not, ⿱山山 being two operands with one name.
  const slots = [...new Set(entry.parts.map(part => part.leaf))]
  const operandOfSlot = entry.first.flatMap((operand, i) => Array(elementsIn(operand)).fill(i))
  const operandOf = leaf => operandOfSlot[slots.indexOf(leaf)] ?? 0
  const firstLayer = entry.parts
    .map(part => `<path d="${d(part.path)}" fill="${PALETTE[operandOf(part.leaf) % PALETTE.length]}"/>`)
    .join('')
  const firstLegend = entry.first.map((operand, i) => swatch(operand, PALETTE[i % PALETTE.length])).join(' · ')

  // The terminal layer: one colour per element the description ends in, a repeated
  // element counted once per occurrence so 山 over 山 is two colours.
  const leaves = [...new Set(entry.parts.map(part => part.leaf))]
  const colourOf = leaf => PALETTE[leaves.indexOf(leaf) % PALETTE.length]
  const terminalLayer = entry.parts
    .map(part => `<path d="${d(part.path)}" fill="${colourOf(part.leaf)}"/>`).join('')
  const terminalLegend = leaves.map(leaf => swatch(leaf, colourOf(leaf))).join(' · ')

  // The recursion: each terminal element spelled out by its own description, to the bottom.
  const branch = (node, depth) =>
    `<div style="padding-inline-start:${depth * 10}px">${node.leaf}</div>`
    + node.children.map(child => branch(child, depth + 1)).join('')
  const recursion = entry.recursive.map(node => branch(node, 0)).join('')

  const evidence = entry.ownFace
    ? `${entry.face}`
    : `${entry.face} · elements borrowed`
  return `<tr data-char="${entry.char}" class="${verdict ? `marked ${verdict}` : ''}">
    <td class="char">${entry.char}</td>
    <td class="ids">${entry.ids}<p class="legend">${evidence}<br>likeness ${entry.likeness ?? '—'}</p></td>
    <td class="fig">${figure(`${entry.char}, the pieces the font draws`, pieces,
      entry.pieces.map((_, i) => swatch(`piece ${i + 1}`, PIECE_PALETTE[i % PIECE_PALETTE.length])).join(' · '))}</td>
    <td class="fig">${figure(`${entry.char}, the operands of its outer operator`, firstLayer, firstLegend)}</td>
    <td class="fig">${figure(`${entry.char}, the elements its description ends in`, terminalLayer, terminalLegend)}</td>
    <td class="tree">${recursion}</td>
    <td class="vote"><div>
      <button type="button" data-vote="yes" aria-pressed="${verdict === 'yes'}">Right</button>
      <button type="button" data-vote="no" aria-pressed="${verdict === 'no'}">Wrong</button>
    </div></td>
  </tr>`
}

function render() {
  const shown = data.entries.filter(entry =>
    state.show === 'all' ? true
      : state.show === 'open' ? !verdicts[entry.char]
        : state.show === 'borrowed' ? !entry.ownFace
          : verdicts[entry.char] === state.show)
  const yes = data.entries.filter(entry => verdicts[entry.char] === 'yes').length
  const no = data.entries.filter(entry => verdicts[entry.char] === 'no').length
  // A face's version string carries its build tools after a semicolon; the version is enough.
  const faces = data.faces
    .map(face => `${face.name} ${face.version.split(';')[0].replace(/^Version /, '')}`).join(', ')

  document.getElementById('review').innerHTML = `
    <header>
      <h1>Donor parts review</h1>
      <p class="lede">Every character BabelStone describes as a vertical stack standing on 山.
        Each row works down from the font's own ink: the outlines it draws that do not touch
        each other, those same pieces grouped under the operands of the outer operator, then
        under the elements the description ends in, and last each of those elements spelled
        out by its own description. No boundary is drawn that the font does not already draw;
        the only question a row asks is whether each piece went to the right element.</p>
      <p class="lede">Shipped ${data.entries.length} of ${data.candidates} characters;
        ${data.skipped.length} were skipped, listed at the foot. Shapes from ${faces}.
        A row marked <em>elements borrowed</em> was recognised against another pinned face,
        because its own face does not draw 山; its likeness reading is lower for that reason
        alone, so those rows are worth a closer look.</p>
      <div class="controls">
        <div class="filter" role="group" aria-label="Which rows to show">
          ${[['all', 'All'], ['open', 'Undecided'], ['borrowed', 'Borrowed elements'], ['yes', 'Right'], ['no', 'Wrong']]
            .map(([key, text]) => `<button type="button" data-show="${key}" aria-pressed="${state.show === key}">${text}</button>`).join('')}
        </div>
        <p class="tally"><b class="ok">${yes}</b> right · <b class="bad">${no}</b> wrong ·
          ${data.entries.length - yes - no} undecided</p>
        <button type="button" id="copy" ${yes || no ? '' : 'disabled'}>Copy verdicts</button>
      </div>
    </header>
    <main>
      <table>
        <thead><tr>
          <th>Character</th><th>Description</th><th>Untouching pieces</th>
          <th>First layer</th><th>Terminal elements</th><th>Spelled out</th><th>Correct?</th>
        </tr></thead>
        <tbody>${shown.map(row).join('') || '<tr><td colspan="7" class="empty">No rows.</td></tr>'}</tbody>
      </table>
      <section class="skipped">
        <h2>Skipped</h2>
        <p class="lede">A character is skipped when its account does not close: no pinned face
          draws it, the glyph draws fewer pieces than the description has elements, a group of
          pieces does not look like the element it would belong to, or two readings fit equally
          well. Nothing here is guessed at.</p>
        <ul>${data.skipped.map(skip =>
          `<li><span class="char">${skip.char}</span> <code>${skip.ids}</code> ${skip.reason}</li>`).join('')}</ul>
      </section>
    </main>`
}

document.getElementById('review').addEventListener('click', event => {
  const vote = event.target.closest('button[data-vote]')
  if (vote) {
    const char = vote.closest('tr').dataset.char
    verdicts[char] = verdicts[char] === vote.dataset.vote ? undefined : vote.dataset.vote
    if (!verdicts[char]) delete verdicts[char]
    localStorage.setItem(STORE, JSON.stringify(verdicts))
    render()
    return
  }
  const filter = event.target.closest('button[data-show]')
  if (filter) {
    state.show = filter.dataset.show
    render()
    return
  }
  if (event.target.closest('#copy')) {
    navigator.clipboard.writeText(JSON.stringify(verdicts, null, 2))
  }
})

render()
