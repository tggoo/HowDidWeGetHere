import { Layers } from 'lucide-react'
import {
  worldDivisionCategories,
  worldDivisionText,
  type WorldDivision,
  type WorldDivisionCategoryId,
} from '../../features/worldDivisions/worldDivisions'

export type WorldDivisionsExplorerLabels = {
  category: string
  title: string
}

type WorldDivisionsExplorerProps = {
  activeCategoryId: WorldDivisionCategoryId
  divisions: readonly WorldDivision[]
  labels: WorldDivisionsExplorerLabels
  language: string
  selectedDivisionId: string | null
  onSelectCategory: (categoryId: WorldDivisionCategoryId) => void
  onSelectDivision: (divisionId: string) => void
}

export function WorldDivisionsExplorer({
  activeCategoryId,
  divisions,
  labels,
  language,
  onSelectCategory,
  onSelectDivision,
  selectedDivisionId,
}: WorldDivisionsExplorerProps) {
  return (
    <div className="filter-block world-divisions-block">
      <div className="filter-title">
        <Layers aria-hidden="true" />
        <span>{labels.title}</span>
      </div>

      <div className="world-division-tabs" role="tablist" aria-label={labels.category}>
        {worldDivisionCategories.map((category) => (
          <button
            className={activeCategoryId === category.id ? 'world-division-tab active' : 'world-division-tab'}
            key={category.id}
            type="button"
            aria-selected={activeCategoryId === category.id}
            role="tab"
            onClick={() => onSelectCategory(category.id)}
          >
            {worldDivisionText(category.title, language)}
          </button>
        ))}
      </div>

      <div className="world-division-list" aria-label={labels.title}>
        {divisions.map((division) => (
          <button
            className={division.id === selectedDivisionId ? 'world-division-item active' : 'world-division-item'}
            key={division.id}
            type="button"
            onClick={() => onSelectDivision(division.id)}
          >
            <span className="world-division-swatch" aria-hidden="true" />
            <span>
              <strong>{worldDivisionText(division.title, language)}</strong>
              <small>{worldDivisionText(division.subtitle, language)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
