import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../Header'
import { createOpenGym, signOut } from '../api/admin'
import type { OpenGymInput } from '../api/admin'
import { isOpenGymPast, listAllOpenGyms } from '../api/openGyms'
import type { OpenGymSummary } from '../api/openGyms'
import { AdminGate } from '../components/AdminGate'
import { OpenGymForm } from '../components/OpenGymForm'
import { Spinner } from '../components/Spinner'
import { formatDate } from './openGymFormat'
import './AdminPage.css'

function AdminPageContent() {
  const [gyms, setGyms] = useState<OpenGymSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(() => {
    listAllOpenGyms()
      .then(setGyms)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load open gyms.'))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async (input: OpenGymInput) => {
    await createOpenGym(input)
    setCreating(false)
    refresh()
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <h1>Admin</h1>
        <button type="button" className="admin-button admin-button-secondary" onClick={() => void signOut()}>
          Sign Out
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {creating ? (
        <section className="admin-card">
          <h2>New Open Gym</h2>
          <OpenGymForm submitLabel="Create Open Gym" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </section>
      ) : (
        <button type="button" className="admin-button admin-new-gym" onClick={() => setCreating(true)}>
          + New Open Gym
        </button>
      )}

      {gyms === null && !error ? (
        <Spinner />
      ) : (
        <ul className="admin-gym-list">
          {gyms?.map((gym) => (
            <li key={gym.id}>
              <Link to={`/admin/${gym.id}`}>
                <span className="admin-gym-date">
                  {formatDate(gym.date)}
                  {isOpenGymPast(gym.endTime) && <span className="admin-gym-past">Past</span>}
                </span>
                <span className="admin-gym-meta">
                  {gym.start} - {gym.end} &middot; {gym.location}
                </span>
                <span className="admin-gym-meta">
                  {gym.spotsFilled}/{gym.spotsAvailable} paid &middot; {gym.pendingCount} pending &middot;{' '}
                  {gym.waitlistCount} waitlist
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export function AdminPage() {
  return (
    <>
      <Header />
      <div className="admin-shell">
        <AdminGate>
          <AdminPageContent />
        </AdminGate>
      </div>
    </>
  )
}
