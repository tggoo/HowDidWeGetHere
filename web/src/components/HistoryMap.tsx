import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapEntry = {
  entryId: string
  slug: string
  kind: string
  iconKey?: string | null
  title: string
  dateLabel?: string | null
  startYear?: number | string | null
  endYear?: number | string | null
  primaryImageUrl?: string | null
  points: Array<{
    placeId: string
    placeSlug: string
    placeName: string
    role: string
    spatialConfidence: string
    longitude: number
    latitude: number
  }>
  routes: Array<{
    routeId: string
    name: string
    routeType: string
    spatialConfidence: string
    geometry: Array<{ longitude: number; latitude: number }>
  }>
}

export type MapViewport = {
  west: number
  south: number
  east: number
  north: number
}

type HistoryMapProps = {
  entries: MapEntry[]
  fallbackEntryIds: string[]
  language: string
  selectedEntryId?: string
  autoFitKey: string
  showFallback: boolean
  onSelectEntry: (entryId: string) => void
  onViewportChange: (viewport: MapViewport) => void
}

type MapPointMarker = {
  entry: MapEntry
  point: MapEntry['points'][number]
  coordinate: L.LatLng
}

const defaultCenter: L.LatLngExpression = [25, 10]
const defaultZoom = 2
const clusterCellSize = 52
const maxClusterZoom = 5
const coordinateGroupPrecision = 5
const defaultTileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const defaultTileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function resolveTileLayerConfig(language: string) {
  const normalizedLanguage = language.trim().toLowerCase() || 'en'
  const environment = import.meta.env as Record<string, string | undefined>
  const languageKey = normalizedLanguage.toUpperCase()
  const template =
    environment[`VITE_MAP_TILE_URL_${languageKey}`] ??
    environment.VITE_MAP_TILE_URL ??
    defaultTileUrl
  const attribution = environment.VITE_MAP_TILE_ATTRIBUTION ?? defaultTileAttribution

  return {
    attribution,
    url: template.replaceAll('{language}', encodeURIComponent(normalizedLanguage)),
  }
}

