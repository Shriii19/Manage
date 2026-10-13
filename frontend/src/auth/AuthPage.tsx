import { useState, type FormEvent } from 'react'
import { authClient } from '../lib/auth-client.ts'
import '../App.css'
import './auth.css'

type Mode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignUp = mode === 'sign-up'

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)

    try {
      if (isSignUp) {
        const { data, error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        })
        if (error) {
          setError(error.message ?? 'Could not create your account.')
          return
        }
        // No session token means Neon Auth is waiting on email verification.
        if (!data?.token) {
          setMode('sign-in')
          setNotice('Account created. Check your inbox to verify your email, then sign in.')
        }
      } else {
        const { error } = await authClient.signIn.email({ email: email.trim(), password })
        if (error) {
          setError(error.message ?? 'Could not sign in.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    })
    if (error) {
      setError(error.message ?? 'Google sign-in failed.')
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="panel auth-panel">
        <header>
          <p className="kicker">Project Assignment Tracker</p>
          <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p className="subtitle">
            {isSignUp
              ? 'Sign up to create a team and start assigning work.'
              : "Sign in to see your team's assignments."}
          </p>
        </header>

        <button className="btn btn-secondary btn-google" type="button" onClick={handleGoogle} disabled={busy}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or use email</span>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="field">
              <span>Full Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Jane Doe"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              maxLength={128}
              placeholder={isSignUp ? 'At least 8 characters' : ''}
              required
            />
          </label>

          <p className="error" role="alert" aria-live="polite">
            {error}
          </p>
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
          >
            {isSignUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
