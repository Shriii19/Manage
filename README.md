# Project Assignment Tracker

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express 5 + TypeScript + Drizzle ORM
- Database: Neon Postgres
- Auth: Neon Auth (managed Better Auth): email/password and Google sign-in

## How auth works

1. The frontend signs users in through Neon Auth (`@neondatabase/auth`). Users, sessions and OAuth
   accounts are stored by Neon in the `neon_auth` schema of the same database.
2. Before calling the backend, the frontend gets a short-lived JWT with `authClient.token()` and sends
   it as `Authorization: Bearer <jwt>`.
3. The backend verifies the JWT against Neon Auth's JWKS (`{NEON_AUTH_URL}/.well-known/jwks.json`),
   and uses its `sub` claim (the `neon_auth.user.id`) as the current user.
4. App tables (`teams`, `team_members`, `assignments`) live in `public` and reference `neon_auth.user`.

## Project Structure

```text
manage/
  frontend/
    src/lib/auth-client.ts   # Neon Auth client
    src/lib/api.ts           # fetch wrapper that attaches the JWT
    src/auth/                # custom sign-in / sign-up page, user bar
    src/Root.tsx             # session gate in front of the board
  backend/
    drizzle.config.ts
    src/env.ts               # validated environment variables
    src/db/                  # Drizzle schema + client
    src/middleware/          # JWT auth, error handling
    src/routes/              # /api/me, /api/teams, assignments
  database/                  # legacy local Docker Postgres (superseded by Neon + Drizzle migrations)
```

## Initialize the app

1. **Neon project.** Create a project in the [Neon Console](https://console.neon.tech) (AWS region;
   Neon Auth isn't available on Azure yet). Open **Auth** and click **Enable Auth**. Make sure
   Email/password and Google are enabled. Google works with Neon's shared credentials in development.
   Under **Auth → Configuration → Domains**, add `http://localhost:5173` if sign-in reports an
   untrusted origin.
2. **Create local env files** from the examples. In PowerShell, this preserves any `.env` files you
   already have:
   ```powershell
   if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
   if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
   ```
3. **Add your Neon URLs.** In `backend/.env`, set:
   - `DATABASE_URL` to the **pooled** Postgres connection string from Neon Console → **Connect**.
     Use the connection string for the Neon project/branch where you enabled Auth.
   - `NEON_AUTH_URL` to the Auth URL from Neon Console → **Auth → Configuration**.
   In `frontend/.env`, set `VITE_NEON_AUTH_URL` to that same Auth URL. Keep the example's
   `VITE_API_URL=/api` for local development; the Vite dev server forwards API requests to the backend.
   `FRONTEND_URL` in `backend/.env` should match the frontend's origin (default `http://localhost:5173`).
   These are different kinds of URLs: `DATABASE_URL` is a private database connection string, while
   the Auth URL is the endpoint used by the sign-in client and backend token verification. Do not
   commit your `.env` files.
4. **Install** from the repo root. Workspaces install both apps:
   ```bash
   npm install
   ```
5. **Create app tables.** Auth must already be enabled, because app tables reference
   `neon_auth.user`. These commands connect to `DATABASE_URL` and apply Drizzle migrations to the
   `public` schema; Neon manages its own `neon_auth` schema:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```
6. **Run** in two terminals:
   ```bash
   npm run dev:backend    # http://localhost:4000
   npm run dev:frontend   # http://localhost:5173 (proxies /api to the backend)
   ```

## What happens at runtime

The frontend signs users in through Neon Auth using `VITE_NEON_AUTH_URL`. It gets a short-lived JWT
and includes it with requests to the backend. The backend checks that token against the JWKS endpoint
derived from `NEON_AUTH_URL`, then uses `DATABASE_URL` to read or update app data in Postgres. In
short, Neon Auth owns sign-in, users, and sessions; this app's Drizzle migrations and API own teams,
members, and assignments. The old Docker database under `database/` is not used by this Neon setup.

## API

Every `/api/*` route requires `Authorization: Bearer <Neon Auth JWT>`.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/api/me` | signed-in user: profile + teams |
| GET / POST | `/api/teams` | list my teams / create a team (creator becomes owner) |
| PATCH / DELETE | `/api/teams/:teamId` | owner |
| GET | `/api/teams/:teamId/members` | any member |
| POST | `/api/teams/:teamId/members` | owner, manager (add an existing user by `email`) |
| PATCH | `/api/teams/:teamId/members/:userId` | owner (change role) |
| DELETE | `/api/teams/:teamId/members/:userId` | owner, manager (members only), or yourself |
| GET | `/api/teams/:teamId/assignments?status=open\|overdue\|completed&assigneeId=<uuid>\|me` | any member |
| POST | `/api/teams/:teamId/assignments` | owner, manager |
| PATCH | `/api/teams/:teamId/assignments/:id` | owner, manager; the assignee may only send `{ "completed": bool }` |
| DELETE | `/api/teams/:teamId/assignments/:id` | owner, manager |

## Next steps

- Switch the assignment board from `localStorage` to the assignments API, add a team picker, and add
  editing of existing assignments.
- Team management UI (create team, add members by email, roles).
- Password reset and email verification (configure in Neon Console → Auth).
