import { useMemo, useState, type ReactNode } from 'react'

type VirtualizedTableBodyProps<T> = {
  columnCount: number
  getRowClassName?: (item: T, index: number) => string | undefined
  getKey: (item: T, index: number) => string
  height: number
  items: readonly T[]
  onRowClick?: (item: T, index: number) => void
  overscan?: number
  renderRow: (item: T, index: number) => ReactNode
  rowHeight: number
}

export function VirtualizedTableBody<T>({
  columnCount,
  getRowClassName,
  getKey,
  height,
  items,
  onRowClick,
  overscan = 5,
  renderRow,
  rowHeight,
}: VirtualizedTableBodyProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const totalHeight = items.length * rowHeight
  const range = useMemo(() => {
    const firstVisibleIndex = Math.floor(scrollTop / rowHeight)
    const visibleCount = Math.ceil(height / rowHeight)
    const startIndex = Math.max(firstVisibleIndex - overscan, 0)
    const endIndex = Math.min(firstVisibleIndex + visibleCount + overscan, items.length)

    return {
      bottomPadding: Math.max(totalHeight - endIndex * rowHeight, 0),
      endIndex,
      startIndex,
      topPadding: startIndex * rowHeight,
    }
  }, [height, items.length, overscan, rowHeight, scrollTop, totalHeight])

  return (
    <tbody
      className="virtualized-table-body"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{ maxHeight: height }}
    >
      {range.topPadding > 0 && (
        <tr aria-hidden="true" className="virtualized-table-spacer-row">
          <td colSpan={columnCount} style={{ height: range.topPadding }} />
        </tr>
      )}
      {items.slice(range.startIndex, range.endIndex).map((item, localIndex) => {
        const index = range.startIndex + localIndex

        return (
          <tr
            className={getRowClassName?.(item, index)}
            key={getKey(item, index)}
            onClick={onRowClick ? () => onRowClick(item, index) : undefined}
          >
            {renderRow(item, index)}
          </tr>
        )
      })}
      {range.bottomPadding > 0 && (
        <tr aria-hidden="true" className="virtualized-table-spacer-row">
          <td colSpan={columnCount} style={{ height: range.bottomPadding }} />
        </tr>
      )}
    </tbody>
  )
}
