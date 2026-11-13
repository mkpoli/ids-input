import { describe, expect, it } from 'bun:test'
import {
  assertDocument, carriedMore, createDocumentSession, fillColour, fromSequence, readDocument, readShareDocument,
  renderScopes, replaceNode, scopesSvg, shareDocument, syncDocument, toSequence, writeDocument,
} from '../src/document/index.js'
import { fillColourOf, hexOf, percentOf, readRgba, toHsva } from '../demo/lib/fill-editor.js'

const identity = [1, 0, 0, 1, 0, 0]
const square = (d = 'M0 0L10 0L10 10L0 10Z', cut = false) => ({ d, fillRule: cut ? 'evenodd' : 'nonzero', cut })
const source = pieces => ({ geometry: () => ({ pieces }), placement: () => identity })

/** @param {string} sequence */
function filled(sequence) {
  const document = fromSequence(sequence)
  const walk = node => {
    if (node.kind === 'component') node.fill = { type: 'solid', colour: '#b42318cc' }
    else if (node.kind === 'operator') node.children.forEach(walk)
    else if (node.kind === 'group') walk(node.child)
  }
  walk(document.root)
  return document
}

describe('a fill in the document', () => {
  it('round-trips through the file and leaves the sequence alone', () => {
    const document = filled('⿰木口')
    const text = writeDocument(document)
    const read = readDocument(text)
    expect(read.root.children[0].fill).toEqual({ type: 'solid', colour: '#b42318cc' })
    expect(toSequence(read.root)).toBe('⿰木口')
    expect(text).toContain('"fill"')
  })

  it('belongs to a component only', () => {
    const document = fromSequence('⿰木口')
    document.root.fill = { type: 'solid', colour: '#000000' }
    expect(() => assertDocument(document)).toThrow('unknown field')
    const slot = fromSequence('⬚')
    slot.root.fill = { type: 'solid', colour: '#000000' }
    expect(() => assertDocument(slot)).toThrow('unknown field')
  })

  it('refuses another type, an unknown field and a colour that is not hex', () => {
    for (const fill of [{ type: 'linear', colour: '#000000' }, { type: 'solid', colour: 'red' }, { type: 'solid', colour: '#000000', extra: true }]) {
      const document = fromSequence('木')
      document.root.fill = fill
      expect(() => assertDocument(document)).toThrow()
    }
    for (const colour of ['#abc', '#abcd', '#aabbcc', '#aabbccdd']) {
      const document = fromSequence('木')
      document.root.fill = { type: 'solid', colour }
      expect(() => assertDocument(document)).not.toThrow()
    }
  })

  it('keeps its fill when the component text changes and drops it when the layer is no longer a component', () => {
    const document = filled('⿰木口')
    const id = document.root.children[0].id
    const replaced = replaceNode(document, id, { kind: 'component', char: '水' })
    expect(replaced.root.children[0].fill).toEqual({ type: 'solid', colour: '#b42318cc' })
    const synced = syncDocument(replaced, { op: '⿰', parts: ['火', '口'] })
    expect(synced.root.children[0].char).toBe('火')
    expect(synced.root.children[0].fill).toEqual({ type: 'solid', colour: '#b42318cc' })
    const cleared = replaceNode(replaced, id, { kind: 'slot' })
    expect(cleared.root.children[0].fill).toBeUndefined()
  })

  it('travels in a share token', () => {
    const document = filled('⿰木口')
    delete document.root.children[1].fill
    expect(carriedMore(document)).toBe(true)
    const token = shareDocument(document)
    const read = readShareDocument(token)
    expect(toSequence(read.root)).toBe('⿰木口')
    const first = read.root.children[0]
    expect(first.fill).toEqual({ type: 'solid', colour: '#b42318cc' })
    expect(read.root.children[1].fill).toBeUndefined()
  })
})

