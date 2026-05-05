'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WGHub from '../components/WGHub'

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail   ] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError   ] = useState('')
  const [loading,  setLoading ] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onLogin()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#07090f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#0d1018', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: '#00e676', letterSpacing: 2 }}>WG</span>
            <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, letterSpacing: 2 }}>HUB</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6b7a96', letterSpacing: 2 }}>PERFORMANCE DASHBOARD</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6b7a96', letterSpacing: '1.5px' }}>EMAIL</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoComplete="email"
              style={{ fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#6b7a96', letterSpacing: '1.5px' }}>PASSWORD</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password"
              style={{ fontSize: 14 }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#ff6b6b' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background: loading ? '#0d1018' : '#00e676',
            color: loading ? '#6b7a96' : '#07090f',
            border: loading ? '1px solid rgba(255,255,255,0.07)' : 'none',
            borderRadius: 8, padding: '12px',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', letterSpacing: 1,
            transition: 'all 0.2s', marginTop: 4,
          }}>
            {loading ? 'SIGNING IN...' : 'SIGN IN →'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#4a5568', textAlign: 'center', lineHeight: 1.6 }}>
          Private access only.<br/>
          Create your account in the Supabase dashboard.
        </div>
      </div>
    </div>
  )
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // Listen for auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Still checking auth
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 20, height: 20, border: '2px solid #00e676', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#6b7a96' }}>Loading...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onLogin={() => {}} />
  }

  return <WGHub onSignOut={() => supabase.auth.signOut()} />
}
