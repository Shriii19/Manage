import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Assignment } from '../src/lib/api.ts'
import { daysUntil, deadlineLabel, filterAssignments, getStatus } from '../src/lib/assignment-view.ts'

const today = '2026-10-30'
const assignment = (patch: Partial<Assignment> = {}): Assignment => ({
  id: 'one', teamId: 'team', projectName: 'Website redesign', assignees: [{ id: 'maya', name: 'Maya Chen' }],
  createdBy: null, assignDate: '2026-10-20', deadline: today, priority: 'Medium', tasks: ['Frontend'],
  notes: 'Review accessibility', completedAt: null, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', ...patch,
})

test('deadlines use calendar days, including today and daylight saving boundaries', () => {
  assert.equal(deadlineLabel(assignment(), today), 'Due today')
  assert.equal(deadlineLabel(assignment({ deadline: '2026-10-31' }), today), 'Due tomorrow')
  assert.equal(deadlineLabel(assignment({ deadline: '2026-10-29' }), today), '1 day overdue')
  assert.equal(deadlineLabel(assignment({ deadline: '2026-10-28' }), today), '2 days overdue')
  assert.equal(deadlineLabel(assignment({ deadline: '2026-11-03' }), today), '4 days left')
  assert.equal(daysUntil('2026-03-09', '2026-03-07'), 2)
  assert.equal(daysUntil('2026-11-02', '2026-10-31'), 2)
})

test('completed assignments stay completed after their deadline', () => {
  const completed = assignment({ deadline: '2026-10-01', completedAt: '2026-10-02T12:00:00Z' })
  assert.equal(getStatus(completed, today), 'completed')
  assert.equal(deadlineLabel(completed, today), 'Completed')
  assert.equal(getStatus(assignment(), today), 'open')
  assert.equal(getStatus(assignment({ deadline: '2026-10-29' }), today), 'overdue')
})

test('search covers project, people, tags, and notes regardless of case or surrounding spaces', () => {
  for (const search of [' WEBSITE ', 'MAYA', 'frontend', 'accessibility']) {
    assert.equal(filterAssignments([assignment()], { search, status: 'all', priority: 'all', sort: 'deadline', today }).length, 1)
  }
  assert.equal(filterAssignments([assignment()], { search: 'unknown', status: 'all', priority: 'all', sort: 'deadline', today }).length, 0)
})

test('status and priority filters combine with search', () => {
  const items = [assignment({ id: 'overdue', deadline: '2026-10-29', priority: 'High' }), assignment({ id: 'open' })]
  const options = { search: 'maya', status: 'overdue' as const, priority: 'High' as const, sort: 'deadline' as const, today }
  assert.deepEqual(filterAssignments(items, options).map((item) => item.id), ['overdue'])
  assert.equal(filterAssignments(items, { ...options, priority: 'Low' }).length, 0)
})

test('deadline sort puts unfinished work first without mutating the input', () => {
  const items = [assignment({ id: 'done', deadline: '2026-10-01', completedAt: today }), assignment({ id: 'later', deadline: '2026-11-05' }), assignment({ id: 'urgent', deadline: '2026-10-28' })]
  assert.deepEqual(filterAssignments(items, { search: '', status: 'all', priority: 'all', sort: 'deadline', today }).map((item) => item.id), ['urgent', 'later', 'done'])
  assert.deepEqual(items.map((item) => item.id), ['done', 'later', 'urgent'])
})

test('priority, newest, and alphabetical sorting use the selected order', () => {
  const items = [assignment({ id: 'a', projectName: 'Zulu', priority: 'Low' }), assignment({ id: 'b', projectName: 'Alpha', priority: 'High', createdAt: '2026-10-22T10:00:00Z' })]
  for (const sort of ['priority', 'newest', 'name'] as const) {
    assert.deepEqual(filterAssignments(items, { search: '', status: 'all', priority: 'all', sort, today }).map((item) => item.id), ['b', 'a'])
  }
})
