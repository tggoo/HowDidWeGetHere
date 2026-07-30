import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'

type VirtualizedListProps<T> = {
  ariaLabel?: string
  className?: string
  emptyState?: ReactNode
  getKey: (item: T, index: number) => string
  height: number
  itemHeight: number
  items: readonly T[]
  overscan?: number
  renderItem: (item: T, index: number) => ReactNode
}

export function VirtualizedList<T>({
  ariaLabel,
  className,
  emptyState,
  getKey,
  height,
  itemHeight,
  items,
  overscan = 4,
  renderItem,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const totalHeight = items.length * itemHeight
  const range = useMemo(() => {
    const firstVisibleIndex = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(height / itemHeight)
    const startIndex = Math.max(firstVisibleIndex - overscan, 0)
    const endIndex = Math.min(firstVisibleIndex + visibleCount + overscan, items.length)

    return {
      endIndex,
      offsetTop: startIndex * itemHeight,
      startIndex,
    }
  }, [height, itemHeight, items.length, overscan, scrollTop])

  if (items.length === 0) {
    return emptyState
  }

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role={ariaLabel ? 'list' : undefined}
      style={{ '--virtualized-list-height': `${height}px` } as CSSProperties}
    >
      <div className="virtualized-list-spacer" style={{ height: totalHeight }}>
        <div
          className="virtualized-list-window"
          style={{ transform: `translateY(${range.offsetTop}px)` }}
        >
          {items.slice(range.startIndex, range.endIndex).map((item, localIndex) => {
            const index = range.startIndex + localIndex

            return (
              <div className="virtualized-list-item" key={getKey(item, index)} style={{ height: itemHeight }}>
                {renderItem(item, index)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
