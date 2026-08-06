export type MinMaxShapeKind = 'Point' | 'Polygon' | string

export type MinMaxCoordinate = {
  longitude: number
  latitude: number
}

export type MinMaxShape = {
  id: string
  kind: MinMaxShapeKind
  sortOrder: number | string
  points: MinMaxCoordinate[]
}

export type MinMaxItem = {
  id: string
  slug: string
  category: string
  sortOrder: number | string
  title: string
  subtitle?: string | null
  typeLabel?: string | null
  valueLabel?: string | null
  summary?: string | null
  mapNote?: string | null
  facts: string[]
  shapes: MinMaxShape[]
}

const categoryLabels: Record<string, { en: string; cs: string }> = {
  countries: { en: 'Countries', cs: 'Státy' },
  islands: { en: 'Islands', cs: 'Ostrovy' },
  mountains: { en: 'Mountains', cs: 'Hory' },
  water: { en: 'Water', cs: 'Voda' },
  extremes: { en: 'Extremes', cs: 'Extrémy' },
  general: { en: 'General', cs: 'Obecné' },
}

export function normalizeMinMaxLanguage(language: string) {
  return language.trim().toLowerCase().split('-')[0] || 'en'
}

export function minMaxCategoryLabel(category: string, language: string) {
  const normalizedLanguage = normalizeMinMaxLanguage(language)
  const label = categoryLabels[category]
  if (label) {
    return label[normalizedLanguage as 'en' | 'cs'] ?? label.en
  }

  return category
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ') || category
}

export function minMaxCategories(items: readonly MinMaxItem[]) {
  const categories = new Set(items.map((item) => item.category))
  return [...categories].sort((left, right) => {
    const preferredOrder = ['mountains', 'water', 'countries', 'islands', 'extremes', 'general']
    const leftIndex = preferredOrder.indexOf(left)
    const rightIndex = preferredOrder.indexOf(right)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
    }

    return left.localeCompare(right)
  })
}
