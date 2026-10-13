import { useState } from 'react'
import { type Assignment, type Person, type Team } from '../lib/api.ts'
import { importLegacyAssignments, readLegacyAssignments } from '../lib/legacy-import.ts'

type LegacyImportBannerProps = {
  team: Team
  people: Person[]
  onPeopleAdded: (people: Person[]) => void
  onImported: (assignments: Assignment[]) => void
}

/** Offers a one-time import of assignments saved in localStorage before the backend was connected. */
export function LegacyImportBanner({ team, people, onPeopleAdded, onImported }: LegacyImportBannerProps) {
  const [pending, setPending] = useState(() => readLegacyAssignments().length)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [hidden, setHidden] = useState(false)

  if (hidden || (pending === 0 && !result)) {
    return null
  }

  async function handleImport() {
    setBusy(true)
    try {
      const { imported, addedPeople, failed } = await importLegacyAssignments(team.id, people)
      onPeopleAdded(addedPeople)
      onImported(imported)
      setPending(failed)
      setResult(
        failed > 0
          ? `Imported ${imported.length}. ${failed} could not be imported and are still saved in this browser.`
          : `Imported ${imported.length} assignments into ${team.name}.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="team-bar notice-bar">
      <p>
        {result ||
          `Found ${pending} ${pending === 1 ? 'assignment' : 'assignments'} saved in this browser from before the backend was connected.`}
      </p>
      <div className="actions">
        {pending > 0 && (
          <button className="btn btn-primary" type="button" onClick={handleImport} disabled={busy}>
            {busy ? 'Importing…' : `Import into ${team.name}`}
          </button>
        )}
        <button className="btn btn-secondary" type="button" onClick={() => setHidden(true)} disabled={busy}>
          {pending > 0 ? 'Not now' : 'Dismiss'}
        </button>
      </div>
    </section>
  )
}
