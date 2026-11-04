import { useRef, useState } from 'react'
import { Icon } from '../components/Icon.tsx'
import {
  addPerson,
  createTeam,
  deleteTeam,
  errorMessage,
  removePerson,
  type Person,
  type Team,
} from '../lib/api.ts'

type Mode = 'idle' | 'new-team' | 'add-member'

type TeamBarProps = {
  teams: Team[]
  activeTeam: Team | null
  people: Person[]
  loading: boolean
  onSelectTeam: (teamId: string) => void
  onTeamCreated: (team: Team) => void
  onTeamDeleted: (teamId: string) => void
  onPersonAdded: (person: Person) => void
  onPersonRemoved: (personId: string) => void
}

export function TeamBar({
  teams,
  activeTeam,
  people,
  loading,
  onSelectTeam,
  onTeamCreated,
  onTeamDeleted,
  onPersonAdded,
  onPersonRemoved,
}: TeamBarProps) {
  const [mode, setMode] = useState<Mode>(teams.length === 0 ? 'new-team' : 'idle')
  const [teamName, setTeamName] = useState('')
  const [personName, setPersonName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const personInput = useRef<HTMLInputElement>(null)

  const isOwner = activeTeam?.role === 'owner'
  const canManage = isOwner || activeTeam?.role === 'manager'

  function toggleMode(next: Mode) {
    setMode((current) => (current === next ? 'idle' : next))
    setError('')
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      onTeamCreated(await createTeam(teamName.trim()))
      setTeamName('')
      setMode('idle')
    })
  }

  function handleAddPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeTeam) return
    void run(async () => {
      onPersonAdded(await addPerson(activeTeam.id, personName.trim()))
      // Keep the form open so several names can be added in a row.
      setPersonName('')
      personInput.current?.focus()
    })
  }

  function handleDeleteTeam() {
    if (!activeTeam) return
    const message = `Delete team "${activeTeam.name}"? Its members and all its assignments will be permanently deleted.`
    if (!window.confirm(message)) return
    void run(async () => {
      await deleteTeam(activeTeam.id)
      onTeamDeleted(activeTeam.id)
    })
  }

  function handleRemovePerson(person: Person) {
    if (!activeTeam) return
    if (!window.confirm(`Remove ${person.name} from this team? They will be removed from any assigned work.`)) return
    void run(async () => {
      await removePerson(activeTeam.id, person.id)
      onPersonRemoved(person.id)
    })
  }

  return (
    <section className="team-panel" aria-label="Team management">
      <p className="nav-label">Your team</p>
      <div className="team-bar-main">
        {teams.length > 0 ? (
          <label className="field compact">
            <span className="sr-only">Team</span>
            <select aria-label="Team" value={activeTeam?.id ?? ''} onChange={(event) => onSelectTeam(event.target.value)} disabled={busy}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="team-bar-hint">A place for your people and projects.</p>
        )}

      </div>

      <div className="team-quick-actions">
        <button className="text-button" type="button" onClick={() => toggleMode('new-team')} disabled={busy} aria-expanded={mode === 'new-team'}>
          <Icon name="plus" size={15} /> New team
        </button>
        {canManage && (
          <button className="text-button" type="button" onClick={() => toggleMode('add-member')} disabled={busy || loading} aria-expanded={mode === 'add-member'}>
            <Icon name="users" size={15} /> Add member
          </button>
        )}
      </div>

      {mode === 'new-team' && (
        <form className="team-bar-form" onSubmit={handleCreateTeam}>
          <input
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Team name"
            aria-label="New team name"
            maxLength={120}
            required
            disabled={busy}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create Team'}
          </button>
          <button className="text-button" type="button" onClick={() => setMode('idle')} disabled={busy}>Cancel</button>
        </form>
      )}

      {mode === 'add-member' && (
        <form className="team-bar-form" onSubmit={handleAddPerson}>
          <input
            ref={personInput}
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            placeholder="Member name, e.g. Shree"
            aria-label="New member name"
            maxLength={80}
            required
            disabled={busy}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button className="text-button" type="button" onClick={() => setMode('idle')} disabled={busy}>Done</button>
        </form>
      )}

      {activeTeam && <details className="team-details" open>
        <summary>Team members <span className="count-badge">{loading ? '–' : people.length}</span></summary>
        {loading ? <p className="field-hint">Loading your team…</p> : !people.length ? <p className="field-hint">{canManage ? 'Add your first team member to start assigning work.' : 'No team members added yet.'}</p> : <div className="team-people">
          {people.map((person) => (
            <div className="person-row" key={person.id}>
              <span className="mini-avatar" aria-hidden="true">{person.name.charAt(0).toUpperCase()}</span>
              <span>{person.name}</span>
              {canManage && (
                <button
                  type="button"
                  className="icon-button chip-remove"
                  onClick={() => handleRemovePerson(person)}
                  disabled={busy}
                  aria-label={`Remove ${person.name}`}
                  title={`Remove ${person.name}`}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>}
      </details>}

      {isOwner && <details className="team-settings"><summary>Team settings</summary><p className="field-hint">You’re the owner of this team.</p><button className="text-button text-danger" type="button" onClick={handleDeleteTeam} disabled={busy}><Icon name="trash" size={14} />Delete team</button></details>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
