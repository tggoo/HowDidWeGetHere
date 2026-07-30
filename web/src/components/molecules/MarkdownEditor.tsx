import { useRef } from 'react'
import { MarkdownText } from '../../content/MarkdownText'

type MarkdownEditorProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ label, value, onChange }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function applyMarkdown(before: string, after = '', placeholder = 'text') {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(`${value}${before}${placeholder}${after}`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(nextValue)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function applyList(prefix: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(`${value}\n${prefix}item`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || 'item'
    const formatted = selected
      .split(/\r?\n/)
      .map((line) => `${prefix}${line || 'item'}`)
      .join('\n')
    const nextValue = `${value.slice(0, start)}${formatted}${value.slice(end)}`
    onChange(nextValue)
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start, start + formatted.length)
    })
  }

  return (
    <div className="markdown-editor">
      <span>{label}</span>
      <div className="markdown-toolbar" aria-label={`${label} Markdown tools`}>
        <button type="button" onClick={() => applyMarkdown('**', '**', 'bold')}>
          B
        </button>
        <button type="button" onClick={() => applyMarkdown('*', '*', 'italic')}>
          I
        </button>
        <button type="button" onClick={() => applyList('- ')}>
          List
        </button>
        <button type="button" onClick={() => applyList('1. ')}>
          1.
        </button>
        <button type="button" onClick={() => applyMarkdown('[', '](https://example.com)', 'link')}>
          Link
        </button>
        <button type="button" onClick={() => applyMarkdown('`', '`', 'code')}>
          Code
        </button>
      </div>
      <div className="markdown-editor-grid">
        <textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} />
        <div className="markdown-preview" aria-label={`${label} preview`}>
          <MarkdownText markdown={value || '_Preview_'} />
        </div>
      </div>
    </div>
  )
}
