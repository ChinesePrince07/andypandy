import { describe, expect, it } from 'vitest'

import { bearerTokenMatches, buildInstallPlist, slugify, upsertAppEntry, type IosApp } from './ios-apps'

function app(overrides: Partial<IosApp> = {}): IosApp {
  return {
    slug: 'andy-swiss-knife',
    appName: 'Andy Swiss Knife',
    bundleId: 'nsk-596.v-team.cn',
    version: '1.2.0',
    build: '42',
    ipaKey: 'apps/andy-swiss-knife/App.ipa',
    iconKey: 'apps/andy-swiss-knife/icon.png',
    sizeBytes: 1234,
    uploadedAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }
}

describe('slugify', () => {
  it('lowercases, hyphenates, strips junk', () => {
    expect(slugify('Andy Swiss Knife!')).toBe('andy-swiss-knife')
    expect(slugify('  My__App  ')).toBe('my-app')
  })
  it('falls back to "app" for empty input', () => {
    expect(slugify('***')).toBe('app')
  })
})

describe('upsertAppEntry (keep-latest, one entry per slug)', () => {
  it('adds a new app', () => {
    const m = upsertAppEntry({ version: 1, apps: [] }, app())
    expect(m.apps).toHaveLength(1)
    expect(m.apps[0].slug).toBe('andy-swiss-knife')
  })
  it('replaces the existing entry with the same slug', () => {
    const first = upsertAppEntry({ version: 1, apps: [] }, app({ build: '1' }))
    const second = upsertAppEntry(first, app({ build: '2', appName: 'Renamed' }))
    expect(second.apps).toHaveLength(1)
    expect(second.apps[0].build).toBe('2')
    expect(second.apps[0].appName).toBe('Renamed')
  })
  it('does not mutate the input manifest', () => {
    const input = { version: 1 as const, apps: [] }
    upsertAppEntry(input, app())
    expect(input.apps).toHaveLength(0)
  })
})

describe('buildInstallPlist', () => {
  it('produces a software-package asset pointing at the ipa url', () => {
    const xml = buildInstallPlist(app(), 'https://r2.example/App.ipa', 'https://r2.example/icon.png')
    expect(xml).toContain('<string>software-package</string>')
    expect(xml).toContain('<string>https://r2.example/App.ipa</string>')
    expect(xml).toContain('<key>bundle-identifier</key>')
    expect(xml).toContain('<string>nsk-596.v-team.cn</string>')
    expect(xml).toContain('<string>1.2.0</string>')
    expect(xml).toContain('<string>display-image</string>')
    expect(xml.startsWith('<?xml')).toBe(true)
  })
  it('omits image assets when no icon url', () => {
    const xml = buildInstallPlist(app({ iconKey: null }), 'https://r2.example/App.ipa', null)
    expect(xml).not.toContain('display-image')
    expect(xml).toContain('software-package')
  })
  it('xml-escapes the title', () => {
    const xml = buildInstallPlist(app({ appName: 'A & B <X>' }), 'https://r2.example/App.ipa', null)
    expect(xml).toContain('A &amp; B &lt;X&gt;')
  })
})

describe('bearerTokenMatches', () => {
  it('matches a correct Bearer token', () => {
    expect(bearerTokenMatches('Bearer s3cret', 's3cret')).toBe(true)
  })
  it('rejects wrong/missing/empty', () => {
    expect(bearerTokenMatches('Bearer nope', 's3cret')).toBe(false)
    expect(bearerTokenMatches(null, 's3cret')).toBe(false)
    expect(bearerTokenMatches('Bearer x', '')).toBe(false)
  })
})
