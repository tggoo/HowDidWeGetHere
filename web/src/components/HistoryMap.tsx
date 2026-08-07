import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MinMaxItem } from '../features/minMax/minMax'
import { worldDivisionText, type WorldDivision } from '../features/worldDivisions/worldDivisions'
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
  ariaLabel: string
  entries: MapEntry[]
  fallbackEntryIds: string[]
  language: string
  minMaxFocusKey: number
  minMaxItems: readonly MinMaxItem[]
  selectedMinMaxItemId?: string | null
  selectedWorldDivisionId?: string | null
  selectedEntryId?: string
  autoFitKey: string
  showFallback: boolean
  worldDivisionFocusKey: number
  worldDivisions: readonly WorldDivision[]
  onSelectEntry: (entryId: string) => void
  onSelectMinMaxItem: (itemId: string) => void
  onSelectWorldDivision: (divisionId: string) => void
  onViewportChange: (viewport: MapViewport) => void
}

type MapPointMarker = {
  entry: MapEntry
  point: MapEntry['points'][number]
  coordinate: L.LatLng
}

type MapRouteMarker = {
  entry: MapEntry
  route: MapEntry['routes'][number]
  coordinate: L.LatLng
  kind: 'start' | 'waypoint' | 'end'
  pointIndex: number
  pointCount: number
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

function routePopupContent(marker: MapRouteMarker) {
  const date = marker.entry.dateLabel ? `<span>${marker.entry.dateLabel}</span>` : ''
  const pointLabel = marker.kind === 'start'
    ? 'Start'
    : marker.kind === 'end'
      ? 'Goal'
      : `Waypoint ${marker.pointIndex + 1}`

  return `
    <strong>${escapeHtml(marker.entry.title)}</strong>
    <small>${escapeHtml(marker.route.name || marker.route.routeType)} ${date}</small>
    <span>${pointLabel} (${marker.pointIndex + 1}/${marker.pointCount})</span>
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

function routeMarkerIcon(kind: MapRouteMarker['kind'], isSelected: boolean) {
  const className = ['route-marker', `route-marker-${kind}`, isSelected ? 'selected' : ''].filter(Boolean).join(' ')
  return L.divIcon({
    className,
    html: kind === 'end'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 22V4"/><path d="M4 4h13l-2 5 2 5H4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    iconSize: kind === 'waypoint' ? [15, 15] : [18, 18],
    iconAnchor: kind === 'end' ? [4, 16] : kind === 'waypoint' ? [7.5, 15] : [9, 18],
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

function worldDivisionPopupContent(division: WorldDivision, polygonLabel: string | null, language: string) {
  const label = polygonLabel ? `<small>${escapeHtml(polygonLabel)}</small>` : ''
  return `
    <strong>${escapeHtml(worldDivisionText(division.title, language))}</strong>
    ${label}
    <span>${escapeHtml(worldDivisionText(division.typeLabel, language))}</span>
  `
}

function minMaxPopupContent(item: MinMaxItem) {
  const value = item.valueLabel ? `<small>${escapeHtml(item.valueLabel)}</small>` : ''
  const type = item.typeLabel ? `<span>${escapeHtml(item.typeLabel)}</span>` : ''
  return `
    <strong>${escapeHtml(item.title)}</strong>
    ${value}
    ${type}
  `
}

function coordinateGroupKey(marker: MapPointMarker) {
  return coordinateKey(marker.coordinate)
}

function coordinateKey(coordinate: L.LatLng) {
  return `${coordinate.lat.toFixed(coordinateGroupPrecision)}:${coordinate.lng.toFixed(coordinateGroupPrecision)}`
}

function entryCoordinateKey(entryId: string, coordinate: L.LatLng) {
  return `${entryId}:${coordinateKey(coordinate)}`
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
  ariaLabel,
  entries,
  fallbackEntryIds,
  language,
  minMaxFocusKey,
  minMaxItems,
  selectedMinMaxItemId,
  selectedWorldDivisionId,
  selectedEntryId,
  autoFitKey,
  showFallback,
  worldDivisionFocusKey,
  worldDivisions,
  onSelectEntry,
  onSelectMinMaxItem,
  onSelectWorldDivision,
  onViewportChange,
}: HistoryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const divisionOverlayRef = useRef<L.LayerGroup | null>(null)
  const minMaxOverlayRef = useRef<L.LayerGroup | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const lastAutoFitKeyRef = useRef<string>('')
  const lastMinMaxFocusKeyRef = useRef(minMaxFocusKey)
  const lastWorldDivisionFocusKeyRef = useRef(worldDivisionFocusKey)
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
    divisionOverlayRef.current = L.layerGroup().addTo(map)
    minMaxOverlayRef.current = L.layerGroup().addTo(map)
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
      divisionOverlayRef.current = null
      minMaxOverlayRef.current = null
      overlayRef.current = null
      tileLayerRef.current = null
    }
  }, [onViewportChange])

  useEffect(() => {
    const mapContainer = mapContainerRef.current
    if (!mapContainer || typeof ResizeObserver === 'undefined') {
      return
    }

    let animationFrameId: number | null = null
    let viewportTimeoutId: number | null = null
    const observer = new ResizeObserver(() => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        const map = mapRef.current
        if (!map) {
          return
        }

        map.invalidateSize({ debounceMoveend: true })
        if (viewportTimeoutId !== null) {
          window.clearTimeout(viewportTimeoutId)
        }
        viewportTimeoutId = window.setTimeout(() => {
          onViewportChange(viewportFromMap(map))
        }, 180)
      })
    })

    observer.observe(mapContainer)
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      if (viewportTimeoutId !== null) {
        window.clearTimeout(viewportTimeoutId)
      }
      observer.disconnect()
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
    const routeCoordinateKeys = new Set<string>()

    for (const entry of entries) {
      for (const route of entry.routes) {
        if (route.geometry.length < 2) {
          continue
        }

        const routeCoordinates = route.geometry.map((point) => L.latLng(point.latitude, point.longitude))
        routeCoordinates.forEach((point, index) => {
          routeCoordinateKeys.add(entryCoordinateKey(entry.entryId, point))
          if (selectedEntryId !== entry.entryId) {
            return
          }

          if (index === 0) {
            L.polyline(routeCoordinates, {
              color: '#135e96',
              opacity: 0.95,
              weight: 4,
            }).addTo(overlay)
          }

          const routeMarker: MapRouteMarker = {
            entry,
            route,
            coordinate: point,
            kind: index === 0 ? 'start' : index === routeCoordinates.length - 1 ? 'end' : 'waypoint',
            pointIndex: index,
            pointCount: routeCoordinates.length,
          }
          addRoutePointMarker(overlay, routeMarker, selectedEntryId, onSelectEntry)
          bounds.extend(point)
        })
      }

      for (const point of entry.points) {
        const coordinate = L.latLng(point.latitude, point.longitude)
        if (routeCoordinateKeys.has(entryCoordinateKey(entry.entryId, coordinate))) {
          continue
        }

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

  useEffect(() => {
    const map = mapRef.current
    const overlay = divisionOverlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()
    const focusBounds = L.latLngBounds([])
    const selectedDivision = worldDivisions.find((division) => division.id === selectedWorldDivisionId) ?? null

    for (const division of worldDivisions) {
      const isSelected = division.id === selectedWorldDivisionId
      for (const shape of division.polygons) {
        const coordinates = shape.points.map(([latitude, longitude]) => L.latLng(latitude, longitude))
        const polygonLayer = L.polygon(coordinates, {
          className: isSelected ? 'world-division-polygon selected' : 'world-division-polygon',
          color: isSelected ? '#d9480f' : '#2f9e44',
          fillColor: isSelected ? '#f59f00' : '#2f9e44',
          fillOpacity: isSelected ? 0.22 : selectedWorldDivisionId ? 0.035 : 0.07,
          opacity: isSelected ? 0.96 : 0.42,
          pane: 'overlayPane',
          weight: isSelected ? 3 : 1.4,
        })

        const polygonLabel = shape.label ? worldDivisionText(shape.label, language) : null
        polygonLayer.bindPopup(worldDivisionPopupContent(division, polygonLabel, language), {
          className: 'history-popup world-division-popup',
        })
        polygonLayer.on('click', () => onSelectWorldDivision(division.id))
        polygonLayer.on('mouseover', () => {
          if (!isSelected) {
            polygonLayer.setStyle({ fillOpacity: 0.14, opacity: 0.72, weight: 2 })
          }
        })
        polygonLayer.on('mouseout', () => {
          if (!isSelected) {
            polygonLayer.setStyle({
              fillOpacity: selectedWorldDivisionId ? 0.035 : 0.07,
              opacity: 0.42,
              weight: 1.4,
            })
          }
        })

        polygonLayer.addTo(overlay)
        if (isSelected) {
          for (const coordinate of coordinates) {
            focusBounds.extend(coordinate)
          }
        }
      }
    }

    if (worldDivisionFocusKey !== lastWorldDivisionFocusKeyRef.current) {
      lastWorldDivisionFocusKeyRef.current = worldDivisionFocusKey
      if (selectedDivision && focusBounds.isValid()) {
        const maxZoom =
          selectedDivision.categoryId === 'hemispheres' ? 2 : selectedDivision.categoryId === 'continents' ? 3 : 6
        map.fitBounds(focusBounds.pad(0.28), { animate: true, maxZoom })
      }
    }
  }, [language, onSelectWorldDivision, selectedWorldDivisionId, worldDivisionFocusKey, worldDivisions])

  useEffect(() => {
    const map = mapRef.current
    const overlay = minMaxOverlayRef.current
    if (!map || !overlay) {
      return
    }

    overlay.clearLayers()
    const allBounds = L.latLngBounds([])
    const focusBounds = L.latLngBounds([])
    const selectedItem = minMaxItems.find((item) => item.id === selectedMinMaxItemId) ?? null

    for (const item of minMaxItems) {
      const isSelected = item.id === selectedMinMaxItemId
      for (const shape of item.shapes) {
        const coordinates = shape.points.map((point) => L.latLng(point.latitude, point.longitude))
        if (coordinates.length === 0) {
          continue
        }
        for (const coordinate of coordinates) {
          allBounds.extend(coordinate)
        }

        if (shape.kind === 'Polygon' && coordinates.length >= 3) {
          const polygonLayer = L.polygon(coordinates, {
            className: isSelected ? 'min-max-polygon selected' : 'min-max-polygon',
            color: isSelected ? '#9c2f1b' : '#7048e8',
            fillColor: isSelected ? '#ff922b' : '#5f3dc4',
            fillOpacity: isSelected ? 0.24 : selectedMinMaxItemId ? 0.045 : 0.09,
            opacity: isSelected ? 0.96 : 0.46,
            pane: 'overlayPane',
            weight: isSelected ? 3 : 1.5,
          })

          polygonLayer.bindPopup(minMaxPopupContent(item), {
            className: 'history-popup min-max-popup',
          })
          polygonLayer.on('click', () => onSelectMinMaxItem(item.id))
          polygonLayer.on('mouseover', () => {
            if (!isSelected) {
              polygonLayer.setStyle({ fillOpacity: 0.16, opacity: 0.74, weight: 2 })
            }
          })
          polygonLayer.on('mouseout', () => {
            if (!isSelected) {
              polygonLayer.setStyle({
                fillOpacity: selectedMinMaxItemId ? 0.045 : 0.09,
                opacity: 0.46,
                weight: 1.5,
              })
            }
          })

          polygonLayer.addTo(overlay)
          if (isSelected) {
            for (const coordinate of coordinates) {
              focusBounds.extend(coordinate)
            }
          }
          continue
        }

        const point = coordinates[0]
        const marker = L.circleMarker(point, {
          className: isSelected ? 'min-max-point selected' : 'min-max-point',
          color: isSelected ? '#9c2f1b' : '#7048e8',
          fillColor: isSelected ? '#ff922b' : '#5f3dc4',
          fillOpacity: isSelected ? 0.95 : selectedMinMaxItemId ? 0.5 : 0.78,
          opacity: 1,
          radius: isSelected ? 9 : 7,
          weight: isSelected ? 3 : 2,
        })

        marker.bindPopup(minMaxPopupContent(item), {
          className: 'history-popup min-max-popup',
        })
        marker.on('click', () => onSelectMinMaxItem(item.id))
        marker.addTo(overlay)
        if (isSelected) {
          focusBounds.extend(point)
        }
      }
    }

    if (minMaxFocusKey !== lastMinMaxFocusKeyRef.current) {
      lastMinMaxFocusKeyRef.current = minMaxFocusKey
      if (selectedItem && focusBounds.isValid()) {
        const maxZoom = selectedItem.category === 'water' ? 3 : selectedItem.category === 'countries' ? 4 : 6
        map.fitBounds(focusBounds.pad(0.28), { animate: true, maxZoom })
      } else if (allBounds.isValid()) {
        map.fitBounds(allBounds.pad(0.22), { animate: true, maxZoom: 3 })
      } else {
        map.setView(defaultCenter, defaultZoom, { animate: true })
      }
    }
  }, [minMaxFocusKey, minMaxItems, onSelectMinMaxItem, selectedMinMaxItemId])

  return (
    <section className="map-canvas" aria-label={ariaLabel}>
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

function addRoutePointMarker(
  overlay: L.LayerGroup,
  routeMarker: MapRouteMarker,
  selectedEntryId: string | undefined,
  onSelectEntry: (entryId: string) => void,
) {
  const { entry, coordinate, kind } = routeMarker
  const marker = L.marker(coordinate, {
    icon: routeMarkerIcon(kind, selectedEntryId === entry.entryId),
    title: `${entry.title} / ${routeMarker.route.name || routeMarker.route.routeType}`,
    zIndexOffset: selectedEntryId === entry.entryId ? 750 : -100,
  })

  marker.bindPopup(routePopupContent(routeMarker), {
    className: 'history-popup route-popup',
  })
  marker.on('click', () => onSelectEntry(entry.entryId))
  marker.addTo(overlay)
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
