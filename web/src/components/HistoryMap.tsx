import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
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

const defaultCenter: L.LatLngExpression = [25, 10]
const defaultZoom = 2

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

export function HistoryMap({ entries, fallbackEntryIds, selectedEntryId, onSelectEntry }: HistoryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)

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

    return () => {
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
        const marker = L.marker(coordinate, {
          icon: markerIcon(selectedEntryId === entry.entryId),
          title: `${entry.title} / ${point.role}: ${point.placeName}`,
        })

        marker.bindPopup(popupContent(entry, point.placeName, point.role), {
          className: 'history-popup',
        })
        marker.on('click', () => onSelectEntry(entry.entryId))
        marker.addTo(overlay)
        bounds.extend(coordinate)
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.24), { animate: false, maxZoom: 5 })
    } else {
      map.setView(defaultCenter, defaultZoom, { animate: false })
    }
  }, [entries, onSelectEntry, selectedEntryId])

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
