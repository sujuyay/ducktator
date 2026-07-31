import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../Header'
import {
  deleteOpenGym,
  deleteSignup,
  deleteWaitlistEntry,
  promoteWaitlistEntry,
  updateOpenGym,
  updateSignup,
} from '../api/admin'
import type { OpenGymInput } from '../api/admin'
import { getOpenGym } from '../api/openGyms'
import type { OpenGymDetail, Position, Signup, WaitlistEntry } from '../api/openGyms'
import { AdminGate } from '../components/AdminGate'
import { OpenGymForm } from '../components/OpenGymForm'
import { Spinner } from '../components/Spinner'
import { formatDate } from './openGymFormat'
import './AdminPage.css'

function SignupAdminRow({
  signup,
  positions,
  onChange,
  onDelete,
}: {
  signup: Signup
  positions: Position[]
  onChange: (changes: Partial<Pick<Signup, 'paid' | 'team' | 'position'>>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  return (
    <li className="admin-entry">
      <div className="admin-entry-main">
        <span className="admin-entry-name">
          {signup.firstName} {signup.lastName}
        </span>
        <span className="admin-entry-meta">
          {signup.phoneNumber}
          {signup.groupName && ` · ${signup.groupName}`}
          {!signup.waiverCompleted && ' · no waiver'}
        </span>
      </div>

      <div className="admin-entry-controls">
        <label className="admin-inline-field">
          Paid
          <input type="checkbox" checked={signup.paid} onChange={(e) => void onChange({ paid: e.target.checked })} />
        </label>

        <label className="admin-inline-field">
          Position
          <select value={signup.position} onChange={(e) => void onChange({ position: e.target.value })}>
            {/* A position that's since been removed from the gym still needs to
                render as the current value rather than silently switching. */}
            {!positions.includes(signup.position) && <option value={signup.position}>{signup.position}</option>}
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-inline-field">
          Team
          <input
            className="admin-team-input"
            defaultValue={signup.team}
            placeholder="none"
            onBlur={(e) => {
              const next = e.target.value.trim()
              if (next !== signup.team) void onChange({ team: next })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        </label>

        <button type="button" className="admin-danger-button" onClick={() => void onDelete()}>
          Delete
        </button>
      </div>
    </li>
  )
}

function WaitlistAdminRow({
  entry,
  positions,
  onPromote,
  onDelete,
}: {
  entry: WaitlistEntry
  positions: Position[]
  onPromote: (position: Position) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [position, setPosition] = useState<Position>(positions[0] ?? '')

  return (
    <li className="admin-entry">
      <div className="admin-entry-main">
        <span className="admin-entry-name">
          {entry.firstName} {entry.lastName}
        </span>
        <span className="admin-entry-meta">
          {entry.phoneNumber}
          {entry.groupName && ` · ${entry.groupName}`}
          {!entry.waiverCompleted && ' · no waiver'}
        </span>
      </div>

      <div className="admin-entry-controls">
        <label className="admin-inline-field">
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="admin-button admin-promote-button"
          disabled={!position}
          onClick={() => void onPromote(position)}
        >
          Promote
        </button>

        <button type="button" className="admin-danger-button" onClick={() => void onDelete()}>
          Delete
        </button>
      </div>
    </li>
  )
}

function AdminGymPageContent({ id }: { id: string }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<OpenGymDetail | null | undefined>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const refresh = useCallback(() => {
    getOpenGym(id)
      .then((gym) => setDetail(gym ?? undefined))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load open gym.'))
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Every mutation follows the same shape: run it, surface any error, reload.
  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (error && !detail) return <main className="admin-page"><p className="admin-error">{error}</p></main>
  if (detail === undefined) {
    return (
      <main className="admin-page">
        <p>Open gym not found.</p>
        <Link to="/admin">{'<'} Back to admin</Link>
      </main>
    )
  }
  if (!detail) {
    return (
      <main className="admin-page">
        <Spinner />
      </main>
    )
  }

  const positions = detail.positions.map((p) => p.position)
  // Paid and pending together, newest first - the admin manages one list and
  // the paid checkbox is what splits them on the public page.
  const allSignups = [...detail.signups, ...detail.pendingSignups].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const handleSave = async (input: OpenGymInput) => {
    await updateOpenGym(id, input)
    setEditing(false)
    refresh()
  }

  const handleDeleteGym = () => {
    if (!window.confirm(`Delete the ${formatDate(detail.date)} open gym and all of its signups? This cannot be undone.`))
      return
    void run(async () => {
      await deleteOpenGym(id)
      navigate('/admin')
    })
  }

  return (
    <main className="admin-page">
      <Link className="admin-back" to="/admin">
        {'<'} Back to admin
      </Link>

      <div className="admin-page-header">
        <h1>{formatDate(detail.date)}</h1>
        <Link className="admin-button admin-button-secondary" to={`/open-gyms/${id}`}>
          View Public Page
        </Link>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        <div className="admin-card-header">
          <h2>Details</h2>
          {!editing && (
            <button type="button" className="admin-button admin-button-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <OpenGymForm
            existing={detail}
            submitLabel="Save Changes"
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <dl className="admin-detail-list">
              <div>
                <dt>Time</dt>
                <dd>
                  {detail.start} - {detail.end}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{detail.location}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{detail.price}</dd>
              </div>
              <div>
                <dt>Spots</dt>
                <dd>
                  {detail.spotsFilled}/{detail.spotsAvailable} paid
                </dd>
              </div>
            </dl>
            <ul className="admin-slot-summary">
              {detail.positions.map((p) => (
                <li key={p.position}>
                  {p.position}: {p.filled}/{p.available}
                </li>
              ))}
            </ul>
            <button type="button" className="admin-danger-button admin-delete-gym" onClick={handleDeleteGym}>
              Delete Open Gym
            </button>
          </>
        )}
      </section>

      <section className="admin-card">
        <h2>Signups ({allSignups.length})</h2>
        {allSignups.length === 0 ? (
          <p className="admin-empty">No signups yet.</p>
        ) : (
          <ul className="admin-entries">
            {allSignups.map((signup) => (
              <SignupAdminRow
                key={signup.id}
                signup={signup}
                positions={positions}
                onChange={(changes) => run(() => updateSignup(id, signup.id, changes))}
                onDelete={() =>
                  run(async () => {
                    if (!window.confirm(`Delete ${signup.firstName} ${signup.lastName}'s signup?`)) return
                    await deleteSignup(id, signup.id)
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="admin-card">
        <h2>Waitlist ({detail.waitlist.length})</h2>
        {detail.waitlist.length === 0 ? (
          <p className="admin-empty">Nobody on the waitlist.</p>
        ) : (
          <ul className="admin-entries">
            {detail.waitlist.map((entry) => (
              <WaitlistAdminRow
                key={entry.id}
                entry={entry}
                positions={positions}
                onPromote={(position) => run(() => promoteWaitlistEntry(id, entry, position))}
                onDelete={() =>
                  run(async () => {
                    if (!window.confirm(`Remove ${entry.firstName} ${entry.lastName} from the waitlist?`)) return
                    await deleteWaitlistEntry(id, entry.id)
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export function AdminGymPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <>
      <Header />
      <div className="admin-shell">
        <AdminGate>{id && <AdminGymPageContent id={id} />}</AdminGate>
      </div>
    </>
  )
}