function popupContent(entry: MapEntry, placeName: string, role: string) {
  const date = entry.dateLabel ? `<span>${entry.dateLabel}</span>` : ''
  return `
    <strong>${escapeHtml(entry.title)}</strong>
    <small>${escapeHtml(entry.kind)} ${date}</small>
    <span>${escapeHtml(role)}: ${escapeHtml(placeName)}</span>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function markerIcon(isSelected: boolean) {
  return L.divIcon({
    className: isSelected ? 'history-marker selected' : 'history-marker',
    html: '<span></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function clusterIcon(count: number, isSelected: boolean) {
  return L.divIcon({
    className: isSelected ? 'history-cluster selected' : 'history-cluster',
    html: `<span>${count}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function clusterPopupContent(markers: MapPointMarker[]) {
  const titles = markers
    .slice(0, 5)
    .map(({ entry, point }) => `<li>${escapeHtml(entry.title)} <small>${escapeHtml(point.role)}</small></li>`)
    .join('')
  const remaining = markers.length > 5 ? `<li><small>+${markers.length - 5} more</small></li>` : ''

  return `
    <strong>${markers.length} nearby points</strong>
    <ul>${titles}${remaining}</ul>
  `
}

function coordinateGroupKey(marker: MapPointMarker) {
  return `${marker.coordinate.lat.toFixed(coordinateGroupPrecision)}:${marker.coordinate.lng.toFixed(coordinateGroupPrecision)}`
}

function groupByExactCoordinate(markers: MapPointMarker[]) {
  const groups = new Map<string, MapPointMarker[]>()
  for (const marker of markers) {
    const key = coordinateGroupKey(marker)
    groups.set(key, [...(groups.get(key) ?? []), marker])
  }

  return groups
}

function hasSingleCoordinate(markers: MapPointMarker[]) {
  return new Set(markers.map(coordinateGroupKey)).size === 1
}

function viewportFromMap(map: L.Map): MapViewport {
  const bounds = map.getBounds()
  return {
    west: normalizeLongitude(bounds.getWest()),
    south: clampLatitude(bounds.getSouth()),
    east: normalizeLongitude(bounds.getEast()),
    north: clampLatitude(bounds.getNorth()),
  }
}

function normalizeLongitude(value: number) {
  return Math.max(-180, Math.min(180, value))
}

function clampLatitude(value: number) {
  return Math.max(-85, Math.min(85, value))
}

export function HistoryMap({
  entries,
  fallbackEntryIds,
  language,
  selectedEntryId,
  autoFitKey,
  showFallback,
  onSelectEntry,
  onViewportChange,
}: HistoryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const lastAutoFitKeyRef = useRef<string>('')
  const [mapRevision, setMapRevision] = useState(0)

  const hasRealMapData = entries.some((entry) => entry.points.length > 0 || entry.routes.length > 0)

  const fallbackPoints = useMemo(
    () => [
      { id: fallbackEntryIds[0], className: 'atlantic', label: 'Atlantic route sample' },
      { id: fallbackEntryIds[1] ?? fallbackEntryIds[0], className: 'himalaya', label: 'Himalaya route sample' },
      { id: fallbackEntryIds[2] ?? fallbackEntryIds[0], className: 'nile', label: 'Nile entry sample' },
    ],
    [fallbackEntryIds],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      attributionControl: false,
      maxBounds: [
        [-85, -190],
        [85, 190],
      ],
      maxBoundsViscosity: 0.65,
      worldCopyJump: true,
    }).setView(defaultCenter, defaultZoom)

    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution('&copy; OpenStreetMap').addTo(map)
    overlayRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const redraw = () => {
      setMapRevision((revision) => revision + 1)
      onViewportChange(viewportFromMap(map))
    }
    map.on('zoomend moveend', redraw)
    onViewportChange(viewportFromMap(map))

    return () => {
      map.off('zoomend moveend', redraw)
      tileLayerRef.current?.remove()
      map.remove()
      mapRef.current = null
      overlayRef.current = null
      tileLayerRef.current = null
    }
  }, [onViewportChange])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    tileLayerRef.current?.remove()
    const tileLayerConfig = resolveTileLayerConfig(language)
    tileLayerRef.current = L.tileLayer(tileLayerConfig.url, {
      attribution: tileLayerConfig.attribution,
      maxZoom: 18,
      minZoom: 2,
      subdomains: 'abcd',
    }).addTo(map)
  }, [language])

  useEffect(() => {
    const map = mapRef.current
    const overlay = overlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()
    const bounds = L.latLngBounds([])
    const markerPoints: MapPointMarker[] = []

    for (const entry of entries) {
      for (const route of entry.routes) {
        if (route.geometry.length < 2) {
          continue
        }

        const routeCoordinates = route.geometry.map((point) => L.latLng(point.latitude, point.longitude))
        L.polyline(routeCoordinates, {
          color: '#135e96',
          opacity: selectedEntryId === entry.entryId ? 0.95 : 0.5,
          weight: selectedEntryId === entry.entryId ? 4 : 3,
        }).addTo(overlay)

        for (const point of routeCoordinates) {
          bounds.extend(point)
        }
      }

      for (const point of entry.points) {
        const coordinate = L.latLng(point.latitude, point.longitude)
        markerPoints.push({ entry, point, coordinate })
        bounds.extend(coordinate)
      }
    }

    const zoom = map.getZoom()
    const shouldCluster = markerPoints.length > 12 && zoom <= maxClusterZoom
    if (shouldCluster) {
      const clusters = new Map<string, MapPointMarker[]>()
      for (const markerPoint of markerPoints) {
        const projected = map.project(markerPoint.coordinate, zoom)
        const key = `${Math.floor(projected.x / clusterCellSize)}:${Math.floor(projected.y / clusterCellSize)}`
        clusters.set(key, [...(clusters.get(key) ?? []), markerPoint])
      }

      for (const clusterMarkers of clusters.values()) {
        if (clusterMarkers.length === 1) {
          addPointMarker(overlay, clusterMarkers[0], selectedEntryId, onSelectEntry)
          continue
        }

        const clusterBounds = L.latLngBounds(clusterMarkers.map((marker) => marker.coordinate))
        const center = L.latLng(
          clusterMarkers.reduce((sum, marker) => sum + marker.coordinate.lat, 0) / clusterMarkers.length,
          clusterMarkers.reduce((sum, marker) => sum + marker.coordinate.lng, 0) / clusterMarkers.length,
        )
        const hasSelectedEntry = clusterMarkers.some((marker) => marker.entry.entryId === selectedEntryId)
        const marker = L.marker(center, {
          icon: clusterIcon(clusterMarkers.length, hasSelectedEntry),
          title: `${clusterMarkers.length} nearby history points`,
        })

        marker.bindPopup(clusterPopupContent(clusterMarkers), {
          className: 'history-popup history-cluster-popup',
        })
        marker.on('click', () => {
          if (hasSingleCoordinate(clusterMarkers)) {
            map.setView(center, Math.max(map.getZoom() + 2, maxClusterZoom + 1), { animate: true })
            return
          }

          map.fitBounds(clusterBounds.pad(0.18), { maxZoom: 7 })
        })
        marker.addTo(overlay)
      }
    } else {
      for (const coordinateGroup of groupByExactCoordinate(markerPoints).values()) {
        if (coordinateGroup.length === 1) {
          addPointMarker(overlay, coordinateGroup[0], selectedEntryId, onSelectEntry)
        } else {
          addSpiderfiedPointMarkers(map, overlay, coordinateGroup, selectedEntryId, onSelectEntry)
        }
      }
    }

    if (autoFitKey !== lastAutoFitKeyRef.current) {
      lastAutoFitKeyRef.current = autoFitKey

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.24), { animate: false, maxZoom: 5 })
      } else {
        map.setView(defaultCenter, defaultZoom, { animate: false })
      }
    }
  }, [autoFitKey, entries, mapRevision, onSelectEntry, selectedEntryId])

  return (
    <section className="map-canvas" aria-label="World history map">
      <div className="leaflet-map" ref={mapContainerRef} />
      {showFallback && !hasRealMapData && (
        <div className="map-fallback-layer">
          <div className="map-grid" />
          {fallbackPoints.map((point) => (
            <button
              aria-label={point.label}
              className={`map-point ${point.className}`}
              key={point.className}
              type="button"
              onClick={() => point.id && onSelectEntry(point.id)}
            >
              <span />
            </button>
          ))}
          <div className="route-line atlantic-route" />
          <div className="route-line everest-route" />
        </div>
      )}
    </section>
  )
}

