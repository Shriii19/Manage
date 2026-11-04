import type { Assignment, Priority } from './api.ts'

export type StatusFilter = 'all' | 'open' | 'overdue' | 'completed'
export type SortOrder = 'deadline' | 'newest' | 'priority' | 'name'

export function todayYmd(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function getStatus(item: Assignment, today = todayYmd()): Exclude<StatusFilter, 'all'> {
  return item.completedAt ? 'completed' : item.deadline < today ? 'overdue' : 'open'
}

export function daysUntil(deadline: string, today = todayYmd()): number {
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function deadlineLabel(item: Assignment, today = todayYmd()): string {
  if (item.completedAt) return 'Completed'
  const days = daysUntil(item.deadline, today)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days < 0) return `${Math.abs(days)} ${days === -1 ? 'day' : 'days'} overdue`
  return `${days} days left`
}

export function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function filterAssignments(assignments: Assignment[], { search, status, priority, sort, today }: {
  search: string; status: StatusFilter; priority: Priority | 'all'; sort: SortOrder; today?: string
}): Assignment[] {
  const needle = search.trim().toLocaleLowerCase()
  const priorities: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }
  return assignments.filter((item) =>
    (status === 'all' || getStatus(item, today) === status) &&
    (priority === 'all' || item.priority === priority) &&
    (!needle || [item.projectName, item.notes, ...item.tasks, ...item.assignees.map((person) => person.name)].join(' ').toLocaleLowerCase().includes(needle)),
  ).sort((a, b) => {
    if (sort === 'name') return a.projectName.localeCompare(b.projectName)
    if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
    if (sort === 'priority') return priorities[a.priority] - priorities[b.priority] || a.deadline.localeCompare(b.deadline)
    return Number(Boolean(a.completedAt)) - Number(Boolean(b.completedAt)) || a.deadline.localeCompare(b.deadline)
  })
}
