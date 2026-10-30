import { describe, expect, it } from 'bun:test'
import { metaFor, pathOf, routeFor } from '../worker/page.js'
import { linkTo } from '../demo/lib/share.js'

const route = path => routeFor(new URL(path, 'https://ids.mkpo.li'), '⿰木口')

describe('Pages sequence routing', () => {
  it('uses direct paths and the same query fallback as the editor', () => {
    for (const sequence of ['⿰釒哥', '⿰木.', '..', 'a/b', '木?口', '木#口', '木&口']) {
      expect(new URL(pathOf(sequence), 'https://ids.mkpo.li').href).toBe(linkTo(sequence, new URL('https://ids.mkpo.li')))
      expect(route(pathOf(sequence))).toEqual({ kind: 'page', sequence })
      expect(route(`/og/${encodeURIComponent(sequence)}.png`)).toEqual({ kind: 'card', sequence })
    }
  })
  it('leaves root, files, nested assets, and Pages HTML routes to the assets binding', () => {
    for (const path of ['/', '/robots.txt', '/favicon.svg', '/assets/app.js', '/og/fonts/a.ttf', '/og/data/a.json.gz', '/embed', '/compare', '/engines', '/engines/', '/embed/', '/index.html', '/s/⿰木口']) {
      expect(route(path)).toEqual({ kind: 'asset' })
    }
  })
  it('handles trailing slashes and default cards', () => {
    expect(route('/⿰木口/')).toEqual({ kind: 'page', sequence: '⿰木口' })
    expect(route('/og/default.png')).toEqual({ kind: 'card', sequence: '⿰木口' })
  })
  it('bounds work before rendering and never silently truncates a sequence', () => {
    expect(route('/' + '木'.repeat(200)).sequence).toBe('木'.repeat(200))
    expect(route('/' + '木'.repeat(201)).status).toBe(414)
    expect(route('/?ids=' + 'a'.repeat(201)).status).toBe(414)
    expect(route('/og/' + 'a'.repeat(201) + '.png').status).toBe(414)
    expect(route('/?doc=' + 'a'.repeat(17000)).status).toBe(414)
    for (const path of ['/bad%ZZ', '/og/bad%FF.png', '/%00', '/?ids=%0A', '/og/%7F.png']) expect(route(path).status).toBe(400)
  })
  it('keeps document and tracking query parameters out of sequence metadata', () => {
    expect(route('/⿰木口?doc=anything&ids=other')).toEqual({ kind: 'page', sequence: '⿰木口' })
    const { tags } = metaFor({ sequence: 'a/b', char: null, origin: 'https://ids.mkpo.li' })
    expect(tags).toContain('href="https://ids.mkpo.li/?ids=a%2Fb"')
    expect(tags).toContain('content="https://ids.mkpo.li/og/a%2Fb.png"')
  })
})
