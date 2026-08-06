import { Mountain } from 'lucide-react'
import { minMaxCategoryLabel, type MinMaxItem } from '../../features/minMax/minMax'

export type MinMaxExplorerLabels = {
  category: string
  title: string
}

type MinMaxExplorerProps = {
  activeCategoryId: string
  categories: readonly string[]
  items: readonly MinMaxItem[]
  labels: MinMaxExplorerLabels
  language: string
  selectedItemId: string | null
  onSelectCategory: (categoryId: string) => void
  onSelectItem: (itemId: string) => void
}

export function MinMaxExplorer({
  activeCategoryId,
  categories,
  items,
  labels,
  language,
  onSelectCategory,
  onSelectItem,
  selectedItemId,
}: MinMaxExplorerProps) {
  return (
    <div className="filter-block world-divisions-block">
      <div className="filter-title">
        <Mountain aria-hidden="true" />
        <span>{labels.title}</span>
      </div>

      <div className="world-division-tabs" role="tablist" aria-label={labels.category}>
        {categories.map((category) => (
          <button
            className={activeCategoryId === category ? 'world-division-tab active' : 'world-division-tab'}
            key={category}
            type="button"
            aria-selected={activeCategoryId === category}
            role="tab"
            onClick={() => onSelectCategory(category)}
          >
            {minMaxCategoryLabel(category, language)}
          </button>
        ))}
      </div>

      <div className="world-division-list" aria-label={labels.title}>
        {items.map((item) => (
          <button
            className={item.id === selectedItemId ? 'world-division-item active' : 'world-division-item'}
            key={item.id}
            type="button"
            onClick={() => onSelectItem(item.id)}
          >
            <span className="world-division-swatch min-max-swatch" aria-hidden="true" />
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle ?? item.valueLabel ?? item.typeLabel ?? minMaxCategoryLabel(item.category, language)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
