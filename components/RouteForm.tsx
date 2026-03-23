'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AIRCRAFT_LIST, type RouteResult, type Airport } from '@/lib/types'
import {
  getPinnedNodes, addPinnedNode, removePinnedNode, type PinnedNode,
} from '@/lib/pinned-nodes'

interface Props {
  onResult: (result: RouteResult) => void
  onLoading: (loading: boolean) => void
  isLoading: boolean
}

export default function RouteForm({ onResult, onLoading, isLoading }: Props) {
  const [query, setQuery] = useState('')
  const [airports, setAirports] = useState<Airport[]>([])
  const [recentAirports, setRecentAirports] = useState<Airport[]>([])
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [aircraft, setAircraft] = useState('18c1a7b2-0cf7-444c-9cc6-4558a4764a0e') // Cessna 172S UUID
  const [blockTime, setBlockTime] = useState(120)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Pinned scenic nodes (required waypoints) ────────────────────────────
  const [pinnedNodes, setPinnedNodes] = useState<PinnedNode[]>([])
  const [nodeSearch, setNodeSearch] = useState('')
  const [nodeResults, setNodeResults] = useState<{ id: string; name: string; category: string }[]>([])
  const [showNodeDropdown, setShowNodeDropdown] = useState(false)
  const nodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeDropdownRef = useRef<HTMLDivElement>(null)

  // Auth + load profile (homebase, preferred aircraft, recent airports)
  useEffect(() => {
    const loadProfile = async (userId: string) => {
      const { data: profile } = await supabase
        .from('users')
        .select('homebase_icao, preferred_aircraft_id, recent_airports')
        .eq('id', userId)
        .single()

      if (!profile) return

      // Pre-fill preferred aircraft
      if (profile.preferred_aircraft_id) {
        setAircraft(profile.preferred_aircraft_id)
      }

      // Resolve and pre-fill recent airports (for dropdown suggestions)
      const recentIcaos: string[] = Array.isArray(profile.recent_airports) ? profile.recent_airports : []
      if (recentIcaos.length > 0) {
        const { data: recentData } = await supabase
          .from('airports')
          .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
          .in('icao_code', recentIcaos)
        if (recentData) {
          // Preserve the order of recentIcaos
          const sorted = recentIcaos
            .map(icao => recentData.find((a: Airport) => a.icao_code === icao))
            .filter(Boolean) as Airport[]
          setRecentAirports(sorted)
        }
      }

      // Pre-fill homebase airport if set (and no recent airport covers it)
      if (profile.homebase_icao) {
        const homebaseIcao = profile.homebase_icao as string
        // Check if homebase is already the first recent airport
        const firstRecent = (Array.isArray(profile.recent_airports) ? profile.recent_airports : [])[0]
        if (firstRecent !== homebaseIcao) {
          const { data } = await supabase
            .from('airports')
            .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
            .eq('icao_code', homebaseIcao)
            .single()
          if (data) {
            setSelectedAirport(data as Airport)
            setQuery(`${homebaseIcao} – ${(data as Airport).name}`)
          }
        } else if (recentIcaos.length > 0) {
          // Use first recent airport as default
          const { data } = await supabase
            .from('airports')
            .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
            .eq('icao_code', recentIcaos[0])
            .single()
          if (data) {
            setSelectedAirport(data as Airport)
            setQuery(`${recentIcaos[0]} – ${(data as Airport).name}`)
          }
        }
      } else if (recentIcaos.length > 0) {
        // No homebase set: pre-fill with most recent airport
        const { data } = await supabase
          .from('airports')
          .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
          .eq('icao_code', recentIcaos[0])
          .single()
        if (data) {
          setSelectedAirport(data as Airport)
          setQuery(`${recentIcaos[0]} – ${(data as Airport).name}`)
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user)
      if (session?.user) {
        loadProfile(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setIsLoggedIn(!!s?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load pinned nodes from localStorage on mount + on window focus (so
  // navigating back from /nodes immediately reflects the new pin)
  useEffect(() => {
    const load = () => setPinnedNodes(getPinnedNodes())
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  // Close node dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nodeDropdownRef.current && !nodeDropdownRef.current.contains(e.target as Node))
        setShowNodeDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchNodes = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setNodeResults([]); return }
    const { data } = await supabase
      .from('scenic_nodes')
      .select('id, name, osm_tags')
      .eq('is_active', true)
      .ilike('name', `%${q.trim()}%`)
      .order('sqi_total', { ascending: false })
      .limit(8)
    setNodeResults((data ?? []).map((n: any) => ({
      id: n.id, name: n.name, category: n.osm_tags?.category ?? '',
    })))
    setShowNodeDropdown(true)
  }, [])

  const handleNodeSearchChange = (val: string) => {
    setNodeSearch(val)
    if (nodeDebounceRef.current) clearTimeout(nodeDebounceRef.current)
    nodeDebounceRef.current = setTimeout(() => searchNodes(val), 250)
  }

  const pinNode = (node: { id: string; name: string; category: string }) => {
    const newPin: PinnedNode = { id: node.id, name: node.name, category_label: node.category }
    addPinnedNode(newPin)
    setPinnedNodes(getPinnedNodes())
    setNodeSearch('')
    setNodeResults([])
    setShowNodeDropdown(false)
  }

  const unpinNode = (id: string) => {
    removePinnedNode(id)
    setPinnedNodes(getPinnedNodes())
  }

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setAirports([]); return }
    const { data, error } = await supabase
      .from('airports')
      .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
      .or(`icao_code.ilike.${q}%,name.ilike.%${q}%`)
      .order('icao_code')
      .limit(8)
    if (!error && data) {
      setAirports(data as Airport[])
      setShowDropdown(true)
    } else if (error) {
      console.error('Airport search error (RLS?):', error.message)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSelectedAirport(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAirports(value), 250)
  }

  const selectAirport = (ap: Airport) => {
    setSelectedAirport(ap)
    setQuery(`${ap.icao_code} – ${ap.name}`)
    setShowDropdown(false)
    setAirports([])
  }

  // Save used airport to recent_airports in DB (keep last 3 unique, newest first)
  const saveRecentAirport = useCallback(async (icao: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('recent_airports')
      .eq('id', user.id)
      .single()

    const existing: string[] = Array.isArray(profile?.recent_airports) ? profile.recent_airports : []
    const updated = [icao, ...existing.filter((c: string) => c !== icao)].slice(0, 3)

    await supabase
      .from('users')
      .update({ recent_airports: updated })
      .eq('id', user.id)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isLoggedIn) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      return
    }

    // ── Auto-resolve airport if user typed ICAO without clicking dropdown ──
    let airport = selectedAirport
    if (!airport && query.trim().length >= 2) {
      const icao = query.trim().toUpperCase().replace(/\s.*/, '') // take first word
      const { data } = await supabase
        .from('airports')
        .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
        .eq('icao_code', icao)
        .single()
      if (data) airport = data as Airport
    }

    if (!airport) {
      setError('Bitte wähle einen Startflughafen aus der Liste.')
      return
    }

    onLoading(true)

    try {
      // Get cached session first; only call refreshSession() when the token
      // is missing or about to expire (< 5 min). This avoids breaking
      // fresh logins where refreshSession() can transiently return null.
      let { data: { session } } = await supabase.auth.getSession()
      if (!session || (session.expires_at ?? 0) * 1000 - Date.now() < 5 * 60_000) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (refreshed?.session) session = refreshed.session
      }
      if (!session) throw new Error('SESSION_EXPIRED')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-route`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            airport_icao: airport.icao_code,
            aircraft_profile_id: aircraft,
            block_time_mins: blockTime,
            airspace_mode: 'standard',
            ...(pinnedNodes.length > 0 && { required_node_ids: pinnedNodes.map(n => n.id) }),
          }),
        }
      )

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 401) throw new Error('SESSION_EXPIRED')
        throw new Error(errData.error || `Fehler ${res.status}`)
      }

      const raw = await res.json()

      // Helper: map API node → frontend Waypoint
      const mapNode = (node: any) => ({
        id: node.id ?? undefined,
        external_id: node.external_id ?? undefined,
        name: node.name,
        node_type: node.node_type ?? 'scenic',
        lat: node.lat,
        lon: node.lon,
        sqi_total: node.sqi_total,
        volata_score: node.volata_score ?? null,
        rating_count: node.rating_count ?? 0,
        elevation_m: node.elevation_msl_ft ? Math.round(node.elevation_msl_ft * 0.3048) : null,
        wikipedia_title: node.wikipedia_title ?? null,
        wikipedia_url: node.wikipedia_url ?? null,
      })

      // Map API response → frontend RouteResult
      const waypoints = (raw.nodes ?? []).map(mapNode)
      const variants = (raw.variants ?? []).map((v: any) => ({
        variant_index: v.variant_index,
        nodes: (v.nodes ?? []).map(mapNode),
        total_distance_nm: v.total_distance_nm,
        sqi_aggregate: v.sqi_aggregate,
        fpl_xml: v.fpl_xml,
      }))

      onResult({
        waypoints,
        variants,
        total_distance_nm: raw.total_distance_nm,
        departure_airport: airport,
        aircraft_type: aircraft,
        block_time_min: blockTime,
        sqi_avg: raw.sqi_aggregate,
        cached: raw.from_cache,
        generated_at: new Date().toISOString(),
        fn_version: raw.fn_version,
        warnings: Array.isArray(raw.warnings) && raw.warnings.length > 0 ? raw.warnings : undefined,
      })

      // Save this airport to recent_airports (fire-and-forget)
      saveRecentAirport(airport.icao_code)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg === 'SESSION_EXPIRED' ? '__SESSION_EXPIRED__' : msg)
    } finally {
      onLoading(false)
    }
  }

  const selectedAircraftData = AIRCRAFT_LIST.find(a => a.id === aircraft)

  // Decide what to show in the dropdown:
  // - If user is typing (query.length >= 2): show search results
  // - If query is empty / field just focused: show recent airports
  const showRecentSuggestions = showDropdown && airports.length === 0 && recentAirports.length > 0 && query.length < 2
  const showSearchResults = showDropdown && airports.length > 0

  // Apple input style
  const inputStyle = {
    width: '100%',
    background: '#f5f5f7',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '10px',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#1d1d1f',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Airport */}
      <div ref={dropdownRef} className="relative">
        <Label>Startflughafen</Label>
        <div className="relative mt-1.5">
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (airports.length > 0) setShowDropdown(true)
              else if (query.length >= 2) searchAirports(query)
              else if (recentAirports.length > 0) setShowDropdown(true) // show recents
            }}
            placeholder="ICAO oder Name…"
            style={inputStyle}
            onBlur={(e: any) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
          />
        </div>

        {/* Recent airports suggestions */}
        {showRecentSuggestions && (
          <div className="absolute top-full mt-1 w-full z-50 overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="text-xs font-semibold" style={{ color: '#aeaeb2' }}>Zuletzt geflogen</span>
            </div>
            {recentAirports.map(ap => (
              <button key={ap.icao_code} type="button" onClick={() => selectAirport(ap)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,113,227,0.08)', color: '#0071e3' }}>
                    {ap.icao_code}
                  </span>
                  <span className="text-sm truncate" style={{ color: '#1d1d1f' }}>{ap.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {showSearchResults && (
          <div className="absolute top-full mt-1 w-full z-50 overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            {airports.map(ap => (
              <button key={ap.icao_code} type="button" onClick={() => selectAirport(ap)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,113,227,0.08)', color: '#0071e3' }}>
                    {ap.icao_code}
                  </span>
                  <span className="text-sm truncate" style={{ color: '#1d1d1f' }}>{ap.name}</span>
                </div>
                {ap.airport_type && (
                  <div className="text-xs mt-0.5 ml-0.5" style={{ color: '#aeaeb2' }}>
                    {{ small_airport: 'Kleiner Flugplatz', medium_airport: 'Flughafen', large_airport: 'Internationaler Flughafen', heliport: 'Hubschrauberlandeplatz', seaplane_base: 'Wasserflugplatz', closed: 'Geschlossen' }[ap.airport_type] ?? ap.airport_type.replace(/_/g, ' ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Aircraft */}
      <div>
        <Label>Flugzeugtyp</Label>
        <div className="relative mt-1.5">
          <select value={aircraft} onChange={e => setAircraft(e.target.value)}
            style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' } as any}>
            {AIRCRAFT_LIST.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.cruise_kt} kt)</option>
            ))}
          </select>
        </div>
      </div>

      {/* Block Time */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <Label>Blockzeit</Label>
          <span className="text-sm font-semibold" style={{ color: '#0071e3' }}>
            {blockTime} min
            {selectedAircraftData && (
              <span className="text-xs font-normal ml-1.5" style={{ color: '#aeaeb2' }}>
                ≈ {Math.round(selectedAircraftData.cruise_kt * blockTime / 60)} nm
              </span>
            )}
          </span>
        </div>
        <input type="range" min={30} max={240} step={15} value={blockTime}
          onChange={e => setBlockTime(Number(e.target.value))}
          className="w-full" />
        <div className="flex justify-between text-xs mt-1" style={{ color: '#aeaeb2' }}>
          <span>30 min</span><span>4 Std</span>
        </div>
      </div>

      {/* ── Pflicht-Waypoints ─────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Label>Pflicht-Waypoints</Label>
          {pinnedNodes.length > 0 && (
            <span style={{ fontSize: 11, color: '#aeaeb2' }}>{pinnedNodes.length} / 5</span>
          )}
        </div>

        {/* Chips */}
        {pinnedNodes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {pinnedNodes.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.2)',
                borderRadius: 20, padding: '3px 10px 3px 8px',
              }}>
                <span style={{ fontSize: 12, color: '#0071e3', fontWeight: 600 }}>✈</span>
                <span style={{ fontSize: 12, color: '#1d1d1f', maxWidth: 140,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.name}
                </span>
                <button
                  type="button"
                  onClick={() => unpinNode(n.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: '#aeaeb2', padding: 0, lineHeight: 1,
                    marginLeft: 2,
                  }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Node search input */}
        {pinnedNodes.length < 5 && (
          <div ref={nodeDropdownRef} style={{ position: 'relative' }}>
            <input
              type="text"
              value={nodeSearch}
              onChange={e => handleNodeSearchChange(e.target.value)}
              onFocus={() => { if (nodeResults.length > 0) setShowNodeDropdown(true) }}
              placeholder="Viewpoint suchen…"
              style={{
                width: '100%', background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#1d1d1f', outline: 'none',
              }}
            />
            {showNodeDropdown && nodeResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', marginTop: 4, width: '100%', zIndex: 50,
                background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
              }}>
                {nodeResults
                  .filter(r => !pinnedNodes.find(p => p.id === r.id))
                  .map(r => (
                    <button
                      key={r.id} type="button"
                      onClick={() => pinNode(r)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span style={{ fontSize: 12, color: '#0071e3' }}>✈</span>
                      <span style={{ fontSize: 13, color: '#1d1d1f' }}>{r.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', color: '#ff3b30' }}>
          {error === '__SESSION_EXPIRED__' ? (
            <span>
              Deine Session ist abgelaufen.{' '}
              <button
                type="button"
                onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
                style={{ textDecoration: 'underline', background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
                Neu anmelden
              </button>
            </span>
          ) : error}
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={isLoading}
        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: isLoading ? 'rgba(0,113,227,0.4)' : isLoggedIn ? '#0071e3' : '#1d1d1f',
          color: '#ffffff',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          boxShadow: isLoggedIn && !isLoading ? '0 2px 8px rgba(0,113,227,0.3)' : 'none',
        }}
        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = isLoggedIn ? '#0077ed' : '#2d2d2f' }}
        onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = isLoggedIn ? '#0071e3' : '#1d1d1f' }}
      >
        {isLoading
          ? <><Spinner /> Berechne Route…</>
          : isLoggedIn
          ? 'Route berechnen'
          : '🔒 Anmelden & Route berechnen'
        }
      </button>
    </form>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#aeaeb2' }}>
      {children}
    </label>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
