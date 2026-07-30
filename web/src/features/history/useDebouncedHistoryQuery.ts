import type { MapViewport } from '../../components/HistoryMap'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

type HistoryQueryInput = {
  fromYear: string
  mapViewport: MapViewport | null
  searchText: string
  selectedTags: string[]
  toYear: string
}

export function useDebouncedHistoryQuery(input: HistoryQueryInput) {
  return {
    fromYear: useDebouncedValue(input.fromYear, 250),
    mapViewport: useDebouncedValue(input.mapViewport, 180),
    searchText: useDebouncedValue(input.searchText, 250),
    selectedTags: useDebouncedValue(input.selectedTags, 150),
    toYear: useDebouncedValue(input.toYear, 250),
  }
}
