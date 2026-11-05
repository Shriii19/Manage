import { useState } from 'react'
import { clearAccessToken } from '../lib/api.ts'
import { authClient } from '../lib/auth-client.ts'
import { Icon } from '../components/Icon.tsx'
import './auth.css'

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
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    setError('')
    try {
      const { error: signOutError } = await authClient.signOut()
      if (signOutError) throw new Error(signOutError.message ?? 'Could not sign out. Please try again.')
      clearAccessToken()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out. Please try again.')
      setSigningOut(false)
    }
  }

  return (
    <header className="user-bar">
      <a className="app-brand" href="/" aria-label="Manage home"><span className="brand-mark">m<span>.</span></span><strong>manage<span>.</span></strong></a>
      <span className="topbar-label">A little structure. A lot of possibility.</span>
      <div className="user-bar-actions">
        {error && <span className="error" role="alert">{error}</span>}
        <div className="user-bar-identity">
          <span className="user-avatar" aria-hidden="true">
            {initialsOf(user.name, user.email)}
          </span>
          <div>
            <strong>{user.name || user.email}</strong>
            <span>{user.email}</span>
          </div>
        </div>

        <button className="icon-button sign-out" type="button" onClick={handleSignOut} disabled={signingOut} aria-label={signingOut ? 'Signing out' : 'Sign out'} title="Sign out">
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  )
}