function addSpiderfiedPointMarkers(
  map: L.Map,
  overlay: L.LayerGroup,
  markerPoints: MapPointMarker[],
  selectedEntryId: string | undefined,
  onSelectEntry: (entryId: string) => void,
) {
  const center = markerPoints[0].coordinate
  const zoom = map.getZoom()
  const projectedCenter = map.project(center, zoom)
  const radius = Math.min(96, 28 + markerPoints.length * 2.5)

  markerPoints.forEach((markerPoint, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / markerPoints.length
    const projectedPoint = L.point(
      projectedCenter.x + Math.cos(angle) * radius,
      projectedCenter.y + Math.sin(angle) * radius,
    )
    const displayCoordinate = map.unproject(projectedPoint, zoom)

    L.polyline([center, displayCoordinate], {
      color: '#135e96',
      dashArray: '2 4',
      interactive: false,
      opacity: 0.35,
      weight: 1,
    }).addTo(overlay)

    addPointMarker(
      overlay,
      {
        ...markerPoint,
        coordinate: displayCoordinate,
      },
      selectedEntryId,
      onSelectEntry,
    )
  })
}

function addPointMarker(
  overlay: L.LayerGroup,
  markerPoint: MapPointMarker,
  selectedEntryId: string | undefined,
  onSelectEntry: (entryId: string) => void,
) {
  const { entry, point, coordinate } = markerPoint
  const marker = L.marker(coordinate, {
    icon: markerIcon(selectedEntryId === entry.entryId),
    title: `${entry.title} / ${point.role}: ${point.placeName}`,
    zIndexOffset: selectedEntryId === entry.entryId ? 1000 : 0,
  })

  marker.bindPopup(popupContent(entry, point.placeName, point.role), {
    className: 'history-popup',
  })
  marker.on('click', () => onSelectEntry(entry.entryId))
  marker.addTo(overlay)
}
