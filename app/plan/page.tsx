'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AuthButton from '@/components/AuthButton'
import RouteForm from '@/components/RouteForm'
import WaypointPanel from '@/components/WaypointPanel'
import type { RouteResult, Waypoint } from '@/lib/types'
import { supabase } from '@/lib/supabase'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

export default function Home() {
  const router = useRouter()
  const [result, setResult] = useState<RouteResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedWaypoint, setHighlightedWaypoint] = useState<Waypoint | null>(null)
  const [clickedWaypoint, setClickedWaypoint] = useState<Waypoint | null>(null)
  const [activeVariantIdx, setActiveVariantIdx] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatarLetter, setAvatarLetter] = useState('')

  // Auth guard + admin check
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/'); return }
      const name = data.user.user_metadata?.full_name ?? data.user.email ?? ''
      setAvatarLetter((name[0] ?? '').toUpperCase())
      const { data: profile } = await supabase
        .from('users').select('is_admin').eq('id', data.user.id).single()
      setIsAdmin(profile?.is_admin ?? false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // Reset variant selection when a new result arrives
  const handleResult = (r: RouteResult) => {
    setActiveVariantIdx(0)
    setResult(r)
  }

  // Derive the currently displayed waypoints from the active variant
  const activeWaypoints = result
    ? (result.variants[activeVariantIdx]?.nodes ?? result.waypoints)
    : []
  const activeDistanceNm = result
    ? (result.variants[activeVariantIdx]?.total_distance_nm ?? result.total_distance_nm)
    : 0

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f5f5f7' }}>

      {/* ── Top Bar ── */}
      <header style={{
        background: 'rgba(245,245,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }} className="flex-none flex items-center justify-between px-6 py-3 z-10">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 72" width="118" height="33" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="vSun" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FAC033"/>
                <stop offset="100%" stopColor="#E8910A"/>
              </linearGradient>
            </defs>

            {/* Sun / orange circle */}
            <circle cx="33" cy="36" r="30" fill="url(#vSun)"/>
            {/* Shimmer streaks */}
            <path d="M 7,21 Q 14,15 23,21" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 41,12 Q 49,9 56,15" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>

            {/* High wing — dark, sweeps dramatically up-left */}
            <path d="M 42,37 L 17,8 L 23,7 L 50,37 Z"
              fill="#111" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>

            {/* Vertical fin (tail) — bold dark */}
            <path d="M 17,38 C 15,30 14,25 15,21 C 16,18 20,19 22,23 L 24,37 Z"
              fill="#111" stroke="#111" strokeWidth="1.2"/>

            {/* Horizontal stabilizers */}
            <path d="M 17,37 L 8,34 L 8,37 L 17,39 Z"
              fill="white" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M 17,43 L 8,46 L 9,49 L 17,45 Z"
              fill="white" stroke="#111" strokeWidth="1.8" strokeLinejoin="round"/>

            {/* Fuselage — white with bold outline */}
            <path d="M 15,43 C 15,39 20,36 33,35.5 C 45,35 54,36.5 59,41.5 C 61,44 58,47.5 51,48 C 40,49 25,48 19,47.5 C 16.5,47 15,45.5 15,43 Z"
              fill="white" stroke="#111" strokeWidth="2.4" strokeLinejoin="round"/>

            {/* Cockpit windows — dark */}
            <path d="M 45,35.5 L 41,35.5 L 39,44 L 49,44 Z" fill="#111"/>
            <path d="M 51.5,36.5 L 47,35.5 L 47,44 L 54,42.5 Z" fill="#111"/>
            {/* Glass glint */}
            <path d="M 45,36.5 L 42,36.5 L 41,38.5 L 44.5,38 Z" fill="white" opacity="0.38"/>

            {/* Wing strut */}
            <line x1="44" y1="37" x2="39" y2="47.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>

            {/* Engine cowl */}
            <path d="M 57,38.5 C 60,37.5 63,39 63,41.5 C 63,44 60,45.5 57,44.5 Z"
              fill="#ddd" stroke="#111" strokeWidth="1.8"/>

            {/* Propeller blur arc */}
            <ellipse cx="64" cy="41.5" rx="2" ry="10" fill="#111" opacity="0.18"/>
            {/* Propeller blades */}
            <ellipse cx="64" cy="41.5" rx="1.8" ry="8.5" fill="#111" opacity="0.42"/>
            <ellipse cx="64" cy="41.5" rx="1.8" ry="8.5" fill="#111" transform="rotate(55 64 41.5)" opacity="0.42"/>
            {/* Spinner */}
            <circle cx="64" cy="41.5" r="2.4" fill="#111"/>
            <circle cx="64" cy="41.5" r="0.9" fill="#777"/>

            {/* Landing gear struts */}
            <line x1="37" y1="48" x2="35" y2="57" stroke="#111" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="47" y1="48" x2="50" y2="57" stroke="#111" strokeWidth="2.2" strokeLinecap="round"/>
            {/* Wheels */}
            <ellipse cx="34.5" cy="58" rx="3.8" ry="2.2" fill="#111"/>
            <ellipse cx="51" cy="58" rx="3.8" ry="2.2" fill="#111"/>

            {/* Antenna */}
            <line x1="43" y1="35.5" x2="41" y2="30" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/>

            <text x="78" y="29" fontFamily="Georgia, 'Times New Roman', serif" fontSize="30" fontWeight="bold" fill="#0d1b3e" letterSpacing="5">VOLATA</text>
            <text x="80" y="52" fontFamily="Arial, sans-serif" fontSize="10" fill="#0071e3" letterSpacing="3.2">SCENIC VFR ROUTES</text>
          </svg>
          <span className="hidden sm:inline text-xs px-2.5 py-0.5 rounded-full font-medium ml-1"
            style={{ background: 'rgba(0,113,227,0.08)', color: '#0071e3', border: '1px solid rgba(0,113,227,0.15)' }}>
            Beta
          </span>
          {isAdmin && <DevBox fnVersion={result?.fn_version} />}
        </div>

        <div className="flex items-center gap-3">
          <p className="hidden md:block text-xs text-right" style={{ color: '#aeaeb2', maxWidth: '220px' }}>
            Not for navigation. Pre-flight planning only.
          </p>
          <a href="/nodes" title="Scenic Nodes erkunden"
            style={{
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(0,113,227,0.08)', color: '#0071e3',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(0,113,227,0.15)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            🗺 Scenic Viewpoints
          </a>
          {avatarLetter && (
            <a href="/profile" title="Mein Profil"
              style={{
                padding: '5px 12px', borderRadius: 8,
                background: 'rgba(0,113,227,0.08)', color: '#0071e3',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
                border: '1px solid rgba(0,113,227,0.15)',
                transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: 5,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0071e3, #0055b3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{avatarLetter}</span>
              Profil
            </a>
          )}
          <AuthButton />
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="flex-none w-80 xl:w-96 flex flex-col overflow-hidden"
          style={{ background: '#ffffff', borderRight: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            <section>
              <RouteForm onResult={handleResult} onLoading={setIsLoading} isLoading={isLoading} />
            </section>

            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'rgba(0,113,227,0.2)', borderTopColor: '#0071e3' }} />
                <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>Berechne Scenic Route…</p>
                <p className="text-xs text-center" style={{ color: '#aeaeb2' }}>
                  SQI-Scores · Luftraum · Optimierung
                </p>
              </div>
            )}

            {result && !isLoading && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader title="Deine Route" />
                  {result.cached && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(48,209,88,0.1)', color: '#30d158' }}>
                      Gecacht
                    </span>
                  )}
                </div>

                {/* Variant tab switcher */}
                {result.variants.length > 1 && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {result.variants.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveVariantIdx(i)}
                        className="flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all"
                        style={{
                          border: `1.5px solid ${activeVariantIdx === i ? '#0071e3' : 'rgba(0,0,0,0.1)'}`,
                          background: activeVariantIdx === i ? 'rgba(0,113,227,0.08)' : '#f5f5f7',
                          color: activeVariantIdx === i ? '#0071e3' : '#6e6e73',
                          minWidth: '60px',
                        }}
                      >
                        <span className="font-bold">Route {i + 1}</span>
                        <span style={{ opacity: 0.75, fontSize: '10px' }}>
                          {Math.round(v.total_distance_nm)} nm
                        </span>
                        <span style={{ opacity: 0.75, fontSize: '10px' }}>
                          SQI {Math.round(v.sqi_aggregate * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="mb-4 rounded-xl px-4 py-3 flex gap-2.5 items-start"
                    style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)' }}>
                    <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>⚠️</span>
                    <div className="space-y-1">
                      {result.warnings.map((w, i) => (
                        <p key={i} className="text-xs leading-relaxed" style={{ color: '#b36200' }}>{w}</p>
                      ))}
                    </div>
                  </div>
                )}

                <WaypointPanel
                  result={result}
                  activeWaypoints={activeWaypoints}
                  activeDistanceNm={activeDistanceNm}
                  onWaypointHover={setHighlightedWaypoint}
                  onWaypointClick={(wp) => setClickedWaypoint({ ...wp, _ts: Date.now() } as any)}
                />
              </section>
            )}
          </div>

          <div className="flex-none px-5 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="text-xs text-center" style={{ color: '#d2d2d7' }}>
              © 2026 Volata · OurAirports · OpenStreetMap · OpenAIP
            </p>
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="flex-1 relative">
          <MapView
            result={result}
            activeWaypoints={activeWaypoints}
            highlightedWaypoint={highlightedWaypoint}
            clickedWaypoint={clickedWaypoint}
          />
        </main>
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#aeaeb2' }}>
      {title}
    </h2>
  )
}

function DevBox({ fnVersion }: { fnVersion?: string }) {
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  const resetLimit = async () => {
    setStatus('idle')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('err'); return }
    const { error } = await supabase
      .from('users')
      .update({ routes_generated_today: 0 })
      .eq('id', user.id)
    setStatus(error ? 'err' : 'ok')
    if (!error) setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
      style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
      <span className="text-xs font-semibold" style={{ color: '#ff9500' }}>DEV</span>
      {fnVersion != null && (
        <span className="text-xs font-mono" style={{ color: '#ff9500', opacity: 0.75 }}>
          fn v{fnVersion}
        </span>
      )}
      <a href="/admin/nodes"
        className="text-xs px-2 py-0.5 rounded font-medium transition-all"
        style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500', textDecoration: 'none' }}>
        Admin
      </a>
      <button
        onClick={resetLimit}
        className="text-xs px-2 py-0.5 rounded font-medium transition-all"
        style={{ background: 'rgba(255,149,0,0.15)', color: '#ff9500' }}
      >
        {status === 'ok' ? '✓ Reset' : status === 'err' ? '✗ Fehler' : 'Reset Limit'}
      </button>
    </div>
  )
}
