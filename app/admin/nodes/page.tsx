'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface ScenicNode {
  id: string
  name: string
  external_id: string
  is_active: boolean
  sqi_total: number
  volata_score: number | null
  rating_count: number
  wikidata_sitelinks: number
  wikipedia_url: string | null
  osm_tags: { category?: string; wikidata?: string } | null
  lat: number
  lon: number
}

interface AppUser {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  routes_generated_today: number
  created_at: string
}

interface UserDetail {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  is_admin: boolean
  homebase_icao: string | null
  preferred_airport_icao: string | null
  pilot_license: string | null
  daily_limit: number | null
  tier: string | null
  routes_generated_today: number
  created_at: string
}

interface UserRating {
  id: string
  stars: number
  created_at: string
  scenic_node_id: string
  node_name: string
}

type Filter = 'all' | 'low_score' | 'inactive' | 'no_wiki'
type Tab = 'nodes' | 'users'

function StarDisplay({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: '#4a5568', fontSize: 12 }}>–</span>
  const full = Math.round(score)
  return (
    <span style={{ color: '#ffcc00', fontSize: 13 }}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>{score.toFixed(1)}</span>
    </span>
  )
}

function SqiPill({ sqi }: { sqi: number }) {
  const pct = Math.round(sqi * 100)
  const color = pct >= 80 ? '#a855f7' : pct >= 75 ? '#30d158' : pct >= 60 ? '#f59e0b' : '#94a3b8'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color,
      background: `${color}20`, padding: '1px 6px', borderRadius: 4,
    }}>{pct}</span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('nodes')

  // ── Nodes state ──────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<ScenicNode[]>([])
  const [nodesLoading, setNodesLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [editingWiki, setEditingWiki] = useState<string | null>(null)
  const [wikiInput, setWikiInput] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  // ── Users state ───────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AppUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [togglingUser, setTogglingUser] = useState<string | null>(null)

  // ── User detail panel ─────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [userRatings, setUserRatings] = useState<UserRating[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Auth guard: check is_admin from DB ───────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/plan'); return }
      const { data: profile } = await supabase
        .from('users').select('is_admin').eq('id', data.user.id).single()
      if (!profile?.is_admin) router.replace('/plan')
    })
  }, [router])

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    setNodesLoading(true)
    let q = supabase
      .from('scenic_nodes')
      .select('id, name, external_id, is_active, sqi_total, volata_score, rating_count, wikidata_sitelinks, wikipedia_url, osm_tags, lat, lon', { count: 'exact' })
      .order('rating_count', { ascending: false })
      .order('sqi_total', { ascending: false })
      .limit(200)

    if (filter === 'low_score') q = q.lte('volata_score', 1.5).not('volata_score', 'is', null)
    if (filter === 'inactive')  q = q.eq('is_active', false)
    if (filter === 'no_wiki')   q = q.is('wikipedia_url', null)
    if (search.trim())          q = q.ilike('name', `%${search.trim()}%`)

    const { data, count } = await q
    setNodes(data ?? [])
    setTotalCount(count ?? 0)
    setNodesLoading(false)
  }, [filter, search])

  useEffect(() => { fetchNodes() }, [fetchNodes])

  const toggleActive = async (node: ScenicNode) => {
    setSaving(node.id)
    await supabase.from('scenic_nodes').update({ is_active: !node.is_active }).eq('id', node.id)
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, is_active: !n.is_active } : n))
    setSaving(null)
  }

  const resetRatings = async (nodeId: string) => {
    if (!confirm('Alle Bewertungen für diesen Node löschen?')) return
    setSaving(nodeId)
    await supabase.from('node_ratings').delete().eq('scenic_node_id', nodeId)
    await supabase.from('scenic_nodes').update({ volata_score: null, rating_count: 0 }).eq('id', nodeId)
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, volata_score: null, rating_count: 0 } : n))
    setSaving(null)
  }

  const saveWikiUrl = async (nodeId: string) => {
    setSaving(nodeId)
    await supabase.from('scenic_nodes').update({ wikipedia_url: wikiInput.trim() || null }).eq('id', nodeId)
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, wikipedia_url: wikiInput.trim() || null } : n))
    setEditingWiki(null)
    setSaving(null)
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    const { data } = await supabase
      .from('admin_user_view')
      .select('id, email, full_name, is_admin, routes_generated_today, created_at')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setUsersLoading(false)
  }, [])

  useEffect(() => { if (tab === 'users') fetchUsers() }, [tab, fetchUsers])

  const toggleAdmin = async (user: AppUser) => {
    setTogglingUser(user.id)
    await supabase.from('users').update({ is_admin: !user.is_admin }).eq('id', user.id)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u))
    setTogglingUser(null)
  }

  const openUserDetail = async (user: AppUser) => {
    setDetailLoading(true)
    setSelectedUser(null)
    setUserRatings([])

    // Load full profile
    const { data: profile } = await supabase
      .from('admin_user_view')
      .select('id, email, full_name, display_name, is_admin, homebase_icao, preferred_airport_icao, pilot_license, daily_limit, tier, routes_generated_today, created_at')
      .eq('id', user.id)
      .single()

    if (profile) setSelectedUser(profile as UserDetail)

    // Load ratings with node names
    const { data: ratings } = await supabase
      .from('node_ratings')
      .select('id, stars, created_at, scenic_node_id, scenic_nodes(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (ratings) {
      setUserRatings(ratings.map((r: any) => ({
        id: r.id,
        stars: r.stars,
        created_at: r.created_at,
        scenic_node_id: r.scenic_node_id,
        node_name: r.scenic_nodes?.name ?? '–',
      })))
    }
    setDetailLoading(false)
  }

  const filterBtns: { key: Filter; label: string }[] = [
    { key: 'all',       label: 'Alle' },
    { key: 'low_score', label: '⭐ Score ≤ 1.5' },
    { key: 'inactive',  label: '🚫 Inaktiv' },
    { key: 'no_wiki',   label: '🔗 Kein Wiki-Override' },
  ]

  const CATEGORY_LABEL: Record<string, string> = {
    castle: '🏰 Burg', palace: '🏛 Schloss', monastery: '⛪ Kloster',
    cathedral: '⛪ Dom / Kathedrale', monument: '🗿 Denkmal',
    peak: '⛰ Gipfel', lighthouse: '🔭 Leuchtturm', waterfall: '💧 Wasserfall',
    lake: '🌊 See', viewpoint: '👁 Aussicht', natural_monument: '🌳 Naturdenkmal',
  }

  const tabStyle = (t: Tab) => ({
    padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none',
    background: tab === t ? '#0071e3' : 'transparent',
    color: tab === t ? 'white' : '#6e6e73',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', color: '#1d1d1f', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => router.push('/plan')}
          style={{ color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          ← Zurück
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Admin · Volata</h1>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 24, background: '#f0f0f3', borderRadius: 10, padding: 3 }}>
          <button style={tabStyle('nodes')} onClick={() => setTab('nodes')}>🗺 Nodes</button>
          <button style={tabStyle('users')} onClick={() => setTab('users')}>👤 User-Management</button>
        </div>

        {tab === 'nodes' && (
          <span style={{ fontSize: 12, color: '#aeaeb2', marginLeft: 'auto' }}>
            {totalCount.toLocaleString()} Nodes · zeige {nodes.length}
          </span>
        )}
        {tab === 'users' && (
          <span style={{ fontSize: 12, color: '#aeaeb2', marginLeft: 'auto' }}>
            {users.length} User{users.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── NODES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'nodes' && <>
        {/* Toolbar */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {filterBtns.map(b => (
            <button key={b.key} onClick={() => setFilter(b.key)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === b.key ? '#0071e3' : '#e5e5ea',
                color: filter === b.key ? 'white' : '#6e6e73',
                border: 'none',
              }}>
              {b.label}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name suchen…"
            style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, fontSize: 12,
              background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f',
              outline: 'none', width: 200,
            }}
          />
        </div>

        {/* Table */}
        <div style={{ padding: '0 24px 24px', overflowX: 'auto' }}>
          {nodesLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2' }}>Lade…</div>
          ) : nodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2' }}>Keine Nodes gefunden</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 13, background: '#ffffff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#aeaeb2', textAlign: 'left' }}>
                  {['Name', 'Kategorie', 'SQI', '★ Score', 'Bewertungen', 'Sitelinks', 'Status', 'Wikipedia', 'Aktionen'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nodes.map(node => (
                  <tr key={node.id}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    <td style={{ padding: '10px 10px', maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: node.is_active ? '#1d1d1f' : '#aeaeb2' }}>{node.name}</div>
                      <div style={{ fontSize: 10, color: '#aeaeb2', marginTop: 2 }}>
                        <a href={`https://www.wikidata.org/wiki/${node.external_id}`} target="_blank" rel="noopener"
                          style={{ color: '#3b82f6', textDecoration: 'none' }}>{node.external_id}</a>
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#6e6e73', fontSize: 12 }}>
                      {CATEGORY_LABEL[node.osm_tags?.category ?? ''] ?? node.osm_tags?.category ?? '–'}
                    </td>
                    <td style={{ padding: '10px 10px' }}><SqiPill sqi={node.sqi_total} /></td>
                    <td style={{ padding: '10px 10px' }}><StarDisplay score={node.volata_score} /></td>
                    <td style={{ padding: '10px 10px', color: '#6e6e73', fontSize: 12, textAlign: 'center' }}>
                      {node.rating_count > 0
                        ? <span style={{ background: '#e5e5ea', borderRadius: 10, padding: '1px 7px', color: '#1d1d1f' }}>{node.rating_count}</span>
                        : <span style={{ color: '#c7c7cc' }}>–</span>}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#aeaeb2', fontSize: 11, textAlign: 'center' }}>
                      {node.wikidata_sitelinks}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: node.is_active ? '#30d158' : '#ef4444',
                        background: node.is_active ? '#30d15818' : '#ef444418',
                        padding: '2px 8px', borderRadius: 10,
                      }}>
                        {node.is_active ? 'aktiv' : 'inaktiv'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', maxWidth: 220 }}>
                      {editingWiki === node.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            value={wikiInput}
                            onChange={e => setWikiInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveWikiUrl(node.id); if (e.key === 'Escape') setEditingWiki(null) }}
                            placeholder="https://de.wikipedia.org/wiki/…"
                            autoFocus
                            style={{
                              fontSize: 11, padding: '3px 6px', borderRadius: 4,
                              background: '#f5f5f7', border: '1px solid #0071e3', color: '#1d1d1f',
                              outline: 'none', width: 180,
                            }}
                          />
                          <button onClick={() => saveWikiUrl(node.id)}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#0071e3', color: 'white', border: 'none', cursor: 'pointer' }}>
                            {saving === node.id ? '…' : '✓'}
                          </button>
                          <button onClick={() => setEditingWiki(null)}
                            style={{ fontSize: 11, padding: '3px 6px', borderRadius: 4, background: '#e5e5ea', color: '#6e6e73', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {node.wikipedia_url
                            ? <a href={node.wikipedia_url} target="_blank" rel="noopener"
                                style={{ color: '#0071e3', fontSize: 11, textDecoration: 'none', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                {node.wikipedia_url.replace('https://de.wikipedia.org/wiki/', '')}
                              </a>
                            : <span style={{ color: '#c7c7cc', fontSize: 11 }}>auto</span>
                          }
                          <button
                            onClick={() => { setEditingWiki(node.id); setWikiInput(node.wikipedia_url ?? '') }}
                            style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#e5e5ea', color: '#6e6e73', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                            ✎
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleActive(node)}
                          disabled={saving === node.id}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                            background: node.is_active ? '#ef444420' : '#30d15820',
                            color: node.is_active ? '#ef4444' : '#30d158',
                            fontWeight: 600,
                          }}>
                          {saving === node.id ? '…' : node.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                        {node.rating_count > 0 && (
                          <button
                            onClick={() => resetRatings(node.id)}
                            disabled={saving === node.id}
                            style={{
                              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                              background: '#f59e0b20', color: '#f59e0b', fontWeight: 600,
                            }}>
                            ★ Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>}

      {/* ── USERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div style={{ padding: '24px' }}>
          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2' }}>Lade…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aeaeb2' }}>Keine User gefunden</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#ffffff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#aeaeb2', textAlign: 'left' }}>
                  {['Name / E-Mail', 'Rolle', 'Routen heute', 'Registriert', 'Aktion'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.1s', cursor: 'pointer' }}
                    onClick={() => openUserDetail(user)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Name / Email */}
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1d1d1f' }}>{user.full_name ?? '–'}</div>
                      <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>{user.email}</div>
                    </td>

                    {/* Rolle */}
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: user.is_admin ? '#a855f720' : '#e5e5ea',
                        color: user.is_admin ? '#a855f7' : '#6e6e73',
                      }}>
                        {user.is_admin ? '⚡ Admin' : '👤 User'}
                      </span>
                    </td>

                    {/* Routen heute */}
                    <td style={{ padding: '12px 12px', color: '#6e6e73', fontSize: 12 }}>
                      {user.routes_generated_today ?? 0}
                    </td>

                    {/* Registriert */}
                    <td style={{ padding: '12px 12px', color: '#aeaeb2', fontSize: 11 }}>
                      {new Date(user.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>

                    {/* Aktion */}
                    <td style={{ padding: '12px 12px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleAdmin(user)}
                        disabled={togglingUser === user.id}
                        style={{
                          fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                          background: user.is_admin ? '#ef444420' : '#a855f720',
                          color: user.is_admin ? '#ef4444' : '#a855f7',
                          fontWeight: 600,
                        }}>
                        {togglingUser === user.id ? '…' : user.is_admin ? 'Admin entfernen' : 'Zum Admin machen'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── USER DETAIL PANEL ──────────────────────────────────────────────── */}
      {(selectedUser || detailLoading) && (
        <>
          {/* Overlay */}
          <div
            onClick={() => { setSelectedUser(null); setUserRatings([]) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: '#ffffff', boxShadow: '-4px 0 40px rgba(0,0,0,0.12)',
            zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #0071e3, #0055b3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {(selectedUser?.full_name ?? selectedUser?.email ?? '?')[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1d1d1f',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedUser?.full_name ?? '–'}
                </div>
                <div style={{ fontSize: 12, color: '#aeaeb2',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedUser?.email}
                </div>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setUserRatings([]) }}
                style={{
                  background: '#f5f5f7', border: 'none', borderRadius: 8,
                  width: 30, height: 30, cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#6e6e73',
                }}>
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {detailLoading && !selectedUser ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#aeaeb2' }}>Lade…</div>
              ) : selectedUser && (
                <>
                  {/* Profile section */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#aeaeb2',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Profil
                    </div>
                    <div style={{
                      background: '#f5f5f7', borderRadius: 12, padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      {[
                        { label: 'Anzeigename', value: selectedUser.display_name ?? '–' },
                        { label: 'Vollständiger Name', value: selectedUser.full_name ?? '–' },
                        { label: 'Rolle', value: selectedUser.is_admin ? '⚡ Admin' : '👤 User' },
                        { label: 'Tier', value: selectedUser.tier ?? '–' },
                        { label: 'Homebase', value: selectedUser.homebase_icao ?? '–' },
                        { label: 'Bevorzugter Flugplatz', value: selectedUser.preferred_airport_icao ?? '–' },
                        { label: 'Pilotenlizenz', value: selectedUser.pilot_license ?? '–' },
                        { label: 'Tages-Limit', value: selectedUser.daily_limit?.toString() ?? '–' },
                        { label: 'Routen heute', value: selectedUser.routes_generated_today?.toString() ?? '0' },
                        { label: 'Registriert', value: new Date(selectedUser.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6e6e73' }}>{label}</span>
                          <span style={{ fontSize: 13, color: '#1d1d1f', fontWeight: 500, textAlign: 'right', maxWidth: 200,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ratings section */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#aeaeb2',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Bewertungen</span>
                      <span style={{ fontWeight: 400, color: '#c7c7cc' }}>{userRatings.length}</span>
                    </div>
                    {userRatings.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#c7c7cc', fontSize: 13 }}>
                        Noch keine Bewertungen
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {userRatings.map(r => (
                          <div key={r.id} style={{
                            background: '#f5f5f7', borderRadius: 10, padding: '10px 14px',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.node_name}
                              </div>
                              <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>
                                {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </div>
                            </div>
                            <div style={{ color: '#ffcc00', fontSize: 15, flexShrink: 0 }}>
                              {'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
