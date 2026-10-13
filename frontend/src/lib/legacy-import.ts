import {
  addPerson,
  createAssignment,
  updateAssignment,
  type Assignment,
  type Person,
  type Priority,
} from './api.ts'

// Shape written by the pre-backend version of the app.
type LegacyAssignment = {
  id: string
  projectName: string
  assignedTo: string
  assignDate: string
  deadline: string
  priority: Priority
  tasks: string[]
  notes: string
  completed: boolean
  createdAt: string
}

const LEGACY_KEY = 'project-assignments-react-v1'
// Imported items are moved here instead of being deleted, so nothing is lost if an import goes wrong.
const BACKUP_KEY = 'project-assignments-react-v1-imported'

function readKey(key: string): LegacyAssignment[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? (parsed as LegacyAssignment[]) : []
  } catch {
    return []
  }
}

function writeKey(key: string, items: LegacyAssignment[]) {
  if (items.length === 0) {
    localStorage.removeItem(key)
  } else {
    localStorage.setItem(key, JSON.stringify(items))
  }
}

export function readLegacyAssignments(): LegacyAssignment[] {
  return readKey(LEGACY_KEY)
}

export async function importLegacyAssignments(
  teamId: string,
  people: Person[],
): Promise<{ imported: Assignment[]; addedPeople: Person[]; failed: number }> {
  const imported: Assignment[] = []
  const addedPeople: Person[] = []
  const done: LegacyAssignment[] = []
  const remaining: LegacyAssignment[] = []
  const byName = new Map(people.map((person) => [person.name.trim().toLowerCase(), person.id]))

  /** Old assignees were free text: reuse a member with the same name, or add them to the team. */
  async function personIdFor(name: string): Promise<string | null> {
    const key = name.trim().toLowerCase()
    if (!key) return null
    const existing = byName.get(key)
    if (existing) return existing
    const person = await addPerson(teamId, name.trim())
    addedPeople.push(person)
    byName.set(key, person.id)
    return person.id
  }

  for (const item of readLegacyAssignments()) {
    let created: Assignment
    try {
      const personId = await personIdFor(item.assignedTo ?? '')
      created = await createAssignment(teamId, {
        projectName: item.projectName,
        personIds: personId ? [personId] : [],
        assignDate: item.assignDate,
        deadline: item.deadline,
        priority: item.priority,
        tasks: item.tasks,
        notes: item.notes?.trim() ?? '',
      })
    } catch {
      remaining.push(item)
      continue
    }

    if (item.completed) {
      // If this fails the assignment still exists (as open), so it must not be retried as a new import.
      created = await updateAssignment(teamId, created.id, { completed: true }).catch(() => created)
    }

    imported.push(created)
    done.push(item)
  }

  writeKey(BACKUP_KEY, [...readKey(BACKUP_KEY), ...done])
  writeKey(LEGACY_KEY, remaining)

  return { imported, addedPeople, failed: remaining.length }
}
