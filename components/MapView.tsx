'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { RouteResult, Waypoint } from '@/lib/types'
import { fetchWikimediaPhoto, getWikipediaUrl } from '@/lib/wikimedia'
import { supabase } from '@/lib/supabase'

// Mapbox is a client-only library – loaded dynamically
let mapboxgl: typeof import('mapbox-gl') | null = null

interface Props {
  result: RouteResult | null
  activeWaypoints: Waypoint[]
  highlightedWaypoint: Waypoint | null
  clickedWaypoint: Waypoint | null
  onMapReady?: () => void
}

const MAPBOX_STYLE = 'mapbox://styles/mapbox/outdoors-v12'
const GERMANY_CENTER: [number, number] = [10.5, 51.2]
const GERMANY_ZOOM = 5.5

export default function MapView({ result, activeWaypoints, highlightedWaypoint, clickedWaypoint }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const initializingRef = useRef(false) // guard against React Strict Mode double-effect
  const markersRef = useRef<any[]>([])
  // Keep a live ref to active waypoints so the map click handler always sees the latest
  const activeWaypointsRef = useRef<Waypoint[]>([])
  // Keep a live ref to showWaypointPopup so the map click handler can call the latest closure
  const showWaypointPopupRef = useRef<(wp: Waypoint, lngLat: [number, number]) => void>(() => {})
  const popupRef = useRef<any>(null)
  const photoCache = useRef<Map<string, string | null>>(new Map())

  // Init map once
  useEffect(() => {
    if (mapRef.current || initializingRef.current || !mapContainer.current) return

    // Flip synchronously so any second effect invocation (React Strict Mode) bails out
    initializingRef.current = true

    const init = async () => {
      const mgl = await import('mapbox-gl')
      mapboxgl = mgl

      // Re-check after async import — component may have unmounted in the meantime
      if (!mapContainer.current) return

      mgl.default.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

      const map = new mgl.default.Map({
        container: mapContainer.current,
        style: MAPBOX_STYLE,
        center: GERMANY_CENTER,
        zoom: GERMANY_ZOOM,
        pitch: 30,
        bearing: 0,
        antialias: true,
      })

      map.addControl(new mgl.default.NavigationControl({ showCompass: true }), 'top-right')
      map.addControl(new mgl.default.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-right')

      // Map-level click handler: find nearest waypoint within ~20px and show popup.
      // This bypasses the Mapbox mousedown interception on custom marker elements.
      map.on('click', (e: any) => {
        const waypoints = activeWaypointsRef.current
        if (!waypoints.length) return

        const clickPx = e.point // {x, y} in canvas pixels
        const HIT_RADIUS_PX = 20

        let nearest: Waypoint | null = null
        let nearestDist = Infinity

        for (const wp of waypoints) {
          if (!wp || wp.lat == null || wp.lon == null) continue
          const wpPx = map.project([wp.lon, wp.lat])
          const dx = wpPx.x - clickPx.x
          const dy = wpPx.y - clickPx.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < HIT_RADIUS_PX && dist < nearestDist) {
            nearestDist = dist
            nearest = wp
          }
        }

        if (nearest) {
          showWaypointPopupRef.current(nearest, [nearest.lon, nearest.lat])
        }
      })

      mapRef.current = map
    }

    init()

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      initializingRef.current = false
    }
  }, [])

  // Show photo popup for a waypoint
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Expose rating helpers on window so popup HTML onclick handlers can call them
  useEffect(() => {
    ;(window as any)._volataRate = async (nodeId: string, stars: number) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('node_ratings').upsert(
          { user_id: user.id, scenic_node_id: nodeId, stars, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,scenic_node_id' }
        )
        // Fill stars
        for (let i = 1; i <= 5; i++) {
          const el = document.getElementById(`vstar-${nodeId}-${i}`)
          if (el) (el as HTMLElement).style.color = i <= stars ? '#ffcc00' : '#4a5568'
        }
        const msg = document.getElementById(`vrate-msg-${nodeId}`)
        if (msg) { msg.textContent = '✓ Gespeichert'; (msg as HTMLElement).style.color = '#30d158' }
      } catch (e) { console.error('Rating error', e) }
    }
    ;(window as any)._loadNodeRating = async (nodeId: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user's existing rating + current wikipedia_url in parallel
        const [ratingRes, nodeRes] = await Promise.all([
          supabase.from('node_ratings').select('stars')
            .eq('user_id', user.id).eq('scenic_node_id', nodeId).maybeSingle(),
          supabase.from('scenic_nodes').select('wikipedia_url')
            .eq('id', nodeId).maybeSingle(),
        ])

        // Update star colors
        const s = ratingRes.data?.stars ?? 0
        for (let i = 1; i <= 5; i++) {
          const el = document.getElementById(`vstar-${nodeId}-${i}`)
          if (el) (el as HTMLElement).style.color = i <= s ? '#ffcc00' : '#4a5568'
        }

        // Update wikipedia link + photo with latest DB value
        const freshUrl = nodeRes.data?.wikipedia_url
        if (freshUrl) {
          const link = document.getElementById(`vwiki-${nodeId}`) as HTMLAnchorElement | null
          if (link) link.href = freshUrl

          // Extract article title from URL and re-fetch the photo
          const titleMatch = freshUrl.match(/wikipedia\.org\/wiki\/(.+)$/)
          if (titleMatch) {
            const articleTitle = decodeURIComponent(titleMatch[1])
            fetchWikimediaPhoto(articleTitle).then(photoUrl => {
              if (!photoUrl) return
              const container = document.getElementById(`vphoto-container-${nodeId}`)
              if (!container) return
              // Replace entire container (covers both "no photo" fallback and existing img)
              container.style.height = '140px'
              container.style.background = 'transparent'
              container.style.display = 'block'
              container.innerHTML = `<img src="${photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`
            })
          }
        }
      } catch (e) { /* silent */ }
    }
    return () => {
      delete (window as any)._volataRate
      delete (window as any)._loadNodeRating
    }
  }, [])

  const showWaypointPopup = useCallback(async (wp: Waypoint, lngLat: [number, number]) => {
    if (!mapRef.current || !mapboxgl) return

    // Close any existing popup
    popupRef.current?.remove()

    // Loading popup first
    const popup = new mapboxgl.default.Popup({
      offset: 25,
      closeButton: true,
      className: 'volata-popup',
      maxWidth: '300px',
    })
      .setLngLat(lngLat)
      .setHTML(buildPopupHTML(wp, null, true))
      .addTo(mapRef.current)

    popupRef.current = popup
    if (wp.id) setTimeout(() => (window as any)._loadNodeRating?.(wp.id), 80)

    // Fetch photo (cache to avoid repeated API calls)
    if (!photoCache.current.has(wp.name)) {
      const photo = await fetchWikimediaPhoto(wp.wikipedia_title || wp.name)
      photoCache.current.set(wp.name, photo)
    }

    const photo = photoCache.current.get(wp.name) ?? null

    // Update popup with photo
    if (!popup.isOpen()) return  // user closed it already
    popup.setHTML(buildPopupHTML(wp, photo, false))
    if (wp.id) setTimeout(() => (window as any)._loadNodeRating?.(wp.id), 80)
  }, [])

  // Keep the ref in sync so the map-level click handler always calls the latest closure
  useEffect(() => {
    showWaypointPopupRef.current = showWaypointPopup
  }, [showWaypointPopup])

  // Keep activeWaypointsRef in sync for the map-level click handler
  useEffect(() => {
    activeWaypointsRef.current = activeWaypoints
  }, [activeWaypoints])

  // Draw route when result or active variant changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Draw or update the route. Uses setData() when the source already exists
    // to avoid the remove→add race condition that caused missing line segments.
    const draw = () => {
      // Clear previous markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      popupRef.current?.remove()

      if (!result || activeWaypoints.length === 0) {
        // Clear route layers/source if present
        if (map.getLayer('route-line')) map.removeLayer('route-line')
        if (map.getLayer('route-line-casing')) map.removeLayer('route-line-casing')
        if (map.getSource('route')) map.removeSource('route')
        return
      }

      const dep = result.departure_airport
      // Guard: skip waypoints with invalid coordinates
      const validWaypoints = activeWaypoints.filter(
        wp => wp.lat != null && wp.lon != null && isFinite(wp.lat) && isFinite(wp.lon)
      )
      const coordinates: [number, number][] = [
        [dep.lon, dep.lat],
        ...validWaypoints.map(wp => [wp.lon, wp.lat] as [number, number]),
        [dep.lon, dep.lat], // close the loop
      ]

      const geojsonData = {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates },
        properties: {},
      }

      if (map.getSource('route')) {
        // Source already exists – update data in place (no flicker, no race condition)
        ;(map.getSource('route') as any).setData(geojsonData)
      } else {
        // First render – create source and layers
        map.addSource('route', { type: 'geojson', data: geojsonData })

        // Casing (shadow)
        map.addLayer({
          id: 'route-line-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#1e3a5f',
            'line-width': 6,
            'line-opacity': 0.8,
          },
        })

        // Main line
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-opacity': 0.9,
            'line-dasharray': [3, 2],
          },
        })
      }

      // Departure marker (green)
      const depEl = createAirportMarker()
      const depMarker = new mapboxgl.default.Marker({ element: depEl, anchor: 'center' })
        .setLngLat([dep.lon, dep.lat])
        .addTo(map)
      markersRef.current.push(depMarker)

      // Waypoint markers (amber)
      validWaypoints.forEach((wp, i) => {
        const el = createWaypointMarker(i + 1)
        const marker = new mapboxgl.default.Marker({ element: el, anchor: 'center' })
          .setLngLat([wp.lon, wp.lat])
          .addTo(map)

        markersRef.current.push(marker)
      })

      // Fit map to route bounds
      const bounds = coordinates.reduce(
        (b, c) => b.extend(c as any),
        new mapboxgl.default.LngLatBounds(coordinates[0], coordinates[0])
      )
      map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom: 10 })
    }

    // isStyleLoaded() is more reliable than loaded() for checking if
    // sources/layers can be added safely.
    if (map.isStyleLoaded()) {
      draw()
    } else {
      map.once('style.load', draw)
    }
  }, [result, activeWaypoints, showWaypointPopup])

  // Highlight on hover (pulse effect)
  useEffect(() => {
    // Could animate the marker here; for now we handle via WaypointPanel hover
  }, [highlightedWaypoint])

  // Show popup on click from sidebar
  useEffect(() => {
    if (clickedWaypoint) {
      showWaypointPopup(clickedWaypoint, [clickedWaypoint.lon, clickedWaypoint.lat])
      mapRef.current?.flyTo({
        center: [clickedWaypoint.lon, clickedWaypoint.lat],
        zoom: 11,
        speed: 1.2,
      })
    }
  }, [clickedWaypoint, showWaypointPopup])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* No result overlay */}
      {!result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl px-8 py-6 text-center max-w-xs">
            <div className="text-4xl mb-3">🛩️</div>
            <h3 className="text-slate-200 font-semibold mb-1">Bereit zum Fliegen?</h3>
            <p className="text-slate-500 text-sm">
              Wähle Startflughafen, Flugzeug und Blockzeit – Volata findet die schönste Route.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Helpers ---- */

function buildPopupHTML(wp: Waypoint, photo: string | null, loading: boolean): string {
  const nodeLabels: Record<string, string> = {
    castle: '🏰 Burg', ruins: '🏚 Ruine', viewpoint: '👁 Aussichtspunkt',
    peak: '⛰ Gipfel', memorial: '🗿 Denkmal', historic: '📜 Historisch',
    natural: '🌿 Natur', monument: '🗿 Denkmal', cathedral: '⛪ Dom / Kathedrale',
    palace: '🏛 Schloss', monastery: '⛪ Kloster', lighthouse: '🔭 Leuchtturm',
    waterfall: '💧 Wasserfall', lake: '🌊 See', natural_monument: '🌳 Naturdenkmal',
    scenic: '',
  }
  const typeLabel = nodeLabels[wp.node_type ?? ''] ?? ''
  const sqi = Math.round(wp.sqi_total * 100)
  const sqiColor = sqi >= 80 ? '#a855f7' : sqi >= 75 ? '#30d158' : sqi >= 60 ? '#f59e0b' : '#94a3b8'
  const wikiUrl = wp.wikipedia_url || getWikipediaUrl(wp.wikipedia_title || wp.name)
  const lat = Math.abs(wp.lat).toFixed(4)
  const lon = Math.abs(wp.lon).toFixed(4)
  const latDir = wp.lat >= 0 ? 'N' : 'S'
  const lonDir = wp.lon >= 0 ? 'E' : 'W'
  const nodeId = wp.id ?? ''

  // Volata community score
  const volataBlock = wp.volata_score
    ? `<div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
         <span style="color:#ffcc00;font-size:13px;">★</span>
         <span style="font-size:11px;color:#94a3b8;">${Number(wp.volata_score).toFixed(1)}
           <span style="color:#475569;">(${wp.rating_count ?? 0})</span>
         </span>
       </div>`
    : ''

  // Star rating widget (only if we have a node ID to reference)
  const starsBlock = nodeId
    ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #2d3748;">
         <div style="font-size:10px;color:#64748b;margin-bottom:3px;">Bewerte diesen Wegpunkt:</div>
         <div style="display:flex;align-items:center;gap:1px;">
           ${[1,2,3,4,5].map(s =>
             `<button id="vstar-${nodeId}-${s}"
                onclick="window._volataRate('${nodeId}',${s})"
                style="font-size:22px;cursor:pointer;background:none;border:none;padding:2px;color:#4a5568;line-height:1;">★</button>`
           ).join('')}
           <span id="vrate-msg-${nodeId}" style="font-size:10px;color:#64748b;margin-left:6px;"></span>
         </div>
       </div>`
    : ''

  return `
    <div style="font-family: system-ui, sans-serif; overflow: hidden; border-radius: 12px;">
      ${photo
        ? `<div id="vphoto-container-${nodeId}" style="width:100%;height:140px;overflow:hidden;border-radius:12px 12px 0 0;">
             <img id="vphoto-${nodeId}" src="${photo}" alt="${wp.name}" style="width:100%;height:100%;object-fit:cover;" />
           </div>`
        : loading
        ? `<div id="vphoto-container-${nodeId}" style="width:100%;height:80px;background:#1e293b;border-radius:12px 12px 0 0;
                        display:flex;align-items:center;justify-content:center;color:#475569;font-size:12px;">
             Lade Foto…
           </div>`
        : `<div id="vphoto-container-${nodeId}" style="width:100%;height:56px;background:#1e293b;border-radius:12px 12px 0 0;
                        display:flex;align-items:center;justify-content:center;font-size:28px;">
             ${wp.node_type === 'peak' ? '⛰' : wp.node_type === 'castle' ? '🏰' : wp.node_type === 'palace' ? '🏛' : wp.node_type === 'viewpoint' ? '👁' : wp.node_type === 'cathedral' ? '⛪' : wp.node_type === 'monument' ? '🗿' : wp.node_type === 'lake' ? '🌊' : '📍'}
           </div>`
      }
      <div style="padding:12px 14px;">
        <div style="font-weight:700;font-size:14px;color:#0d1b3e;margin-bottom:4px;line-height:1.3;">
          ${wp.name}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          ${typeLabel ? `<span style="font-size:11px;color:#64748b;">${typeLabel}</span>` : ''}
          <span style="font-size:11px;font-weight:700;color:${sqiColor};
                        background:${sqiColor}18;padding:1px 6px;border-radius:4px;">
            SQI ${sqi}
          </span>
          ${wp.elevation_m ? `<span style="font-size:11px;color:#64748b;">${Math.round(wp.elevation_m)} m</span>` : ''}
        </div>
        ${volataBlock}
        <div style="font-size:10px;color:#475569;margin-bottom:8px;">
          ${lat}°${latDir}, ${lon}°${lonDir}
        </div>
        <a id="vwiki-${nodeId}" href="${wikiUrl}" target="_blank" rel="noopener"
           style="font-size:11px;color:#3b82f6;text-decoration:none;">
          Wikipedia →
        </a>
        ${starsBlock}
      </div>
    </div>
  `
}

function createWaypointMarker(num: number): HTMLElement {
  // Outer wrapper: kept clean so Mapbox can position it correctly via CSS transform.
  // - No `position: relative` (interferes with Mapbox's marker layout)
  // - No `transition: transform` (causes marker to lag behind the map during scroll/zoom)
  // - `will-change: transform` hints the GPU to composite this layer, preventing the
  //   "jump to top-left corner" glitch that occurs when Mapbox updates positions mid-frame.
  const el = document.createElement('div')
  el.style.cssText = `
    width: 28px; height: 28px;
    will-change: transform;
    cursor: pointer;
  `

  // Inner element carries the visual styling so hover scale doesn't affect the anchor point.
  const inner = document.createElement('div')
  inner.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: #f59e0b; border: 2px solid #fbbf24;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #1c1917;
    box-shadow: 0 0 0 3px rgba(245,158,11,0.3), 0 4px 12px rgba(0,0,0,0.4);
    transition: transform 0.15s ease;
  `
  inner.textContent = String(num)
  el.appendChild(inner)

  el.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.2)' })
  el.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)' })
  return el
}

function createAirportMarker(): HTMLElement {
  // Same clean-wrapper pattern as waypoint markers.
  const el = document.createElement('div')
  el.style.cssText = `
    width: 32px; height: 32px;
    will-change: transform;
  `
  const inner = document.createElement('div')
  inner.style.cssText = `
    width: 32px; height: 32px; border-radius: 50%;
    background: #10b981; border: 2px solid #34d399;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 0 0 4px rgba(16,185,129,0.25), 0 4px 12px rgba(0,0,0,0.4);
  `
  inner.textContent = '✈'
  el.appendChild(inner)
  return el
}
