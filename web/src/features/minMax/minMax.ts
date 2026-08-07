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

export const allMinMaxCategoryId = 'all'

const categoryLabels: Record<string, { en: string; cs: string }> = {
  [allMinMaxCategoryId]: { en: 'All sections', cs: 'Všechny sekce' },
  countries: { en: 'Countries', cs: 'Státy' },
  extremes: { en: 'Extremes', cs: 'Extrémy' },
  general: { en: 'General', cs: 'Obecné' },
  islands: { en: 'Islands', cs: 'Ostrovy' },
  landforms: { en: 'Landforms', cs: 'Tvary reliéfu' },
  mountains: { en: 'Mountains', cs: 'Hory' },
  rivers: { en: 'Rivers', cs: 'Řeky' },
  water: { en: 'Water', cs: 'Voda' },
  waterfalls: { en: 'Waterfalls', cs: 'Vodopády' },
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
  const categories = new Set([allMinMaxCategoryId, ...items.map((item) => item.category)])
  return [...categories].sort((left, right) => {
    const preferredOrder = [
      allMinMaxCategoryId,
      'mountains',
      'water',
      'countries',
      'islands',
      'rivers',
      'waterfalls',
      'landforms',
      'extremes',
      'general',
    ]
    const leftIndex = preferredOrder.indexOf(left)
    const rightIndex = preferredOrder.indexOf(right)
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
    }

    return left.localeCompare(right)
  })
}
