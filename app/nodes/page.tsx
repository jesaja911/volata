'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addPinnedNode, isPinned, removePinnedNode } from '@/lib/pinned-nodes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenicNode {
  id: string
  name: string
  sqi_total: number
  volata_score: number | null
  rating_count: number
  osm_tags: { category?: string } | null
  lat: number
  lon: number
  wikipedia_url: string | null
}

type CategoryFilter = 'all' | 'castle' | 'palace' | 'monastery' | 'cathedral' | 'monument' | 'peak' | 'lighthouse' | 'waterfall' | 'lake' | 'viewpoint' | 'natural_monument'

const CATEGORY_LABEL: Record<string, string> = {
  castle:          '🏰 Burg',
  palace:          '🏛 Schloss',
  monastery:       '⛪ Kloster',
  cathedral:       '⛪ Dom / Kathedrale',
  monument:        '🗿 Denkmal',
  peak:            '⛰ Gipfel',
  lighthouse:      '🔭 Leuchtturm',
  waterfall:       '💧 Wasserfall',
  lake:            '🌊 See',
  viewpoint:       '👁 Aussicht',
  natural_monument:'🌳 Naturdenkmal',
}

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all',             label: 'Alle' },
  { key: 'castle',          label: '🏰 Burgen' },
  { key: 'palace',          label: '🏛 Schlösser' },
  { key: 'cathedral',       label: '⛪ Kirchen' },
  { key: 'monastery',       label: '⛪ Klöster' },
  { key: 'monument',        label: '🗿 Denkmäler' },
  { key: 'peak',            label: '⛰ Gipfel' },
  { key: 'lake',            label: '🌊 Seen' },
  { key: 'waterfall',       label: '💧 Wasserfälle' },
  { key: 'viewpoint',       label: '👁 Aussichten' },
  { key: 'natural_monument',label: '🌳 Naturdenkmäler' },
  { key: 'lighthouse',      label: '🔭 Leuchttürme' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SqiBar({ sqi }: { sqi: number }) {
  const pct = Math.round(sqi * 100)
  const color = pct >= 80 ? '#a855f7' : pct >= 70 ? '#30d158' : pct >= 55 ? '#f59e0b' : '#94a3b8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, background: '#e5e5ea', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}</span>
    </div>
  )
}

function StarRating({
  nodeId, currentRating, onRated,
}: {
  nodeId: string
  currentRating: number | null
  onRated: (stars: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleRate = async (stars: number) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    await supabase.from('node_ratings').upsert(
      { user_id: user.id, scenic_node_id: nodeId, stars },
      { onConflict: 'user_id,scenic_node_id' }
    )
    onRated(stars)
    setSaving(false)
  }

  const display = hovered || currentRating || 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          disabled={saving}
          onClick={() => handleRate(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none', border: 'none', cursor: saving ? 'default' : 'pointer',
            fontSize: 16, padding: '0 1px', lineHeight: 1,
            color: s <= display ? '#ffcc00' : '#d1d1d6',
            transition: 'color 0.1s',
          }}
        >
          ★
        </button>
      ))}
      {currentRating && (
        <span style={{ fontSize: 10, color: '#aeaeb2', marginLeft: 2 }}>
          {currentRating.toFixed(0)}★
        </span>
      )}
    </div>
  )
}

