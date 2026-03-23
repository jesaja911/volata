'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RouteResult, Waypoint } from '@/lib/types'

interface Props {
  result: RouteResult
  activeWaypoints: Waypoint[]
  activeDistanceNm: number
  onWaypointHover: (waypoint: Waypoint | null) => void
  onWaypointClick: (waypoint: Waypoint) => void
}

const NODE_ICONS: Record<string, string> = {
  castle: '🏰', ruins: '🏚', viewpoint: '👁', peak: '⛰',
  memorial: '🗿', historic: '📜', natural: '🌿', monument: '🗽',
  palace: '🏛', monastery: '⛪', lighthouse: '🔭', waterfall: '💧',
  lake: '🌊', natural_monument: '🌳',
}
const NODE_LABELS: Record<string, string> = {
  castle: 'Burg', ruins: 'Ruine', viewpoint: 'Aussichtspunkt', peak: 'Gipfel',
  memorial: 'Denkmal', historic: 'Historisch', natural: 'Natur', monument: 'Monument',
  palace: 'Schloss', monastery: 'Kloster', lighthouse: 'Leuchtturm', waterfall: 'Wasserfall',
  lake: 'See', natural_monument: 'Naturdenkmal',
}

export default function WaypointPanel({ result, activeWaypoints, activeDistanceNm, onWaypointHover, onWaypointClick }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const speedMap: Record<string, number> = { C172S: 122, PA28: 115, C182: 145, DA40: 150, SR22: 185, PA44: 180 }
      const params = new URLSearchParams({
        departure_icao: result.departure_airport.icao_code,
        aircraft_type: result.aircraft_type,
        cruise_speed_kt: String(speedMap[result.aircraft_type] ?? 120),
        block_time_min: String(result.block_time_min),
      })

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-fpl?${params}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      if (!res.ok) throw new Error('Export fehlgeschlagen')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `volata_${result.departure_airport.icao_code}.fpl`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  const sqiAvg = activeWaypoints.length > 0
    ? activeWaypoints.reduce((s, w) => s + w.sqi_total, 0) / activeWaypoints.length
    : (result.sqi_avg ?? 0)

  return (
    <div className="flex flex-col gap-4">

      {/* Stats — reflect active variant */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Distanz', value: `${Math.round(activeDistanceNm)} nm` },
          { label: 'Stops', value: String(activeWaypoints.length) },
          { label: 'SQI Ø', value: `${Math.round(sqiAvg * 100)}%`, green: true },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="text-sm font-bold" style={{ color: s.green ? '#30d158' : '#1d1d1f' }}>
              {s.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#aeaeb2' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Route list */}
      <div>
        {/* Departure */}
        <AirportStop icon="🛫" icao={result.departure_airport.icao_code} name={result.departure_airport.name} />

        {activeWaypoints.map((wp, i) => (
          <div key={i}>
            <Connector />
            <button className="w-full text-left group rounded-xl px-3 py-2.5 transition-all"
              style={{ border: '1px solid transparent' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f5f5f7'
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'
                onWaypointHover(wp)
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'transparent'
                onWaypointHover(null)
              }}
              onClick={() => onWaypointClick(wp)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                  style={{ background: '#ff9f0a' }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate" style={{ color: '#1d1d1f' }}>
                      {wp.name}
                    </span>
                    <SqiBadge sqi={wp.sqi_total} />
                    {wp.volata_score != null && (
                      <span className="text-xs" style={{ color: '#ffcc00' }}>
                        {'★'.repeat(Math.round(wp.volata_score))}
                        <span style={{ color: '#aeaeb2', fontWeight: 400 }}> {Number(wp.volata_score).toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#aeaeb2' }}>
                    {NODE_ICONS[wp.node_type ?? ''] ?? '📍'} {NODE_LABELS[wp.node_type ?? ''] ?? ''}
                    {wp.elevation_m ? ` · ${Math.round(wp.elevation_m)} m` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 flex-shrink-0 mt-1 opacity-30 group-hover:opacity-60 transition-opacity"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        ))}

        <Connector />
        <AirportStop icon="🛬" icao={result.departure_airport.icao_code} name="Rückkehr" />
      </div>

      {/* Export */}
      <button onClick={handleExport} disabled={exporting}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ border: '1.5px solid rgba(0,0,0,0.1)', color: '#1d1d1f', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {exporting ? (
          <span style={{ color: '#aeaeb2' }}>Exportiere…</span>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            ForeFlight .fpl exportieren
          </>
        )}
      </button>
    </div>
  )
}

function SqiBadge({ sqi }: { sqi: number }) {
  const pct = Math.round(sqi * 100)
  const color = pct >= 80 ? '#bf5af2' : pct >= 75 ? '#30d158' : pct >= 60 ? '#ff9f0a' : '#aeaeb2'
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
      style={{ color, background: `${color}18` }}>
      {pct}%
    </span>
  )
}

function AirportStop({ icon, icao, name }: { icon: string; icao: string; name: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm"
        style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.3)' }}>
        {icon}
      </div>
      <div>
        <span className="text-sm font-bold font-mono" style={{ color: '#30d158' }}>{icao}</span>
        <span className="text-xs ml-2" style={{ color: '#aeaeb2' }}>{name}</span>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex ml-[22px] my-0.5">
      <div className="w-px h-3 ml-[11px]" style={{ background: 'rgba(0,0,0,0.1)' }} />
    </div>
  )
}
