import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthChange, signIn } from '../api/admin'
import { Spinner } from './Spinner'
import './AdminGate.css'

// Wraps the admin pages: shows a login form until there's a Supabase session,
// then renders the page. This is a convenience gate, not the security
// boundary - row level security on the database is what actually blocks
// unauthenticated writes.
export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((existing) => {
        if (cancelled) return
        setSession(existing)
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })
    // Keeps this in sync with token refreshes and sign-outs from elsewhere.
    const unsubscribe = onAuthChange((next) => setSession(next))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch {
      setError('Incorrect email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) return <Spinner />
  if (session) return <>{children}</>

  return (
    <form className="admin-login" onSubmit={handleSubmit}>
      <h1>Admin Login</h1>

      <label className="admin-field">
        Email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="admin-field">
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && <p className="admin-error">{error}</p>}

      <button type="submit" className="admin-button" disabled={submitting || !email.trim() || !password}>
        {submitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
