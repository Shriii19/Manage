import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { deleteAssignment, errorMessage, getMe, listAssignments, listPeople, updateAssignment, type Assignment, type Person, type Priority, type Team } from './lib/api.ts'
import { filterAssignments, getStatus, todayYmd, type SortOrder, type StatusFilter } from './lib/assignment-view.ts'
import { AssignmentCard } from './components/AssignmentCard.tsx'
import { AssignmentForm } from './components/AssignmentForm.tsx'
import { Icon, type IconName } from './components/Icon.tsx'
import { Modal } from './components/Modal.tsx'
import { LegacyImportBanner } from './team/LegacyImportBanner.tsx'
import { TeamBar } from './team/TeamBar.tsx'

type LoadState = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string }
const ACTIVE_TEAM_KEY = 'project-assignments-active-team'
const FILTERS: Array<{ value: StatusFilter; label: string; icon: IconName }> = [
  { value: 'all', label: 'All assignments', icon: 'grid' },
  { value: 'open', label: 'In progress', icon: 'clock' },
  { value: 'overdue', label: 'Overdue', icon: 'alert' },
  { value: 'completed', label: 'Completed', icon: 'circleCheck' },
]

function App() {
  const [teams, setTeams] = useState<Team[]>([])
  const [sessionState, setSessionState] = useState<LoadState>({ state: 'loading' })
  const [sessionKey, setSessionKey] = useState(0)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const activeTeamRef = useRef<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [teamState, setTeamState] = useState<LoadState>({ state: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [sort, setSort] = useState<SortOrder>('deadline')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [editor, setEditor] = useState<{ assignment: Assignment | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [today, setToday] = useState(todayYmd)

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayYmd()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let cancelled = false
    getMe().then((me) => {
      if (cancelled) return
      const saved = localStorage.getItem(ACTIVE_TEAM_KEY)
      const teamId = me.teams.find((team) => team.id === saved)?.id ?? me.teams[0]?.id ?? null
      setTeams(me.teams)
      activeTeamRef.current = teamId
      setActiveTeamId(teamId)
      setSessionState({ state: 'ready' })
    }).catch((err: unknown) => {
      if (!cancelled) setSessionState({ state: 'error', message: errorMessage(err, 'Could not load your workspace.') })
    })
    return () => { cancelled = true }
  }, [sessionKey])

  useEffect(() => {
    if (!activeTeamId) return
    let cancelled = false
    Promise.all([listPeople(activeTeamId), listAssignments(activeTeamId)]).then(([nextPeople, nextAssignments]) => {
      if (cancelled) return
      setPeople(nextPeople)
      setAssignments(nextAssignments)
      setTeamState({ state: 'ready' })
    }).catch((err: unknown) => {
      if (!cancelled) setTeamState({ state: 'error', message: errorMessage(err) })
    })
    return () => { cancelled = true }
  }, [activeTeamId, reloadKey])

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null
  const canManage = activeTeam?.role === 'owner' || activeTeam?.role === 'manager'
  const teamReady = teamState.state === 'ready'
  const filtered = useMemo(() => filterAssignments(assignments, { search, status: statusFilter, priority, sort, today }), [assignments, search, statusFilter, priority, sort, today])
  const stats = useMemo(() => {
    const counts = { all: assignments.length, open: 0, overdue: 0, completed: 0 }
    assignments.forEach((item) => { counts[getStatus(item, today)]++ })
    return counts
  }, [assignments, today])
  const completionRate = stats.all ? Math.round(stats.completed / stats.all * 100) : 0
  const hasFilters = Boolean(search.trim()) || priority !== 'all' || statusFilter !== 'all'

  function clearFilters() { setSearch(''); setPriority('all'); setStatusFilter('all') }

  function selectTeam(teamId: string | null) {
    if (teamId === activeTeamRef.current) return
    activeTeamRef.current = teamId
    if (teamId) localStorage.setItem(ACTIVE_TEAM_KEY, teamId)
    else localStorage.removeItem(ACTIVE_TEAM_KEY)
    setActiveTeamId(teamId)
    setTeamState({ state: 'loading' })
    setPeople([])
    setAssignments([])
    setEditor(null)
    setDeleteTarget(null)
    setActionError('')
    setNotice('')
    clearFilters()
  }

  function retryTeam() { setTeamState({ state: 'loading' }); setReloadKey((key) => key + 1) }

  async function runAction(item: Assignment, action: () => Promise<void>) {
    setActionError('')
    setPendingIds((previous) => [...previous, item.id])
    try { await action() } catch (err) {
      if (activeTeamRef.current === item.teamId) setActionError(errorMessage(err))
    } finally { setPendingIds((previous) => previous.filter((id) => id !== item.id)) }
  }

  function toggleCompleted(item: Assignment) {
    void runAction(item, async () => {
      const updated = await updateAssignment(item.teamId, item.id, { completed: !item.completedAt })
      if (activeTeamRef.current !== item.teamId) return
      setAssignments((previous) => previous.map((value) => value.id === item.id ? updated : value))
      setNotice(item.completedAt ? 'Assignment reopened.' : 'Assignment completed. Nice work!')
    })
  }

  function confirmDelete(item: Assignment) {
    void runAction(item, async () => {
      await deleteAssignment(item.teamId, item.id)
      if (activeTeamRef.current !== item.teamId) return
      setAssignments((previous) => previous.filter((value) => value.id !== item.id))
      setDeleteTarget(null)
      setNotice('Assignment deleted.')
    })
  }

  if (sessionState.state === 'loading') return <div className="state-panel" role="status"><span className="loading-spinner" /><h2>Opening your workspace</h2><p>Getting your teams and assignments ready.</p></div>
  if (sessionState.state === 'error') return <div className="state-panel"><Icon name="alert" size={32} /><h2>Let’s try that again</h2><p className="error" role="alert">{sessionState.message}</p><button className="btn btn-primary" onClick={() => { setSessionState({ state: 'loading' }); setSessionKey((key) => key + 1) }}>Retry connection</button></div>

  return (
    <div className="workspace">
      <a className="skip-link" href="#assignments-main">Skip to assignments</a>
      <aside className="sidebar" aria-label="Workspace sidebar">
        <div className="sidebar-section"><p className="nav-label">Workspace</p><nav className="sidebar-nav" aria-label="Assignment views">{FILTERS.map((filter) => <button key={filter.value} className={`nav-item ${statusFilter === filter.value ? 'active' : ''}`} type="button" onClick={() => setStatusFilter(filter.value)} aria-current={statusFilter === filter.value ? 'page' : undefined}><Icon name={filter.icon} /><span>{filter.label}</span>{activeTeam && <span className={`nav-count ${filter.value === 'overdue' && stats.overdue ? 'nav-count-danger' : ''}`}>{teamReady ? stats[filter.value] : '–'}</span>}</button>)}</nav></div>
        <TeamBar key={activeTeamId ?? 'no-team'} teams={teams} activeTeam={activeTeam} people={people} loading={!teamReady && Boolean(activeTeam)} onSelectTeam={selectTeam}
          onTeamCreated={(team) => { setTeams((previous) => [...previous, team]); selectTeam(team.id) }}
          onTeamDeleted={(teamId) => { const remaining = teams.filter((team) => team.id !== teamId); setTeams(remaining); selectTeam(remaining[0]?.id ?? null) }}
          onPersonAdded={(person) => setPeople((previous) => [...previous, person].sort((a, b) => a.name.localeCompare(b.name)))}
          onPersonRemoved={(personId) => { setPeople((previous) => previous.filter((person) => person.id !== personId)); setAssignments((previous) => previous.map((item) => ({ ...item, assignees: item.assignees.filter((person) => person.id !== personId) }))) }} />
        <div className="sidebar-footer"><span className="sidebar-footer-mark"><Icon name="check" size={15} /></span><div><strong>A little clarity, every day.</strong><p>Make room for your best work.</p></div></div>
      </aside>

      <main className="workspace-main" id="assignments-main" tabIndex={-1}>
        <div className="breadcrumb">Workspace <Icon name="chevron" size={13} /><span>{activeTeam?.name ?? 'Get started'}</span></div>
        <header className="page-header"><div><p className="kicker">Your work, in focus</p><h1>Assignments<span className="heading-dot">.</span></h1><p>Keep the whole picture clear. Move the important work forward.</p></div>{activeTeam && canManage && <button className="btn btn-primary new-assignment" type="button" onClick={() => setEditor({ assignment: null })} disabled={!teamReady}><Icon name="plus" />New assignment</button>}</header>

        {!activeTeam ? <section className="empty-state welcome-state"><span className="empty-icon"><Icon name="users" size={30} /></span><p className="kicker">Better work, together</p><h2>Start with your team</h2><p>Create your first team in the sidebar, add the people you work with, and give your next project a clear plan.</p><div className="onboarding-steps"><span><b>1</b>Create a team</span><Icon name="arrow" size={15} /><span><b>2</b>Add people</span><Icon name="arrow" size={15} /><span><b>3</b>Assign work</span></div></section> : <>
          <section className="stats-grid" aria-label="Team overview">{FILTERS.map((filter) => <button key={filter.value} className={`stat-card stat-${filter.value} ${statusFilter === filter.value ? 'stat-selected' : ''}`} type="button" onClick={() => setStatusFilter(filter.value)} aria-pressed={statusFilter === filter.value}><div className="stat-top"><span>{filter.value === 'all' ? 'Total assignments' : filter.label}</span><span className="stat-icon"><Icon name={filter.icon} size={17} /></span></div><strong>{teamReady ? stats[filter.value] : '–'}</strong><span className="stat-caption">{filter.value === 'all' ? 'Everything on your team’s plate' : filter.value === 'open' ? 'Moving toward the finish line' : filter.value === 'overdue' ? 'A little attention goes a long way' : 'Work you can feel good about'}</span></button>)}</section>
          {canManage && teamReady && <LegacyImportBanner key={activeTeam.id} team={activeTeam} people={people} onPeopleAdded={(added) => { if (activeTeamRef.current === activeTeam.id) setPeople((previous) => [...previous, ...added]) }} onImported={(imported) => { if (activeTeamRef.current === activeTeam.id) setAssignments((previous) => [...previous, ...imported]) }} />}
          <section className="assignments-section" aria-label="Assignments">
            <div className="section-heading"><div><h2>Your assignments <span className="count-badge">{teamReady ? stats.all : '–'}</span></h2><p>A shared plan. A clear next step.</p></div><div className="completion-summary"><div><span>Team progress</span><strong>{teamReady ? `${completionRate}%` : '–'}</strong></div><progress value={completionRate} max={100} aria-label="Team completion" /></div></div>
            <div className="board-toolbar"><label className="search-field"><Icon name="search" size={18} /><span className="sr-only">Search assignments</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, people, or tags…" /></label><div className="toolbar-options"><label className="sr-only" htmlFor="priority-filter">Filter by priority</label><select id="priority-filter" value={priority} onChange={(event) => setPriority(event.target.value as Priority | 'all')}><option value="all">All priorities</option><option value="High">High priority</option><option value="Medium">Medium priority</option><option value="Low">Low priority</option></select><label className="sr-only" htmlFor="sort-order">Sort assignments</label><select id="sort-order" value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}><option value="deadline">Deadline first</option><option value="newest">Newest first</option><option value="priority">Priority first</option><option value="name">Project A–Z</option></select><div className="view-switch" aria-label="Assignment layout"><button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'}><Icon name="grid" size={17} /></button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'}><Icon name="list" size={18} /></button></div></div></div>
            <div className="filter-bar"><div className="status-tabs" aria-label="Filter by status">{FILTERS.map((filter) => <button key={filter.value} type="button" className={statusFilter === filter.value ? 'active' : ''} onClick={() => setStatusFilter(filter.value)} aria-pressed={statusFilter === filter.value}>{filter.value === 'all' ? 'All' : filter.label}<span>{teamReady ? stats[filter.value] : '–'}</span></button>)}</div>{hasFilters && <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
            {actionError && !deleteTarget && <p className="error error-banner" role="alert">{actionError}</p>}
            {teamState.state === 'loading' ? <div className="assignment-grid" role="status" aria-label="Loading assignments">{[1, 2, 3].map((value) => <div className="skeleton-card" key={value}><span /><span /><span /><span /></div>)}</div> : teamState.state === 'error' ? <div className="empty-state"><Icon name="alert" size={30} /><h3>We couldn’t load your assignments</h3><p className="error" role="alert">{teamState.message}</p><button className="btn btn-secondary" type="button" onClick={retryTeam}>Try again</button></div> : !filtered.length ? <div className="empty-state"><span className="empty-icon"><Icon name={hasFilters ? 'search' : 'folder'} size={30} /></span><h3>{hasFilters ? 'No matches just yet' : 'A fresh space for your next project'}</h3><p>{hasFilters ? 'Try a different search or clear your filters to see more assignments.' : canManage ? 'Create an assignment, bring in your team, and get things moving.' : 'Your team’s assignments will appear here when they’re created.'}</p>{hasFilters ? <button className="btn btn-secondary" type="button" onClick={clearFilters}>Clear filters</button> : canManage && <button className="btn btn-primary" type="button" onClick={() => setEditor({ assignment: null })}><Icon name="plus" />Create your first assignment</button>}</div> : <div className={`assignment-grid ${view === 'list' ? 'assignment-list' : ''}`}>{filtered.map((item) => <AssignmentCard key={item.id} item={item} today={today} canManage={canManage} pending={pendingIds.includes(item.id)} onEdit={() => setEditor({ assignment: item })} onDelete={() => { setActionError(''); setDeleteTarget(item) }} onToggle={() => toggleCompleted(item)} />)}</div>}
            {teamReady && <p className="results-count" role="status">Showing {filtered.length} of {stats.all} {stats.all === 1 ? 'assignment' : 'assignments'}</p>}
          </section>
        </>}
        <footer className="workspace-footer"><span>Less busywork. More good work.</span><span>Manage · Your team’s workspace</span></footer>
      </main>
      {editor && activeTeam && canManage && <AssignmentForm key={`${activeTeam.id}-${editor.assignment?.id ?? 'new'}`} teamId={activeTeam.id} people={people} assignment={editor.assignment} onClose={() => setEditor(null)} onSaved={(saved) => { if (activeTeamRef.current !== saved.teamId) return; setAssignments((previous) => previous.some((item) => item.id === saved.id) ? previous.map((item) => item.id === saved.id ? saved : item) : [...previous, saved]); setEditor(null); setNotice(editor.assignment ? 'Assignment updated.' : 'Assignment created. You’re all set!') }} />}
      {deleteTarget && <Modal title="Delete this assignment?" description={`“${deleteTarget.projectName}” will be permanently removed.`} compact onClose={() => setDeleteTarget(null)} busy={pendingIds.includes(deleteTarget.id)}>{actionError && <p className="error" role="alert">{actionError}</p>}<div className="form-footer"><button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={pendingIds.includes(deleteTarget.id)}>Keep assignment</button><button className="btn btn-danger" type="button" onClick={() => confirmDelete(deleteTarget)} disabled={pendingIds.includes(deleteTarget.id)}><Icon name="trash" size={16} />{pendingIds.includes(deleteTarget.id) ? 'Deleting…' : 'Delete assignment'}</button></div></Modal>}
      {notice && <div className="toast" role="status"><Icon name="circleCheck" size={19} /><span>{notice}</span><button className="icon-button" type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={15} /></button></div>}
    </div>
  )
}

export default App
