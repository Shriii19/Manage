import { useState, type FormEvent } from 'react'
import { createAssignment, errorMessage, updateAssignment, type Assignment, type Person, type Priority } from '../lib/api.ts'
import { todayYmd } from '../lib/assignment-view.ts'
import { Modal } from './Modal.tsx'
import { Icon } from './Icon.tsx'

const TASK_OPTIONS = ['Frontend', 'Backend', 'API', 'Admin', 'QA', 'DevOps', 'Database', 'UI/UX']

export function AssignmentForm({ teamId, people, assignment, onClose, onSaved }: {
  teamId: string; people: Person[]; assignment: Assignment | null; onClose: () => void; onSaved: (assignment: Assignment) => void
}) {
  const [form, setForm] = useState(() => ({
    projectName: assignment?.projectName ?? '',
    personIds: assignment?.assignees.map((person) => person.id) ?? [],
    assignDate: assignment?.assignDate ?? todayYmd(),
    deadline: assignment?.deadline ?? '',
    priority: assignment?.priority ?? 'Medium' as Priority,
    tasks: assignment?.tasks.filter((task) => TASK_OPTIONS.includes(task)) ?? [],
    customTasks: assignment?.tasks.filter((task) => !TASK_OPTIONS.includes(task)).join(', ') ?? '',
    notes: assignment?.notes ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const tasks = [...new Set([...form.tasks, ...form.customTasks.split(',').map((task) => task.trim()).filter(Boolean)])]
    if (!form.projectName.trim()) { setError('Enter a project name.'); return }
    if (!assignment && !form.personIds.length) { setError('Select at least one team member.'); return }
    if (!tasks.length) { setError('Select a workstream or add a custom tag.'); return }
    if (form.deadline < form.assignDate) { setError('The deadline must be on or after the start date.'); return }
    setBusy(true)
    setError('')
    try {
      const input = { projectName: form.projectName.trim(), personIds: form.personIds, assignDate: form.assignDate, deadline: form.deadline, priority: form.priority, tasks, notes: form.notes.trim() }
      onSaved(assignment ? await updateAssignment(teamId, assignment.id, input) : await createAssignment(teamId, input))
    } catch (err) {
      setError(errorMessage(err, 'Could not save this assignment. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={assignment ? 'Edit assignment' : 'Create an assignment'} description="Give your team a clear next step." onClose={onClose} busy={busy}>
      <form className="form assignment-form" onSubmit={submit}>
        <fieldset className="form-fieldset" disabled={busy}>
          <label className="field"><span>Project name <span className="required">*</span></span><input data-autofocus value={form.projectName} onChange={(event) => update('projectName', event.target.value)} placeholder="e.g. Website redesign" maxLength={160} required /></label>
          <fieldset className="task-box"><legend>Assign to <span className="selection-count">{form.personIds.length} selected</span></legend>
            <p className="field-hint">Choose the people responsible for this work.</p>
            {people.length === 0 ? <p className="notice">Add a team member from the sidebar first.</p> : <div className="task-grid">{people.map((person) => <label className="task-option" key={person.id}><input type="checkbox" checked={form.personIds.includes(person.id)} onChange={() => update('personIds', form.personIds.includes(person.id) ? form.personIds.filter((id) => id !== person.id) : [...form.personIds, person.id])} /><span className="mini-avatar" aria-hidden="true">{person.name.charAt(0).toUpperCase()}</span><span>{person.name}</span></label>)}</div>}
          </fieldset>
          <div className="field-row">
            <label className="field"><span>Start date <span className="required">*</span></span><input type="date" value={form.assignDate} onChange={(event) => update('assignDate', event.target.value)} required /></label>
            <label className="field"><span>Deadline <span className="required">*</span></span><input type="date" value={form.deadline} min={form.assignDate} onChange={(event) => update('deadline', event.target.value)} required /></label>
          </div>
          <label className="field"><span>Priority</span><select value={form.priority} onChange={(event) => update('priority', event.target.value as Priority)}><option>Low</option><option>Medium</option><option>High</option></select></label>
          <fieldset className="task-box"><legend>Workstreams <span className="required">*</span></legend><div className="task-grid task-grid-tags">{TASK_OPTIONS.map((task) => <label className="task-option" key={task}><input type="checkbox" checked={form.tasks.includes(task)} onChange={() => update('tasks', form.tasks.includes(task) ? form.tasks.filter((value) => value !== task) : [...form.tasks, task])} /><span>{task}</span></label>)}</div></fieldset>
          <label className="field"><span>Custom tags <span className="optional">Optional</span></span><input value={form.customTasks} onChange={(event) => update('customTasks', event.target.value)} placeholder="e.g. Research, accessibility" /><small className="field-hint">Separate tags with commas.</small></label>
          <label className="field"><span>Notes <span className="optional">Optional</span></span><textarea rows={3} value={form.notes} onChange={(event) => update('notes', event.target.value)} maxLength={5000} placeholder="Add context, useful links, or anything the team should know." /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-footer"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={!people.length && !assignment}><Icon name={assignment ? 'check' : 'plus'} />{busy ? 'Saving…' : assignment ? 'Save changes' : 'Create assignment'}</button></div>
        </fieldset>
      </form>
    </Modal>
  )
}

