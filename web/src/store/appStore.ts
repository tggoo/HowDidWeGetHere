import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MapViewport } from '../components/HistoryMap'

export type AdminPage = 'import' | 'periods' | 'tags' | 'entry' | 'places' | 'routes' | 'relationships' | 'sources' | 'media'
export type ThemeMode = 'light' | 'dark'

export type MediaCacheProgress = {
  completed: number
  failed: number
  total: number
}

type AppState = {
  adminPage: AdminPage
  fromYear: string
  isAdminOpen: boolean
  isEntryDetailOpen: boolean
  isFilterPanelOpen: boolean
  isMediaPrefetching: boolean
  isOfflineCacheAvailable: boolean
  language: string
  mapViewport: MapViewport | null
  mediaCacheProgress: MediaCacheProgress | null
  mediaCacheStatus: string
  searchText: string
  selectedEntryId: string
  selectedPeriodId: string | null
  selectedTags: string[]
  theme: ThemeMode
  toYear: string
  clearFilters: () => void
  clearRuntimeCacheState: () => void
  setAdminOpen: (isOpen: boolean | ((current: boolean) => boolean)) => void
  setAdminPage: (adminPage: AdminPage) => void
  setEntryDetailOpen: (isOpen: boolean) => void
  setFilterPanelOpen: (isOpen: boolean) => void
  setFromYear: (fromYear: string) => void
  setLanguage: (language: string) => void
  setMapViewport: (mapViewport: MapViewport | null | ((current: MapViewport | null) => MapViewport | null)) => void
  setMediaCacheProgress: (mediaCacheProgress: MediaCacheProgress | null) => void
  setMediaCacheStatus: (mediaCacheStatus: string) => void
  setMediaPrefetching: (isMediaPrefetching: boolean) => void
  setOfflineCacheAvailable: (isOfflineCacheAvailable: boolean) => void
  setSearchText: (searchText: string) => void
  setSelectedEntryId: (selectedEntryId: string) => void
  setSelectedPeriodId: (selectedPeriodId: string | null) => void
  setTheme: (theme: ThemeMode | ((current: ThemeMode) => ThemeMode)) => void
  setToYear: (toYear: string) => void
  setYearRange: (selectedPeriodId: string | null, fromYear: string, toYear: string) => void
  toggleTag: (tag: string) => void
}

function preferredInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      adminPage: 'import',
      fromYear: '',
      isAdminOpen: false,
      isEntryDetailOpen: false,
      isFilterPanelOpen: false,
      isMediaPrefetching: false,
      isOfflineCacheAvailable: false,
      language: 'en',
      mapViewport: null,
      mediaCacheProgress: null,
      mediaCacheStatus: 'JSON data is cached automatically. Media downloads only when opened.',
      searchText: '',
      selectedEntryId: 'draft-columbus',
      selectedPeriodId: null,
      selectedTags: ['category-exploration'],
      theme: preferredInitialTheme(),
      toYear: '',
      clearFilters: () =>
        set({
          fromYear: '',
          searchText: '',
          selectedPeriodId: null,
          selectedTags: [],
          toYear: '',
        }),
      clearRuntimeCacheState: () =>
        set({
          mediaCacheProgress: null,
          mediaCacheStatus: 'Cached map data and media were cleared.',
        }),
      setAdminOpen: (isOpen) =>
        set((state) => ({
          isAdminOpen: typeof isOpen === 'function' ? isOpen(state.isAdminOpen) : isOpen,
        })),
      setAdminPage: (adminPage) => set({ adminPage }),
      setEntryDetailOpen: (isEntryDetailOpen) => set({ isEntryDetailOpen }),
      setFilterPanelOpen: (isFilterPanelOpen) => set({ isFilterPanelOpen }),
      setFromYear: (fromYear) => set({ fromYear }),
      setLanguage: (language) => set({ language }),
      setMapViewport: (mapViewport) =>
        set((state) => ({
          mapViewport: typeof mapViewport === 'function' ? mapViewport(state.mapViewport) : mapViewport,
        })),
      setMediaCacheProgress: (mediaCacheProgress) => set({ mediaCacheProgress }),
      setMediaCacheStatus: (mediaCacheStatus) => set({ mediaCacheStatus }),
      setMediaPrefetching: (isMediaPrefetching) => set({ isMediaPrefetching }),
      setOfflineCacheAvailable: (isOfflineCacheAvailable) => set({ isOfflineCacheAvailable }),
      setSearchText: (searchText) => set({ searchText }),
      setSelectedEntryId: (selectedEntryId) => set({ selectedEntryId }),
      setSelectedPeriodId: (selectedPeriodId) => set({ selectedPeriodId }),
      setTheme: (theme) =>
        set((state) => ({
          theme: typeof theme === 'function' ? theme(state.theme) : theme,
        })),
      setToYear: (toYear) => set({ toYear }),
      setYearRange: (selectedPeriodId, fromYear, toYear) => set({ fromYear, selectedPeriodId, toYear }),
      toggleTag: (tag) =>
        set((state) => ({
          selectedTags: state.selectedTags.includes(tag)
            ? state.selectedTags.filter((selectedTag) => selectedTag !== tag)
            : [...state.selectedTags, tag],
        })),
    }),
    {
      name: 'howdidwegethere.app',
      partialize: (state) => ({
        language: state.language,
        selectedTags: state.selectedTags,
        theme: state.theme,
      }),
    },
  ),
)
