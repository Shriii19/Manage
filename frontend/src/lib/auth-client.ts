import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!authUrl) {
  throw new Error('VITE_NEON_AUTH_URL is not set. Copy frontend/.env.example to frontend/.env and fill it in.')
}

export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
})
