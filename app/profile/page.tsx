'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AIRCRAFT_LIST } from '@/lib/types'
import type { Airport } from '@/lib/types'

// ── Shared styles ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#6e6e73',
  marginBottom: '6px',
  letterSpacing: '0.01em',
}

const sectionCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid rgba(0,0,0,0.07)',
  padding: '24px',
  marginBottom: '16px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 600,
  color: '#1d1d1f',
  marginBottom: '20px',
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={labelStyle}>{children}</label>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 0' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
          border: checked ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
          background: checked ? '#0071e3' : '#f5f5f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {checked && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: '14px', color: '#1d1d1f' }}>{label}</span>
    </label>
  )
}

// ── Airport search sub-component ─────────────────────────────────────────────
function AirportSearch({
  value, onChange
}: {
  value: Airport | null
  onChange: (ap: Airport | null, icao: string) => void
}) {
  const [query, setQuery] = useState(value ? `${value.icao_code} – ${value.name}` : '')
  const [airports, setAirports] = useState<Airport[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync query if external value changes
  useEffect(() => {
    if (value) setQuery(`${value.icao_code} – ${value.name}`)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchAirports = useCallback(async (q: string) => {
    if (q.length < 2) { setAirports([]); return }
    const { data } = await supabase
      .from('airports')
      .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
      .or(`icao_code.ilike.${q}%,name.ilike.%${q}%`)
      .order('icao_code')
      .limit(8)
    if (data) { setAirports(data as Airport[]); setShowDropdown(true) }
  }, [])

  const handleQueryChange = (v: string) => {
    setQuery(v)
    onChange(null, v.toUpperCase().split(/\s/)[0])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAirports(v), 250)
  }

  const selectAirport = (ap: Airport) => {
    setQuery(`${ap.icao_code} – ${ap.name}`)
    onChange(ap, ap.icao_code)
    setShowDropdown(false)
    setAirports([])
  }

  return (
    <div ref={dropdownRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        onFocus={() => { if (airports.length > 0) setShowDropdown(true) }}
        placeholder="ICAO oder Name…"
        style={inputStyle}
      />
      {showDropdown && airports.length > 0 && (
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [avatarLetter, setAvatarLetter] = useState('?')

  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [homebases, setHomebase] = useState<Airport | null>(null)
  const [homebaseIcao, setHomebaeIcao] = useState('')
  const [pilotLicense, setPilotLicense] = useState('')
  const [medicalClass, setMedicalClass] = useState('')
  const [medicalExpiry, setMedicalExpiry] = useState('')
  const [irRating, setIrRating] = useState(false)
  const [nightRating, setNightRating] = useState(false)
  const [totalFlightHours, setTotalFlightHours] = useState('')
  const [ownAircraftReg, setOwnAircraftReg] = useState('')
  const [preferredAircraftId, setPreferredAircraftId] = useState('')

  // Load profile
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

      setEmail(user.email ?? '')
      const name = user.user_metadata?.full_name ?? user.email ?? '?'
      setAvatarLetter((name[0] ?? '?').toUpperCase())

      const { data: profile } = await supabase
        .from('users')
        .select('display_name, homebase_icao, pilot_license, medical_class, medical_expiry, ir_rating, night_rating, total_flight_hours, own_aircraft_reg, preferred_aircraft_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setHomebaeIcao(profile.homebase_icao ?? '')
        setPilotLicense(profile.pilot_license ?? '')
        setMedicalClass(profile.medical_class ?? '')
        setMedicalExpiry(profile.medical_expiry ?? '')
        setIrRating(profile.ir_rating ?? false)
        setNightRating(profile.night_rating ?? false)
        setTotalFlightHours(profile.total_flight_hours?.toString() ?? '')
        setOwnAircraftReg(profile.own_aircraft_reg ?? '')
        setPreferredAircraftId(profile.preferred_aircraft_id ?? '')

        // Resolve homebase airport name if ICAO set
        if (profile.homebase_icao) {
          const { data: ap } = await supabase
            .from('airports')
            .select('icao_code, name, lat, lon, elevation_msl_ft, airport_type')
            .eq('icao_code', profile.homebase_icao)
            .single()
          if (ap) setHomebase(ap as Airport)
        }
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: saveError } = await supabase
      .from('users')
      .update({
        display_name: displayName || null,
        homebase_icao: (homebases?.icao_code ?? homebaseIcao) || null,
        pilot_license: pilotLicense || null,
        medical_class: medicalClass || null,
        medical_expiry: medicalExpiry || null,
        ir_rating: irRating,
        night_rating: nightRating,
        total_flight_hours: totalFlightHours ? parseInt(totalFlightHours) : null,
        own_aircraft_reg: ownAircraftReg || null,
        preferred_aircraft_id: preferredAircraftId || null,
      })
      .eq('id', user.id)

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(0,113,227,0.2)', borderTopColor: '#0071e3', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(245,245,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <button onClick={() => router.push('/plan')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#0071e3', fontSize: 14, fontWeight: 500, padding: '6px 0' }}>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6L6 11" stroke="#0071e3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Zurück
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f' }}>Mein Profil</span>
          <div style={{ width: 60 }} />
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Avatar + name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0071e3, #0055b3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {avatarLetter}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1d1d1f' }}>
              {displayName || email.split('@')[0]}
            </div>
            <div style={{ fontSize: 13, color: '#6e6e73', marginTop: 2 }}>{email}</div>
          </div>
        </div>

        {/* ── Section: Allgemein ────────────────────────────────────────────── */}
        <div style={sectionCardStyle}>
          <div style={sectionTitleStyle}>Allgemein</div>

          <Field label="Anzeigename">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Dein Name oder Rufzeichen"
              style={inputStyle}
            />
          </Field>

          <Field label="E-Mail">
            <input
              type="text"
              value={email}
              readOnly
              style={{ ...inputStyle, background: '#f0f0f0', color: '#aeaeb2', cursor: 'not-allowed' }}
            />
            <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
              Wird über dein Google-Konto verwaltet
            </div>
          </Field>

          <Field label="Heimatflughafen (Homebase)">
            <AirportSearch
              value={homebases}
              onChange={(ap, icao) => {
                setHomebase(ap)
                setHomebaeIcao(ap ? ap.icao_code : icao)
              }}
            />
            {homebases && (
              <div style={{ fontSize: 11, color: '#30d158', marginTop: 4 }}>
                ✓ Wird beim Starten als Standard-Abflughafen vorausgewählt
              </div>
            )}
          </Field>
        </div>

        {/* ── Section: Flugprofil ───────────────────────────────────────────── */}
        <div style={sectionCardStyle}>
          <div style={sectionTitleStyle}>Flugprofil</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Lizenz">
              <select
                value={pilotLicense}
                onChange={e => setPilotLicense(e.target.value)}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', WebkitAppearance: 'none' } as any}
              >
                <option value="">– keine Angabe –</option>
                <option value="LAPL-A">LAPL-A</option>
                <option value="PPL-A">PPL-A</option>
                <option value="CPL-A">CPL-A</option>
                <option value="ATPL">ATPL</option>
                <option value="PPL-H">PPL-H</option>
                <option value="UL">Ultraleicht (UL)</option>
              </select>
            </Field>

            <Field label="Medical">
              <select
                value={medicalClass}
                onChange={e => setMedicalClass(e.target.value)}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', WebkitAppearance: 'none' } as any}
              >
                <option value="">– keine Angabe –</option>
                <option value="Class 1">Klasse 1</option>
                <option value="Class 2">Klasse 2</option>
                <option value="LAPL">LAPL Medical</option>
              </select>
            </Field>
          </div>

          <Field label="Medical gültig bis">
            <input
              type="date"
              value={medicalExpiry}
              onChange={e => setMedicalExpiry(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Zusatzberechtigungen">
            <div style={{ background: '#f5f5f7', borderRadius: 10, padding: '4px 12px' }}>
              <CheckboxField
                label="IR (Instrumentenflugberechtigung)"
                checked={irRating}
                onChange={setIrRating}
              />
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
              <CheckboxField
                label="Nachtflugberechtigung"
                checked={nightRating}
                onChange={setNightRating}
              />
            </div>
          </Field>

          <Field label="Gesamtflugstunden">
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={totalFlightHours}
                onChange={e => setTotalFlightHours(e.target.value)}
                placeholder="z.B. 250"
                min="0"
                style={{ ...inputStyle, paddingRight: '40px' }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#aeaeb2', pointerEvents: 'none' }}>
                h
              </span>
            </div>
          </Field>
        </div>

        {/* ── Section: Mein Flugzeug ────────────────────────────────────────── */}
        <div style={sectionCardStyle}>
          <div style={sectionTitleStyle}>Mein Flugzeug</div>

          <Field label="Kennzeichen (eigenes Flugzeug)">
            <input
              type="text"
              value={ownAircraftReg}
              onChange={e => setOwnAircraftReg(e.target.value.toUpperCase())}
              placeholder="z.B. D-EABC"
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
          </Field>

          <Field label="Bevorzugter Flugzeugtyp (für Routenplanung)">
            <select
              value={preferredAircraftId}
              onChange={e => setPreferredAircraftId(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', WebkitAppearance: 'none' } as any}
            >
              <option value="">– keinen Standard setzen –</option>
              {AIRCRAFT_LIST.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.cruise_kt} kt)</option>
              ))}
            </select>
            {preferredAircraftId && (
              <div style={{ fontSize: 11, color: '#30d158', marginTop: 4 }}>
                ✓ Wird automatisch in der Routenplanung vorausgewählt
              </div>
            )}
          </Field>
        </div>

        {/* ── Save button ──────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#ff3b30',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px',
            background: saved ? '#30d158' : '#0071e3',
            color: '#fff', fontSize: '15px', fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s, transform 0.1s',
            opacity: saving ? 0.8 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
              Speichern…
            </>
          ) : saved ? (
            <>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 6L6 11L15 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Gespeichert
            </>
          ) : (
            'Profil speichern'
          )}
        </button>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        `}</style>

      </div>
    </div>
  )
}
