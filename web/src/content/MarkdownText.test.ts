import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from './MarkdownText'
import { htmlToText, sanitizeLinkHref } from './markdownHelpers'

describe('MarkdownText helpers', () => {
  it('rejects unsafe link protocols', () => {
    expect(sanitizeLinkHref('javascript:alert(1)')).toBeNull()
    expect(sanitizeLinkHref('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('keeps safe links', () => {
    expect(sanitizeLinkHref('https://example.com')).toBe('https://example.com')
    expect(sanitizeLinkHref('/entries/edict-of-milan')).toBe('/entries/edict-of-milan')
  })

  it('extracts readable text from html without executable content', () => {
    expect(htmlToText('<strong>Readable</strong><script>alert(1)</script>')).toBe('Readable')
  })

  it('renders markdown tables and task lists without raw html', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownText, { markdown: '| A | B |\n| - | - |\n| one | two |\n\n- [x] done' }),
    )

    expect(html).toContain('<table>')
    expect(html).toContain('one')
    expect(html).toContain('type="checkbox"')
  })
})