function FavoriteButton({
  nodeId, isFav, currentRating, onToggle, onAutoRated,
}: {
  nodeId: string
  isFav: boolean
  currentRating: number | null
  onToggle: (id: string, newState: boolean) => void
  onAutoRated: (nodeId: string, stars: number) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    if (isFav) {
      await supabase.from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('scenic_node_id', nodeId)
    } else {
      // Add to favorites — also auto-rate 5★ if not yet rated
      await supabase.from('user_favorites')
        .insert({ user_id: user.id, scenic_node_id: nodeId })
      if (!currentRating) {
        await supabase.from('node_ratings').upsert(
          { user_id: user.id, scenic_node_id: nodeId, stars: 5 },
          { onConflict: 'user_id,scenic_node_id' }
        )
        onAutoRated(nodeId, 5)
      }
    }
    onToggle(nodeId, !isFav)
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      style={{
        background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
        fontSize: 18, lineHeight: 1, padding: 0,
        color: isFav ? '#ef4444' : '#d1d1d6',
        transition: 'color 0.15s, transform 0.1s',
        transform: loading ? 'scale(0.9)' : 'scale(1)',
      }}
    >
      {isFav ? '♥' : '♡'}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NodesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  // Data
  const [nodes, setNodes] = useState<ScenicNode[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)

  // User data
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [myRatings, setMyRatings] = useState<Map<string, number>>(new Map())

  const PAGE_SIZE = 60

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/plan'); return }
      setUserId(data.user.id)
    })
  }, [router])

  // ── Load user favorites + ratings ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    // Favorites
    supabase.from('user_favorites').select('scenic_node_id').eq('user_id', userId).then(({ data }) => {
      setFavorites(new Set((data ?? []).map((r: any) => r.scenic_node_id)))
    })
    // My ratings
    supabase.from('node_ratings').select('scenic_node_id, stars').eq('user_id', userId).then(({ data }) => {
      const map = new Map<string, number>()
      ;(data ?? []).forEach((r: any) => map.set(r.scenic_node_id, r.stars))
      setMyRatings(map)
    })
  }, [userId])

  // ── Load nodes ────────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    let q = supabase
      .from('scenic_nodes')
      .select('id, name, sqi_total, volata_score, rating_count, osm_tags, lat, lon, wikipedia_url', { count: 'exact' })
      .eq('is_active', true)
      .order('sqi_total', { ascending: false })
      .limit(PAGE_SIZE)

    if (categoryFilter !== 'all') {
      q = q.eq('osm_tags->>category', categoryFilter)
    }
    if (search.trim()) {
      q = q.ilike('name', `%${search.trim()}%`)
    }
    if (showFavsOnly && favorites.size > 0) {
      q = q.in('id', [...favorites])
    } else if (showFavsOnly && favorites.size === 0) {
      setNodes([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    const { data, count } = await q
    setNodes(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [userId, categoryFilter, search, showFavsOnly, favorites])

  useEffect(() => { fetchNodes() }, [fetchNodes])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFavToggle = (nodeId: string, newState: boolean) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (newState) next.add(nodeId)
      else next.delete(nodeId)
      return next
    })
  }

  const handleRated = (nodeId: string, stars: number) => {
    setMyRatings(prev => new Map(prev).set(nodeId, stars))
  }

  // ── Pinned state (re-renders on toggle) ───────────────────────────────────
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  useEffect(() => {
    // Sync initial pinned state from localStorage
    import('@/lib/pinned-nodes').then(({ getPinnedNodes }) => {
      setPinned(new Set(getPinnedNodes().map(n => n.id)))
    })
  }, [])

  const handleHinfliegen = (node: ScenicNode) => {
    const cat = node.osm_tags?.category ?? ''
    addPinnedNode({ id: node.id, name: node.name, category_label: CATEGORY_LABEL[cat] ?? cat })
    setPinned(prev => new Set([...prev, node.id]))
    router.push('/plan')
  }

  const handleUnpin = (nodeId: string) => {
    removePinnedNode(nodeId)
    setPinned(prev => { const s = new Set(prev); s.delete(nodeId); return s })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => router.push('/plan')}
          style={{ color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          ← Zurück
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1d1d1f' }}>
          🗺 Scenic Viewpoints
        </h1>
        <span style={{ fontSize: 12, color: '#aeaeb2', marginLeft: 'auto' }}>
          {totalCount.toLocaleString()} Nodes · zeige {nodes.length}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '10px 24px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                background: categoryFilter === f.key ? '#0071e3' : '#e5e5ea',
                color: categoryFilter === f.key ? '#ffffff' : '#6e6e73',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Search + Favorites filter */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name suchen…"
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.1)',
              color: '#1d1d1f', outline: 'none', width: 220,
            }}
          />
          <button
            onClick={() => setShowFavsOnly(v => !v)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: showFavsOnly ? '#ef444420' : '#e5e5ea',
              color: showFavsOnly ? '#ef4444' : '#6e6e73',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            ♥ Favoriten
          </button>
        </div>
      </div>

      {/* Node grid */}
      <div style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2', fontSize: 15 }}>Lade…</div>
        ) : nodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2', fontSize: 15 }}>
            {showFavsOnly ? 'Noch keine Favoriten gespeichert.' : 'Keine Nodes gefunden.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {nodes.map(node => {
              const cat = node.osm_tags?.category ?? ''
              const isFav = favorites.has(node.id)
              const myRating = myRatings.get(node.id) ?? null

              return (
                <div
                  key={node.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: isFav ? '1.5px solid rgba(239,68,68,0.3)' : '1px solid rgba(0,0,0,0.07)',
                    padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    boxShadow: isFav ? '0 2px 12px rgba(239,68,68,0.08)' : '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                >
                  {/* Top row: name + fav */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1d1d1f', lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6e6e73', marginTop: 2 }}>
                        {CATEGORY_LABEL[cat] ?? cat}
                      </div>
                    </div>
                    <FavoriteButton
                      nodeId={node.id}
                      isFav={isFav}
                      currentRating={myRating}
                      onToggle={handleFavToggle}
                      onAutoRated={(id, stars) => handleRated(id, stars)}
                    />
                  </div>

                  {/* SQI bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#aeaeb2', width: 32, flexShrink: 0 }}>SQI</span>
                    <SqiBar sqi={node.sqi_total} />
                  </div>

                  {/* Community score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#aeaeb2', width: 32, flexShrink: 0 }}>⌀</span>
                    {node.volata_score != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#ffcc00', fontSize: 12 }}>
                          {'★'.repeat(Math.round(node.volata_score))}{'☆'.repeat(5 - Math.round(node.volata_score))}
                        </span>
                        <span style={{ fontSize: 11, color: '#6e6e73' }}>
                          {node.volata_score.toFixed(1)} ({node.rating_count})
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#c7c7cc' }}>Noch keine Bewertungen</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '2px 0' }} />

                  {/* My rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#aeaeb2', width: 32, flexShrink: 0 }}>Du</span>
                    <StarRating
                      nodeId={node.id}
                      currentRating={myRating}
                      onRated={(stars) => handleRated(node.id, stars)}
                    />
                    {myRating == null && (
                      <span style={{ fontSize: 11, color: '#c7c7cc' }}>Noch nicht bewertet</span>
                    )}
                  </div>

                  {/* Footer: links + Hinfliegen */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <a
                      href={`https://maps.google.com/?q=${node.lat},${node.lon}`}
                      target="_blank"
                      rel="noopener"
                      style={{ fontSize: 10, color: '#0071e3', textDecoration: 'none' }}>
                      📍 Karte
                    </a>
                    {node.wikipedia_url && (
                      <a
                        href={node.wikipedia_url}
                        target="_blank"
                        rel="noopener"
                        style={{ fontSize: 10, color: '#0071e3', textDecoration: 'none' }}>
                        📖 Wikipedia
                      </a>
                    )}
                    <button
                      onClick={() => pinned.has(node.id) ? handleUnpin(node.id) : handleHinfliegen(node)}
                      style={{
                        marginLeft: 'auto', padding: '4px 10px', borderRadius: 7,
                        border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        transition: 'all 0.15s',
                        background: pinned.has(node.id) ? 'rgba(239,68,68,0.1)' : '#0071e3',
                        color: pinned.has(node.id) ? '#ef4444' : '#ffffff',
                      }}>
                      {pinned.has(node.id) ? '✕ Entfernen' : '✈ Hinfliegen'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
