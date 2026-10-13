import { authClient } from './auth-client.ts'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

// Neon Auth JWTs live 15 minutes; refresh a minute early so requests never race expiry.
const REFRESH_MARGIN_MS = 60_000

export type TeamRole = 'owner' | 'manager' | 'member'

export type Priority = 'Low' | 'Medium' | 'High'

export type Team = { id: string; name: string; role: TeamRole; createdAt: string }

export type Me = {
  user: { id: string; email: string; name: string }
  teams: Team[]
}

/** Someone work can be assigned to: just a name within a team, no account needed. */
export type Person = { id: string; name: string; createdAt: string }

export type Assignment = {
  id: string
  teamId: string
  projectName: string
  /** Sorted by name; empty when nobody is assigned. */
  assignees: Array<{ id: string; name: string }>
  createdBy: string | null
  assignDate: string
  deadline: string
  priority: Priority
  tasks: string[]
  notes: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AssignmentInput = {
  projectName: string
  personIds: string[]
  assignDate: string
  deadline: string
  priority: Priority
  tasks: string[]
  notes: string
}

export type AssignmentPatch = Partial<AssignmentInput & { completed: boolean }>

type ErrorBody = {
  error?: string
  issues?: Array<{ path: string; message: string }>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null

function readExpiry(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return (exp ?? 0) * 1000
  } catch {
    return 0
  }
}

export function clearAccessToken() {
  cachedToken = null
}

const isJwt = (value: unknown): value is string =>
  typeof value === 'string' && value.split('.').length === 3

/**
 * Neon Auth attaches the JWT to `session.token`. Its fetch layer also answers GET /token from the
 * session cache, so `authClient.token()` can return `{ session, user }` instead of `{ token }`.
 */
async function fetchJwt(): Promise<string | null> {
  const session = await authClient.getSession()
  if (isJwt(session.data?.session?.token)) {
    return session.data.session.token
  }

  const fallback = await authClient.token()
  return isJwt(fallback.data?.token) ? fallback.data.token : null
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.value
  }

  const token = await fetchJwt().catch(() => null)
  if (!token) {
    cachedToken = null
    throw new ApiError(401, 'Not signed in')
  }

  cachedToken = { value: token, expiresAt: readExpiry(token) }
  return token
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${await getAccessToken()}`)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (response.status === 401) {
    clearAccessToken()
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null
    const details = body?.issues?.map((issue) => issue.message).join('; ')
    throw new ApiError(response.status, details || body?.error || `Request failed (${response.status})`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback
}

const jsonBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export const getMe = () => apiFetch<Me>('/me')

export const createTeam = (name: string) => apiFetch<Team>('/teams', jsonBody('POST', { name }))

export const deleteTeam = (teamId: string) => apiFetch<void>(`/teams/${teamId}`, { method: 'DELETE' })

export const listPeople = (teamId: string) => apiFetch<Person[]>(`/teams/${teamId}/people`)

export const addPerson = (teamId: string, name: string) =>
  apiFetch<Person>(`/teams/${teamId}/people`, jsonBody('POST', { name }))

export const removePerson = (teamId: string, personId: string) =>
  apiFetch<void>(`/teams/${teamId}/people/${personId}`, { method: 'DELETE' })

export const listAssignments = (teamId: string) =>
  apiFetch<Assignment[]>(`/teams/${teamId}/assignments`)

export const createAssignment = (teamId: string, input: AssignmentInput) =>
  apiFetch<Assignment>(`/teams/${teamId}/assignments`, jsonBody('POST', input))

export const updateAssignment = (teamId: string, assignmentId: string, patch: AssignmentPatch) =>
  apiFetch<Assignment>(`/teams/${teamId}/assignments/${assignmentId}`, jsonBody('PATCH', patch))

export const deleteAssignment = (teamId: string, assignmentId: string) =>
  apiFetch<void>(`/teams/${teamId}/assignments/${assignmentId}`, { method: 'DELETE' })
