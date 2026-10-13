import { useRef, useState } from 'react'
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
    if (!window.confirm(`Remove ${person.name}? Their assignments will become unassigned.`)) return
    void run(async () => {
      await removePerson(activeTeam.id, person.id)
      onPersonRemoved(person.id)
    })
  }

  return (
    <section className="team-bar">
      <div className="team-bar-main">
        {teams.length > 0 ? (
          <label className="field compact">
            <span>Team</span>
            <select value={activeTeam?.id ?? ''} onChange={(event) => onSelectTeam(event.target.value)}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="team-bar-hint">You are not in a team yet. Create one to start tracking assignments.</p>
        )}

        {activeTeam && (
          <span className="chip task-chip">
            {people.length} {people.length === 1 ? 'member' : 'members'}
          </span>
        )}
      </div>

      <div className="actions">
        <button className="btn btn-secondary" type="button" onClick={() => toggleMode('new-team')}>
          New Team
        </button>
        {canManage && (
          <button className="btn btn-secondary" type="button" onClick={() => toggleMode('add-member')}>
            Add Member
          </button>
        )}
        {isOwner && (
          <button className="btn btn-danger" type="button" onClick={handleDeleteTeam} disabled={busy}>
            Delete Team
          </button>
        )}
      </div>

      {mode === 'new-team' && (
        <form className="team-bar-form" onSubmit={handleCreateTeam}>
          <input
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Team name"
            maxLength={120}
            required
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create Team'}
          </button>
        </form>
      )}

      {mode === 'add-member' && (
        <form className="team-bar-form" onSubmit={handleAddPerson}>
          <input
            ref={personInput}
            value={personName}
            onChange={(event) => setPersonName(event.target.value)}
            placeholder="Member name, e.g. Shree"
            maxLength={80}
            required
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {people.length > 0 && (
        <div className="chips team-people">
          {people.map((person) => (
            <span className="chip task-chip person-chip" key={person.id}>
              {person.name}
              {canManage && (
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => handleRemovePerson(person)}
                  disabled={busy}
                  aria-label={`Remove ${person.name}`}
                  title={`Remove ${person.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
