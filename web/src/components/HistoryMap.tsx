import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export type MapEntry = {
  entryId: string
  slug: string
  kind: string
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

type HistoryMapProps = {
  entries: MapEntry[]
  fallbackEntryIds: string[]
  selectedEntryId?: string
  onSelectEntry: (entryId: string) => void
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

function mapDataSignature(entries: MapEntry[]) {
  return entries
    .map((entry) => {
      const points = entry.points
        .map((point) => `${point.placeId}:${point.longitude}:${point.latitude}`)
        .join(',')
      const routes = entry.routes
        .map((route) => `${route.routeId}:${route.geometry.length}`)
        .join(',')
      return `${entry.entryId}:${points}:${routes}`
    })
    .join('|')
}

export function HistoryMap({ entries, fallbackEntryIds, selectedEntryId, onSelectEntry }: HistoryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)
  const lastFitSignatureRef = useRef<string>('')
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 2,
    }).addTo(map)

    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution('&copy; OpenStreetMap').addTo(map)
    overlayRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const redraw = () => setMapRevision((revision) => revision + 1)
    map.on('zoomend moveend', redraw)

    return () => {
      map.off('zoomend moveend', redraw)
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

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
        marker.on('click', () => map.fitBounds(clusterBounds.pad(0.18), { maxZoom: 7 }))
        marker.addTo(overlay)
      }
    } else {
      for (const markerPoint of markerPoints) {
        addPointMarker(overlay, markerPoint, selectedEntryId, onSelectEntry)
      }
    }

    const fitSignature = mapDataSignature(entries)
    if (fitSignature !== lastFitSignatureRef.current) {
      lastFitSignatureRef.current = fitSignature

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.24), { animate: false, maxZoom: 5 })
      } else {
        map.setView(defaultCenter, defaultZoom, { animate: false })
      }
    }
  }, [entries, mapRevision, onSelectEntry, selectedEntryId])

  return (
    <section className="map-canvas" aria-label="World history map">
      <div className="leaflet-map" ref={mapContainerRef} />
      {!hasRealMapData && (
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
  })

  marker.bindPopup(popupContent(entry, point.placeName, point.role), {
    className: 'history-popup',
  })
  marker.on('click', () => onSelectEntry(entry.entryId))
  marker.addTo(overlay)
}
