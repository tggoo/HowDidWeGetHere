import { Lexer } from 'marked'
import { Fragment, type ReactNode } from 'react'
import { htmlToText, sanitizeLinkHref } from './markdownHelpers'

type MarkdownTextProps = {
  markdown?: string | null
  className?: string
}

type MarkedToken = ReturnType<typeof Lexer.lex>[number]
type TableCellToken = {
  tokens?: MarkedToken[]
  text?: string
}
type TableToken = MarkedToken & {
  align?: Array<'center' | 'left' | 'right' | null>
  header?: TableCellToken[]
  rows?: TableCellToken[][]
}
type ListItemToken = MarkedToken & {
  checked?: boolean
  task?: boolean
  tokens?: MarkedToken[]
}

export function MarkdownText({ markdown, className }: MarkdownTextProps) {
  const source = markdown?.trim()
  if (!source) {
    return null
  }

  const classNames = ['markdown-text', className].filter(Boolean).join(' ')
  return <div className={classNames}>{renderBlocks(Lexer.lex(source, { gfm: true }))}</div>
}

function renderBlocks(tokens: MarkedToken[] | undefined): ReactNode[] {
  return (tokens ?? []).map((token, index) => renderBlock(token, `md-${index}`)).filter(Boolean)
}

function renderBlock(token: MarkedToken, key: string): ReactNode {
  switch (token.type) {
    case 'paragraph':
      return <p key={key}>{renderInline(token.tokens, key)}</p>
    case 'heading': {
      const Heading = `h${Math.min(Math.max(token.depth + 1, 2), 4)}` as 'h2' | 'h3' | 'h4'
      return <Heading key={key}>{renderInline(token.tokens, key)}</Heading>
    }
    case 'list': {
      const ListTag = token.ordered ? 'ol' : 'ul'
      return (
        <ListTag key={key} start={token.ordered ? token.start || undefined : undefined}>
          {token.items.map((item: ListItemToken, itemIndex) => (
            <li className={item.task ? 'task-list-item' : undefined} key={`${key}-item-${itemIndex}`}>
              {item.task && <input checked={item.checked ?? false} disabled readOnly type="checkbox" />}
              <span>{renderBlocks(item.tokens as MarkedToken[])}</span>
            </li>
          ))}
        </ListTag>
      )
    }
    case 'table':
      return renderTable(token as TableToken, key)
    case 'blockquote':
      return <blockquote key={key}>{renderBlocks(token.tokens as MarkedToken[])}</blockquote>
    case 'code':
      return (
        <pre key={key}>
          <code>{token.text}</code>
        </pre>
      )
    case 'hr':
      return <hr key={key} />
    case 'html': {
      const text = htmlToText(token.raw || token.text)
      return text ? <p key={key}>{text}</p> : null
    }
    case 'space':
      return null
    default: {
      const text = token.raw ? htmlToText(token.raw) : ''
      return text ? <p key={key}>{text}</p> : null
    }
  }
}

function renderInline(tokens: MarkedToken[] | undefined, keyPrefix: string): ReactNode[] {
  return (tokens ?? []).map((token, index) => {
    const key = `${keyPrefix}-inline-${index}`
    switch (token.type) {
      case 'text':
        return 'tokens' in token && token.tokens ? (
          <Fragment key={key}>{renderInline(token.tokens as MarkedToken[], key)}</Fragment>
        ) : (
          <Fragment key={key}>{token.text}</Fragment>
        )
      case 'strong':
        return <strong key={key}>{renderInline(token.tokens as MarkedToken[], key)}</strong>
      case 'em':
        return <em key={key}>{renderInline(token.tokens as MarkedToken[], key)}</em>
      case 'codespan':
        return <code key={key}>{token.text}</code>
      case 'br':
        return <br key={key} />
      case 'del':
        return <del key={key}>{renderInline(token.tokens as MarkedToken[], key)}</del>
      case 'link': {
        const children = renderInline(token.tokens as MarkedToken[], key)
        const href = sanitizeLinkHref(token.href)
        return href ? (
          <a href={href} key={key} rel="noopener noreferrer" target="_blank">
            {children}
          </a>
        ) : (
          <span key={key}>{children}</span>
        )
      }
      case 'image':
        return null
      case 'html': {
        const text = htmlToText(token.raw || token.text)
        return text ? <Fragment key={key}>{text}</Fragment> : null
      }
      default:
        return token.raw ? <Fragment key={key}>{htmlToText(token.raw)}</Fragment> : null
    }
  })
}

function renderTable(token: TableToken, key: string) {
  return (
    <div className="markdown-table-scroll" key={key}>
      <table>
        <thead>
          <tr>
            {(token.header ?? []).map((cell, index) => (
              <th key={`${key}-head-${index}`} style={tableCellStyle(token.align?.[index])}>
                {renderInline(cell.tokens, `${key}-head-${index}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(token.rows ?? []).map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-${cellIndex}`} style={tableCellStyle(token.align?.[cellIndex])}>
                  {renderInline(cell.tokens, `${key}-row-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function tableCellStyle(align: TableToken['align'] extends Array<infer T> ? T : never) {
  return align ? { textAlign: align } : undefined
}
