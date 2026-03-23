'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * OAuth callback page — runs client-side so the browser's Supabase client
 * can handle the PKCE code exchange using the code verifier it stored in
 * localStorage during signInWithOAuth(). The session is then persisted to
 * localStorage and the user is redirected to the app root.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Supabase JS v2 with detectSessionInUrl=true (default) automatically
    // calls exchangeCodeForSession when it sees ?code=... in the URL.
    // We just need to wait for SIGNED_IN and then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        subscription.unsubscribe()
        router.replace('/plan')
      }
    })

    // Fallback: if no SIGNED_IN fires within 3s, redirect anyway
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      router.replace('/plan')
    }, 3000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      color: '#666',
    }}>
      Anmelden…
    </div>
  )
}
