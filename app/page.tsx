'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  // If already logged in, go straight to the app
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace('/plan')
      } else {
        setLoading(false)
      }
    })
  }, [router])

  const handleLogin = async () => {
    setSigningIn(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#fff',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', position: 'relative', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>

      {/* ── Background Image ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=1800&auto=format&fit=crop&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        filter: 'brightness(0.55)',
      }} />

      {/* ── Gradient overlay ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,20,60,0.5) 50%, rgba(0,0,0,0.3) 100%)',
      }} />

      {/* ── Content ── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        gap: 0,
      }}>

        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, marginTop: 60 }}>
          <span style={{ fontSize: 44, lineHeight: 1 }}>🛩️</span>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.04em',
              lineHeight: 1,
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
            }}>
              Volata
            </h1>
            <p style={{
              margin: '4px 0 0',
              fontSize: 16,
              color: 'rgba(255,255,255,0.65)',
              letterSpacing: '0.02em',
              fontWeight: 400,
            }}>
              Scenic VFR Routes
            </p>
          </div>
        </div>

        {/* Tagline */}
        <p style={{
          margin: '0 0 8px',
          fontSize: 20,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.9)',
          textAlign: 'center',
          maxWidth: 520,
          lineHeight: 1.4,
          textShadow: '0 1px 8px rgba(0,0,0,0.5)',
        }}>
          Automatisch generierte Sichtflugrouten zu den schönsten Orten Deutschlands.
        </p>

        {/* Sub-tagline */}
        <p style={{
          margin: '0 0 40px',
          fontSize: 15,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          Starte am nächsten Flugplatz · Wähle deine Blockzeit · Volata findet die Route.
        </p>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={signingIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 28px',
            borderRadius: 14,
            border: 'none',
            background: signingIn ? 'rgba(255,255,255,0.15)' : '#ffffff',
            color: signingIn ? 'rgba(255,255,255,0.5)' : '#1d1d1f',
            fontSize: 15,
            fontWeight: 600,
            cursor: signingIn ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { if (!signingIn) e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)' }}
        >
          {signingIn ? (
            <>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
              Anmelden…
            </>
          ) : (
            <>
              <GoogleIcon />
              Mit Google anmelden
            </>
          )}
        </button>

        {/* Beta badge */}
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.15)',
            letterSpacing: '0.03em',
          }}>
            Beta · Deutschland
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Nicht für die Navigation geeignet.
          </span>
        </div>

        {/* Teaser Screenshot */}
        <div style={{
          marginTop: 52,
          position: 'relative',
          maxWidth: 720,
          width: '100%',
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute',
            inset: -1,
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(0,113,227,0.5), rgba(100,200,255,0.2))',
            filter: 'blur(12px)',
          }} />
          <img
            src="/teaser.jpg"
            alt="Volata App Preview"
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: 14,
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'block',
            }}
          />
          {/* Fade bottom of teaser into background */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.0))',
            borderRadius: '0 0 14px 14px',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
