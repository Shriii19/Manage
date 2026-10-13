import { useEffect, useState } from 'react'
import { clearAccessToken, getMe } from '../lib/api.ts'
import { authClient } from '../lib/auth-client.ts'
import './auth.css'

type BackendStatus =
  | { state: 'checking' }
  | { state: 'ok'; teams: number }
  | { state: 'error'; message: string }

type UserBarProps = {
  user: { name: string; email: string }
}

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserBar({ user }: UserBarProps) {
  const [status, setStatus] = useState<BackendStatus>({ state: 'checking' })
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    getMe()
      .then((me) => {
        if (!cancelled) setStatus({ state: 'ok', teams: me.teams.length })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({ state: 'error', message: err instanceof Error ? err.message : 'Backend unreachable' })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    clearAccessToken()
    const { error } = await authClient.signOut()
    if (error) {
      setSigningOut(false)
    }
  }

  const statusLabel =
    status.state === 'checking'
      ? 'Checking backend…'
      : status.state === 'ok'
        ? `Backend connected · ${status.teams} ${status.teams === 1 ? 'team' : 'teams'}`
        : `Backend: ${status.message}`

  return (
    <header className="user-bar">
      <div className="user-bar-identity">
        <span className="user-avatar" aria-hidden="true">
          {initialsOf(user.name, user.email)}
        </span>
        <div>
          <strong>{user.name || user.email}</strong>
          <span>{user.email}</span>
        </div>
      </div>

      <div className="user-bar-actions">
        <span className={`chip backend-${status.state}`}>{statusLabel}</span>
        <button className="btn btn-secondary" type="button" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </header>
  )
}
