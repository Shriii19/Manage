import type { Assignment } from '../lib/api.ts'
import { deadlineLabel, formatDate, getStatus } from '../lib/assignment-view.ts'
import { Icon } from './Icon.tsx'

export function AssignmentCard({ item, canManage, pending, today, onEdit, onDelete, onToggle }: {
  item: Assignment; canManage: boolean; pending: boolean; today: string; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  const status = getStatus(item, today)
  return (
    <article className={`assignment-card card-${status}`} aria-label={item.projectName} aria-busy={pending}>
      <div className="card-topline"><span className={`chip status-${status}`}><span className="status-dot" />{status === 'open' ? 'In progress' : status === 'overdue' ? 'Overdue' : 'Completed'}</span><span className={`priority priority-${item.priority}`}><span className="priority-bars" aria-hidden="true"><i /><i /><i /></span>{item.priority}</span></div>
      <h3>{item.projectName}</h3>
      <div className="chips card-tags">{item.tasks.map((task) => <span className="chip task-chip" key={task}>{task}</span>)}</div>
      {item.notes && <p className="card-notes">{item.notes}</p>}
      <div className="card-people"><div className="avatar-stack" aria-hidden="true">{item.assignees.slice(0, 3).map((person) => <span className="mini-avatar" key={person.id}>{person.name.charAt(0).toUpperCase()}</span>)}</div><span>{item.assignees.length ? item.assignees.map((person) => person.name).join(', ') : 'Unassigned'}</span></div>
      <div className="card-deadline"><Icon name="calendar" size={15} /><time dateTime={item.deadline} title={`Starts ${formatDate(item.assignDate)}`}>{formatDate(item.deadline)}</time><span className={`deadline-relative ${status === 'overdue' ? 'text-danger' : ''}`}>{deadlineLabel(item, today)}</span></div>
      {canManage && <div className="card-actions"><button className={`btn btn-complete ${item.completedAt ? 'is-completed' : ''}`} type="button" onClick={onToggle} disabled={pending}><Icon name={item.completedAt ? 'circleCheck' : 'check'} size={16} />{item.completedAt ? 'Reopen' : 'Complete'}</button><div className="actions"><button className="icon-button" type="button" onClick={onEdit} disabled={pending} aria-label={`Edit ${item.projectName}`} title="Edit assignment"><Icon name="edit" size={16} /></button><button className="icon-button delete-action" type="button" onClick={onDelete} disabled={pending} aria-label={`Delete ${item.projectName}`} title="Delete assignment"><Icon name="trash" size={16} /></button></div></div>}
    </article>
  )
}