describe('a fill in a session', () => {
  it('writes, clears and undoes as one layer edit', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    const id = session.document.root.children[0].id
    session.choose(id)
    session.setFill({ type: 'solid', colour: '#12345680' }, id)
    expect(session.document.root.children[0].fill).toEqual({ type: 'solid', colour: '#12345680' })
    expect(session.steps.done.at(-1)).toBe('Fill 木')
    expect(session.undo()).toBe(true)
    expect(session.document.root.children[0].fill).toBeUndefined()
    expect(session.redo()).toBe(true)
    expect(session.document.root.children[0].fill).toEqual({ type: 'solid', colour: '#12345680' })
    session.setFill(null, id)
    expect(session.document.root.children[0].fill).toBeUndefined()
  })

  it('coalesces the moves of one picker into one step', () => {
    const session = createDocumentSession(fromSequence('木'))
    const id = session.document.root.id
    session.setFill({ type: 'solid', colour: '#ff0000' }, id, { coalesce: 'pick-1' })
    session.setFill({ type: 'solid', colour: '#00ff00' }, id, { coalesce: 'pick-1' })
    session.setFill({ type: 'solid', colour: '#0000ff' }, id, { coalesce: 'pick-1' })
    expect(session.document.root.fill).toEqual({ type: 'solid', colour: '#0000ff' })
    expect(session.steps.done.filter(label => label === 'Fill 木')).toHaveLength(1)
  })

  it('refuses a fill on a layer that is not a component', () => {
    const session = createDocumentSession(fromSequence('⿰木口'))
    expect(() => session.setFill({ type: 'solid', colour: '#000000' }, session.document.root.id)).toThrow('only a component')
  })
})

describe('a fill in the drawing', () => {
  it('paints a filled component in its colour and the other in the ink', () => {
    const document = filled('⿰木口')
    delete document.root.children[1].fill
    const scopes = renderScopes(document, source([square()]))
    expect(scopes.root.children[0].fill).toEqual({ type: 'solid', colour: '#b42318cc' })
    expect(scopes.root.children[1].fill).toBeUndefined()
    const svg = scopesSvg(scopes, { ink: '#000000' })
    expect(svg).toContain('fill="#b42318"')
    expect(svg).toContain('opacity="0.8"')
    expect(svg).toContain('fill="#000000"')
    expect(fillColour({ type: 'solid', colour: '#b42318cc' }, 'currentColor')).toBe('#b42318cc')
    expect(fillColour({ type: 'solid', colour: 'red' }, 'currentColor')).toBe('currentColor')
    expect(fillColour(null, 'currentColor')).toBe('currentColor')
  })

  it('paints a cut component through its mask in the fill', () => {
    const document = filled('木')
    const scopes = renderScopes(document, source([square(), square('M2 2L8 2L8 8L2 8Z', true)]))
    const svg = scopesSvg(scopes)
    expect(svg).toContain('fill="#b42318" mask="url(#ids-m1)"')
  })

  it('composites a component’s pieces under one translucent fill', () => {
    const document = filled('木')
    document.root.fill = { type: 'solid', colour: '#b4231880' }
    const scopes = renderScopes(document, source([square(), square('M20 0L30 0L30 10L20 10Z')]))
    const svg = scopesSvg(scopes)
    expect(svg).toContain('<g opacity="0.502"><path d="M0 0L10 0L10 10L0 10Z" fill="#b42318"')
    expect(svg.match(/fill="#b42318"/g)).toHaveLength(2)
  })

  it('keeps evenodd pieces apart so their overlap stays filled', () => {
    const document = filled('木')
    document.root.fill = { type: 'solid', colour: '#b4231880' }
    const evenodd = (d) => ({ d, fillRule: 'evenodd', cut: false })
    const scopes = renderScopes(document, source([evenodd('M0 0L10 0L10 10L0 10Z'), evenodd('M5 0L15 0L15 10L5 10Z')]))
    const svg = scopesSvg(scopes)
    expect(svg.match(/fill="#b42318"/g)).toHaveLength(2)
    expect(svg.match(/<g opacity="0.502">/g)).toHaveLength(1)
  })
})

describe('the picker’s colour arithmetic', () => {
  it('reads six and eight digit hex, and rgb()', () => {
    expect(readRgba('#123456')).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 1 })
    expect(readRgba('#12345680')).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 128 / 255 })
    expect(readRgba('rgb(18 52 86)')).toEqual({ r: 18, g: 52, b: 86, a: 1 })
  })

  it('writes six digits when opaque and eight when translucent', () => {
    const opaque = toHsva({ ...readRgba('#b42318'), a: 1 })
    expect(fillColourOf(opaque)).toBe('#b42318')
    expect(hexOf(opaque)).toBe('#b42318')
    expect(percentOf(opaque)).toBe(100)
    const translucent = toHsva({ ...readRgba('#b42318'), a: 0.5 })
    expect(fillColourOf(translucent)).toBe('#b4231880')
    expect(hexOf(translucent)).toBe('#b42318')
    expect(percentOf(translucent)).toBe(50)
  })
})
