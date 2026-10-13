import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  createAssignment,
  deleteAssignment as deleteAssignmentRequest,
  errorMessage,
  getMe,
  listAssignments,
  listPeople,
  updateAssignment,
  type Assignment,
  type Person,
  type Priority,
  type Team,
} from './lib/api.ts'
import { LegacyImportBanner } from './team/LegacyImportBanner.tsx'
import { TeamBar } from './team/TeamBar.tsx'

type Status = 'Open' | 'Overdue' | 'Completed'

type StatusFilter = 'all' | 'open' | 'overdue' | 'completed'

type FormState = {
  projectName: string
  personIds: string[]
  assignDate: string
  deadline: string
  priority: Priority
  customTasks: string
  notes: string
}

type Session = { teams: Team[] }

type LoadState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string }

const ACTIVE_TEAM_KEY = 'project-assignments-active-team'

const TASK_OPTIONS = [
  'Frontend',
  'Backend',
  'API',
  'Admin',
  'QA',
  'DevOps',
  'Database',
  'UI/UX',
] as const

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
]

function todayYmd(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStatus(item: Assignment): Status {
  if (item.completedAt) {
    return 'Completed'
  }

  if (item.deadline < todayYmd()) {
    return 'Overdue'
  }

  return 'Open'
}

function getDaysInfo(deadline: string, completed: boolean): string {
  if (completed) {
    return 'completed'
  }

  const now = new Date()
  const end = new Date(`${deadline}T23:59:59`)
  const diffMs = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 1) {
    return `${diffDays} days left`
  }

  if (diffDays === 1) {
    return '1 day left'
  }

  if (diffDays === 0) {
    return 'due today'
  }

  return `${Math.abs(diffDays)} days late`
}

function assigneeLabel(item: Assignment): string {
  return item.assignees.length > 0 ? item.assignees.map((person) => person.name).join(', ') : 'Unassigned'
}

/** Prefer the last team the user picked, falling back to their first team. */
function pickTeamId(teams: Team[]): string | null {
  const saved = localStorage.getItem(ACTIVE_TEAM_KEY)
  return teams.find((team) => team.id === saved)?.id ?? teams[0]?.id ?? null
}

