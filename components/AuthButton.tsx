'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="h-8 w-32 rounded-lg animate-pulse" style={{ background: '#f5f5f7' }} />
  }

  if (!user) {
    return (
      <button onClick={handleLogin}
        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{ background: '#0071e3', color: '#ffffff' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#0077ed')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0071e3')}
      >
        <GoogleIcon />
        Mit Google anmelden
      </button>
    )
  }

  const name = user.user_metadata?.full_name || user.email || 'Pilot'
  const avatar = user.user_metadata?.avatar_url

  return (
    <div className="flex items-center gap-2.5">
      {avatar
        ? <img src={avatar} alt={name} className="w-7 h-7 rounded-full" style={{ border: '1.5px solid rgba(0,0,0,0.1)' }} />
        : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0071e3' }}>
            {name[0].toUpperCase()}
          </div>
      }
      <span className="text-sm hidden sm:block" style={{ color: '#1d1d1f' }}>{name.split(' ')[0]}</span>
      <button onClick={handleLogout}
        className="text-xs px-2.5 py-1 rounded-md transition-colors"
        style={{ color: '#6e6e73', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f7'; e.currentTarget.style.color = '#1d1d1f' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6e6e73' }}
      >
        Abmelden
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#fff" fillOpacity=".9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#fff" fillOpacity=".9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#fff" fillOpacity=".9" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#fff" fillOpacity=".9" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
