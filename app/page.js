'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WGHub from '../components/WGHub'
import '../components/cadence/login.css'

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email,         setEmail        ] = useState('')
  const [password,      setPassword     ] = useState('')
  const [loading,       setLoading      ] = useState(false)
  const [emailError,    setEmailError   ] = useState(false)
  const [passwordError, setPasswordError] = useState(false)

  function handleThemeToggle() {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('cadence-theme', next)
  }

  const handleLogin = async (e) => {
    e.preventDefault()

    // Client-side: malformed or empty email
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailOk) {
      setEmailError(true)
      setPasswordError(false)
      return
    }

    setEmailError(false)
    setPasswordError(false)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      const msg = (error.message || '').toLowerCase()
      // Explicit email-related failure → email field only
      const isEmailSpecific =
        msg.includes('not confirmed') ||
        msg.includes('not found') ||
        (msg.includes('email') && !msg.includes('credentials'))
      if (isEmailSpecific) {
        setEmailError(true)
        setPasswordError(false)
      } else {
        // Generic ("Invalid login credentials") → both fields highlighted, password message shown
        setEmailError(true)
        setPasswordError(true)
      }
    }
    // On success: onAuthStateChange fires in Page() and updates session state
  }

  return (
    <div className="signin-page">
      <div className="login-ambient" />

      <button
        className="login-theme-toggle r r-1"
        onClick={handleThemeToggle}
        aria-label="Toggle theme"
      >
        <svg className="t-icon t-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <svg className="t-icon t-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>

      <div className="signin-shell">
        <div className="brand r r-1">
          <div className="wordmark">
            cadence<span className="dot" />
          </div>
          <div className="tagline">Welcome back.</div>
        </div>

        <form className="signin-form r r-2" onSubmit={handleLogin}>
          <div className={`field${emailError ? ' error' : ''}`}>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(false) }}
            />
            <div className="err-msg">Check the email address and try again.</div>
          </div>

          <div className={`field${passwordError ? ' error' : ''}`}>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(false) }}
            />
            <div className="err-msg">Wrong password.</div>
          </div>

          <button
            type="submit"
            className={`btn-primary${loading ? ' loading' : ''}`}
          >
            <span className="label-text">Sign in</span>
            <svg
              className="arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>

          <a href="#" className="forgot" onClick={e => e.preventDefault()}>
            Forgot password
          </a>
        </form>
      </div>

      <div className="login-footer r r-4">
        <span>Cadence</span>
        <span className="sep">·</span>
        <span>v1.0</span>
        <span className="sep">·</span>
        <span>lovingly vibe coded by gidney</span>
      </div>
    </div>
  )
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function Page() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="login-splash">
        <div className="login-splash-spinner" />
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  return <WGHub onSignOut={() => supabase.auth.signOut()} />
}
