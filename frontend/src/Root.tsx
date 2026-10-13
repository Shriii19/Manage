import App from './App.tsx'
import { AuthPage } from './auth/AuthPage.tsx'
import { UserBar } from './auth/UserBar.tsx'
import { authClient } from './lib/auth-client.ts'
import './auth/auth.css'

export function Root() {
  const session = authClient.useSession()

  if (session.isPending) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!session.data) {
    return <AuthPage />
  }

  return (
    <>
      <UserBar user={session.data.user} />
      <App />
    </>
  )
}