function getDefaultFormState(): FormState {
  return {
    projectName: '',
    personIds: [],
    assignDate: todayYmd(),
    deadline: '',
    priority: 'Medium',
    customTasks: '',
    notes: '',
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionState, setSessionState] = useState<LoadState>({ state: 'loading' })
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [teamState, setTeamState] = useState<LoadState>({ state: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState<FormState>(getDefaultFormState)
  const [checkedTasks, setCheckedTasks] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pendingIds, setPendingIds] = useState<string[]>([])

  const [sessionKey, setSessionKey] = useState(0)

  // Load the signed-in user and their teams (again on retry).
  useEffect(() => {
    let cancelled = false

    getMe()
      .then((me) => {
        if (cancelled) return
        setSession({ teams: me.teams })
        setActiveTeamId(pickTeamId(me.teams))
        setSessionState({ state: 'ready' })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSessionState({ state: 'error', message: errorMessage(err, 'Backend unreachable') })
        }
      })

    return () => {
      cancelled = true
    }
  }, [sessionKey])

  // Load people and assignments whenever the active team changes (or on retry).
  // Callers set teamState to 'loading' before changing activeTeamId/reloadKey.
  useEffect(() => {
    if (!activeTeamId) {
      return
    }

    let cancelled = false

    Promise.all([listPeople(activeTeamId), listAssignments(activeTeamId)])
      .then(([nextPeople, nextAssignments]) => {
        if (cancelled) return
        setPeople(nextPeople)
        setAssignments(nextAssignments)
        setTeamState({ state: 'ready' })
      })
      .catch((err: unknown) => {
        if (!cancelled) setTeamState({ state: 'error', message: errorMessage(err) })
      })

    return () => {
      cancelled = true
    }
  }, [activeTeamId, reloadKey])

  const activeTeam = session?.teams.find((team) => team.id === activeTeamId) ?? null
  const canManage = activeTeam?.role === 'owner' || activeTeam?.role === 'manager'
  const teamReady = teamState.state === 'ready'

  const filteredAssignments = useMemo(() => {
    const needle = assigneeFilter.trim().toLowerCase()
    return assignments
      .filter((item) => {
        const status = getStatus(item).toLowerCase()
        const statusMatch = statusFilter === 'all' || status === statusFilter
        const assigneeMatch =
          !needle || item.assignees.some((person) => person.name.toLowerCase().includes(needle))
        return statusMatch && assigneeMatch
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
  }, [assignments, assigneeFilter, statusFilter])

  const stats = useMemo(() => {
    const open = assignments.filter((item) => getStatus(item) === 'Open').length
    const overdue = assignments.filter((item) => getStatus(item) === 'Overdue').length
    const completed = assignments.filter((item) => getStatus(item) === 'Completed').length
    return { open, overdue, completed }
  }, [assignments])

  function selectTeam(teamId: string) {
    localStorage.setItem(ACTIVE_TEAM_KEY, teamId)
    setTeamState({ state: 'loading' })
    setActiveTeamId(teamId)
    setPeople([])
    setAssignments([])
    setActionError('')
    setForm((prev) => ({ ...prev, personIds: [] }))
  }

  function handleTeamCreated(team: Team) {
    setSession((prev) => (prev ? { ...prev, teams: [...prev.teams, team] } : prev))
    selectTeam(team.id)
  }

  function handleTeamDeleted(teamId: string) {
    const remaining = session?.teams.filter((team) => team.id !== teamId) ?? []
    setSession((prev) => (prev ? { ...prev, teams: remaining } : prev))

    if (remaining.length > 0) {
      selectTeam(remaining[0].id)
    } else {
      localStorage.removeItem(ACTIVE_TEAM_KEY)
      setActiveTeamId(null)
      setPeople([])
      setAssignments([])
    }
  }

  function handlePersonAdded(person: Person) {
    setPeople((prev) => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)))
  }

  function handlePersonRemoved(personId: string) {
    setPeople((prev) => prev.filter((person) => person.id !== personId))
    // The backend drops them from every assignment (ON DELETE CASCADE); mirror that locally.
    setAssignments((prev) =>
      prev.map((item) => ({
        ...item,
        assignees: item.assignees.filter((person) => person.id !== personId),
      })),
    )
    setForm((prev) => ({ ...prev, personIds: prev.personIds.filter((id) => id !== personId) }))
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function togglePerson(personId: string) {
    setForm((prev) => ({
      ...prev,
      personIds: prev.personIds.includes(personId)
        ? prev.personIds.filter((id) => id !== personId)
        : [...prev.personIds, personId],
    }))
  }

  function toggleTask(task: string) {
    setCheckedTasks((prev) => {
      if (prev.includes(task)) {
        return prev.filter((value) => value !== task)
      }

      return [...prev, task]
    })
  }

  function resetForm() {
    setForm(getDefaultFormState())
    setCheckedTasks([])
    setError('')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!activeTeam) {
      return
    }

    const customTasks = form.customTasks
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const tasks = Array.from(new Set([...checkedTasks, ...customTasks]))

    if (!form.projectName.trim()) {
      setError('Project name is required.')
      return
    }

    if (form.personIds.length === 0) {
      setError('Select at least one person to assign.')
      return
    }

    if (!form.assignDate || !form.deadline) {
      setError('Assign date and deadline are required.')
      return
    }

    if (form.deadline < form.assignDate) {
      setError('Deadline cannot be earlier than assign date.')
      return
    }

    if (tasks.length === 0) {
      setError('Select at least one task type or add custom task tags.')
      return
    }

    setSubmitting(true)
    try {
      const created = await createAssignment(activeTeam.id, {
        projectName: form.projectName.trim(),
        personIds: form.personIds,
        assignDate: form.assignDate,
        deadline: form.deadline,
        priority: form.priority,
        tasks,
        notes: form.notes.trim(),
      })
      setAssignments((prev) => [...prev, created])
      resetForm()
    } catch (err) {
      setError(errorMessage(err, 'Could not save the assignment.'))
    } finally {
      setSubmitting(false)
    }
  }

  /** Runs a card action, disabling that card's buttons until the request settles. */
  async function runCardAction(id: string, action: () => Promise<void>) {
    setActionError('')
    setPendingIds((prev) => [...prev, id])
    try {
      await action()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setPendingIds((prev) => prev.filter((value) => value !== id))
    }
  }

  function toggleCompleted(item: Assignment) {
    if (!activeTeam) return
    void runCardAction(item.id, async () => {
      const updated = await updateAssignment(activeTeam.id, item.id, { completed: !item.completedAt })
      setAssignments((prev) => prev.map((value) => (value.id === updated.id ? updated : value)))
    })
  }

  function deleteAssignment(id: string) {
    if (!activeTeam) return
    void runCardAction(id, async () => {
      await deleteAssignmentRequest(activeTeam.id, id)
      setAssignments((prev) => prev.filter((item) => item.id !== id))
    })
  }

  if (sessionState.state === 'loading') {
    return <div className="panel state-panel">Connecting to backend…</div>
  }

  if (sessionState.state === 'error' || !session) {
    return (
      <div className="panel state-panel">
        <p className="error">
          {sessionState.state === 'error' ? sessionState.message : 'Backend unreachable'}
        </p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            setSessionState({ state: 'loading' })
            setSessionKey((key) => key + 1)
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <TeamBar
        // Remount when the team list changes so the "create first team" form state resets.
        key={session.teams.length}
        teams={session.teams}
        activeTeam={activeTeam}
        people={people}
        onSelectTeam={selectTeam}
        onTeamCreated={handleTeamCreated}
        onTeamDeleted={handleTeamDeleted}
        onPersonAdded={handlePersonAdded}
        onPersonRemoved={handlePersonRemoved}
      />

      {activeTeam && canManage && teamReady && (
        <LegacyImportBanner
          key={activeTeam.id}
          team={activeTeam}
          people={people}
          onPeopleAdded={(added) => setPeople((prev) => [...prev, ...added])}
          onImported={(imported) => setAssignments((prev) => [...prev, ...imported])}
        />
      )}

      {!activeTeam ? (
        <div className="panel state-panel">Create a team above to start adding assignments.</div>
      ) : (
        <main className="app">
          <section className="panel form-panel">
            <header>
              <p className="kicker">{activeTeam.name}</p>
              <h1>Project Assignment Tracker</h1>
              <p className="subtitle">
                Add projects, assign people, set timeline, and select multiple task streams.
              </p>
            </header>

            <form className="form" onSubmit={handleSubmit}>
              {!canManage && (
                <p className="notice">Only team owners and managers can add assignments.</p>
              )}

              <fieldset className="form-fieldset" disabled={!canManage || !teamReady || submitting}>
                <label className="field">
                  <span>Project Name</span>
                  <input
                    value={form.projectName}
                    onChange={(event) => updateForm('projectName', event.target.value)}
                    placeholder="Website Revamp"
                    required
                  />
                </label>

                <fieldset className="task-box">
                  <legend>
                    Assign To (multiple select)
                    {form.personIds.length > 0 && ` · ${form.personIds.length} selected`}
                  </legend>
                  {people.length === 0 ? (
                    <p className="task-box-empty">Add a member with “Add Member” above first.</p>
                  ) : (
                    <div className="task-grid">
                      {people.map((person) => (
                        <label className="task-option" key={person.id}>
                          <input
                            type="checkbox"
                            checked={form.personIds.includes(person.id)}
                            onChange={() => togglePerson(person.id)}
                          />
                          <span>{person.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <label className="field">
                  <span>Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) => updateForm('priority', event.target.value as Priority)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>

                <div className="field-row">
                  <label className="field">
                    <span>Assign Date</span>
                    <input
                      type="date"
                      value={form.assignDate}
                      onChange={(event) => updateForm('assignDate', event.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Deadline</span>
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={(event) => updateForm('deadline', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <fieldset className="task-box">
                  <legend>Task Types (multiple select)</legend>
                  <div className="task-grid">
                    {TASK_OPTIONS.map((task) => (
                      <label className="task-option" key={task}>
                        <input
                          type="checkbox"
                          checked={checkedTasks.includes(task)}
                          onChange={() => toggleTask(task)}
                        />
                        <span>{task}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="field">
                  <span>Custom Task Tags (comma separated)</span>
                  <input
                    value={form.customTasks}
                    onChange={(event) => updateForm('customTasks', event.target.value)}
                    placeholder="security review, deployment"
                  />
                </label>

                <label className="field">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateForm('notes', event.target.value)}
                    placeholder="Add blockers, links, context..."
                  />
                </label>

                <p className="error" role="alert" aria-live="polite">
                  {error}
                </p>

                <button className="btn btn-primary" type="submit">
                  {submitting ? 'Saving…' : 'Add Assignment'}
                </button>
              </fieldset>
            </form>
          </section>

          <section className="panel list-panel">
            <div className="list-header">
              <div>
                <p className="kicker">Live Overview</p>
                <h2>Assignments</h2>
              </div>
              <p className="stats">
                Open: {stats.open} | Overdue: {stats.overdue} | Completed: {stats.completed}
              </p>
            </div>

            <div className="filters">
              <label className="field compact">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  {statusFilters.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field compact">
                <span>Search Assignee</span>
                <input
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.target.value)}
                  placeholder="type a name"
                />
              </label>
            </div>

            {actionError && (
              <p className="error list-error" role="alert">
                {actionError}
              </p>
            )}

            <section className="cards">
              {teamState.state === 'loading' ? (
                <div className="empty">Loading assignments…</div>
              ) : teamState.state === 'error' ? (
                <div className="empty">
                  <p className="error">{teamState.message}</p>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setTeamState({ state: 'loading' })
                      setReloadKey((key) => key + 1)
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="empty">
                  {assignments.length === 0
                    ? 'No assignments yet.'
                    : 'No assignments match current filters.'}
                </div>
              ) : (
                filteredAssignments.map((item) => {
                  const status = getStatus(item)
                  const pending = pendingIds.includes(item.id)

                  return (
                    <article className="card" key={item.id}>
                      <div className="card-head">
                        <h3>{item.projectName}</h3>
                        <span className={`chip priority-${item.priority}`}>{item.priority}</span>
                      </div>

                      <p>
                        <strong>{item.assignees.length > 1 ? 'Owners' : 'Owner'}:</strong>{' '}
                        {assigneeLabel(item)}
                      </p>
                      <p>
                        <strong>Timeline:</strong> {item.assignDate} to {item.deadline} (
                        {getDaysInfo(item.deadline, Boolean(item.completedAt))})
                      </p>

                      <div className="chips">
                        {item.tasks.map((task) => (
                          <span className="chip task-chip" key={task}>
                            {task}
                          </span>
                        ))}
                      </div>

                      <p className="card-notes">{item.notes || 'No notes provided.'}</p>

                      <div className="card-foot">
                        <span className={`chip status-${status.toLowerCase()}`}>{status}</span>

                        <div className="actions">
                          {canManage && (
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={() => toggleCompleted(item)}
                              disabled={pending}
                            >
                              {item.completedAt ? 'Reopen' : 'Mark Complete'}
                            </button>
                          )}
                          {canManage && (
                            <button
                              className="btn btn-danger"
                              type="button"
                              onClick={() => deleteAssignment(item.id)}
                              disabled={pending}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </section>
          </section>
        </main>
      )}
    </>
  )
}

export default App
