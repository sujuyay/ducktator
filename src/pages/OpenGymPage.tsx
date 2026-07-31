import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Header } from '../Header'
import { createSignup, getOpenGym, isOpenGymPast, joinWaitlist } from '../api/openGyms'
import type { OpenGymDetail, OpenGymSummary, Signup, SignupInput, WaitlistEntry, WaitlistInput } from '../api/openGyms'
import { SignupModal } from '../components/SignupModal'
import { Spinner } from '../components/Spinner'
import { getPositionAbbreviation, getPositionColor } from '../positionColors'
import { formatDate } from './openGymFormat'
import './OpenGymPage.css'

interface TeamGroup {
  team: string
  signups: Signup[]
}

// Signups without a team (not yet assigned manually) render as a flat list,
// same as before teams existed. Teamed groups appear first, in the order
// their first (most recent) signup appears.
function groupByTeam(signups: Signup[]): { teams: TeamGroup[]; ungrouped: Signup[] } {
  const teams: TeamGroup[] = []
  const byTeam = new Map<string, Signup[]>()
  const ungrouped: Signup[] = []

  for (const signup of signups) {
    if (!signup.team) {
      ungrouped.push(signup)
      continue
    }
    let group = byTeam.get(signup.team)
    if (!group) {
      group = []
      byTeam.set(signup.team, group)
      teams.push({ team: signup.team, signups: group })
    }
    group.push(signup)
  }

  return { teams, ungrouped }
}

function SignupRow({ signup }: { signup: Signup }) {
  return (
    <li>
      <span className="open-gym-signup-name">
        <span>
          {signup.firstName} {signup.lastName}
        </span>
        {signup.groupName && <span className="open-gym-signup-group">{signup.groupName}</span>}
      </span>
      <span className="open-gym-signup-position" style={{ background: getPositionColor(signup.position) }}>
        {getPositionAbbreviation(signup.position)}
      </span>
    </li>
  )
}

// Once the gym is full, a pending (unpaid) signup is functionally waiting
// for a spot just like a waitlist entry - render it the same way, dropping
// the position it originally requested.
function signupAsWaitlistEntry(signup: Signup): WaitlistEntry {
  const { id, timestamp, firstName, lastName, phoneNumber, groupName, waiverCompleted } = signup
  return { id, timestamp, firstName, lastName, phoneNumber, groupName, waiverCompleted }
}

function WaitlistRow({ entry }: { entry: WaitlistEntry }) {
  return (
    <li>
      <span className="open-gym-signup-name">
        <span>
          {entry.firstName} {entry.lastName}
        </span>
        {entry.groupName && <span className="open-gym-signup-group">{entry.groupName}</span>}
      </span>
    </li>
  )
}

export function OpenGymPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  // Passed by OpenGymsListPage's Link so the header info (date, time,
  // location, price, spots) can render immediately, before the full detail
  // (positions/signups/waitlist) has loaded. Absent on a direct nav/refresh.
  const linkedSummary = (location.state as { summary?: OpenGymSummary } | null)?.summary ?? null
  const [summary] = useState<OpenGymSummary | null>(linkedSummary)
  const [detail, setDetail] = useState<OpenGymDetail | null | undefined>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'signup' | 'waitlist'>('signup')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!id) return
    getOpenGym(id)
      .then((gym) => setDetail(gym ?? undefined))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Failed to load open gym.'))
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  if (loadError) {
    return (
      <>
        <Header />
        <main className="open-gym-page">
          <p className="open-gym-error">{loadError}</p>
          <Link to="/open-gyms">{'<'} Back to open gyms</Link>
        </main>
      </>
    )
  }

  if (detail === undefined) {
    return (
      <>
        <Header />
        <main className="open-gym-page">
          <p>Open gym not found.</p>
          <Link to="/open-gyms">{'<'} Back to open gyms</Link>
        </main>
      </>
    )
  }

  // Header info renders from whichever of detail/summary is available -
  // detail once it's loaded (freshest), the summary passed from the list
  // page in the meantime, or neither on a direct nav/refresh.
  const info = detail ?? summary

  if (!info) {
    return (
      <>
        <Header />
        <main className="open-gym-page">
          <Spinner />
        </main>
      </>
    )
  }

  const past = isOpenGymPast(info.endTime)
  const full = detail ? detail.positions.every((p) => p.filled >= p.available) : false

  const handleSubmit = async (input: SignupInput | WaitlistInput) => {
    if (modalMode === 'waitlist') {
      await joinWaitlist(info.id, input as WaitlistInput)
      setToastMessage('Joined waitlist!')
    } else {
      await createSignup(info.id, input as SignupInput)
      setToastMessage('Submitted! Make payment to confirm your spot.')
    }
    setShowModal(false)
    refresh()
  }

  return (
    <>
      <Header />
      <main className="open-gym-page">
        <Link className="open-gym-back" to="/open-gyms">
          {'<'} Back to open gyms
        </Link>

        <h1>{formatDate(info.date)}</h1>

        <dl className="open-gym-info">
          <div>
            <dt>Time</dt>
            <dd>
              {info.start} - {info.end}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{info.location}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{info.price}</dd>
          </div>
          <div>
            <dt>Spots</dt>
            <dd>
              {info.spotsFilled}/{info.spotsAvailable} filled
              {(info.pendingCount > 0 || info.waitlistCount > 0) &&
                ` (${[
                  info.pendingCount > 0 && `${info.pendingCount} pending`,
                  info.waitlistCount > 0 && `${info.waitlistCount} waitlist`,
                ]
                  .filter(Boolean)
                  .join(', ')})`}
            </dd>
          </div>
        </dl>

        <div className="open-gym-signups-header">
          <h2>Players</h2>
          {detail && !past && (
            <button
              type="button"
              className="open-gym-signup-button"
              onClick={() => {
                setModalMode(full ? 'waitlist' : 'signup')
                setShowModal(true)
              }}
            >
              {full ? 'Join Waitlist' : 'Sign Up'}
            </button>
          )}
        </div>
        <p className="open-gym-signups-subtext">
          To cancel your spot, email <a href="mailto:ducktatorsports@gmail.com">ducktatorsports@gmail.com</a>
        </p>

        {!detail ? (
          <Spinner />
        ) : (
          <>
            {detail.signups.length === 0 ? (
              <p>No signups yet.</p>
            ) : (
              (() => {
                const { teams, ungrouped } = groupByTeam(detail.signups)
                return (
                  <>
                    {teams.map((group) => (
                      <div key={group.team} className="open-gym-team-group">
                        <h3>{group.team}</h3>
                        <ul className="open-gym-signups">
                          {group.signups.map((signup) => (
                            <SignupRow key={signup.id} signup={signup} />
                          ))}
                        </ul>
                      </div>
                    ))}

                    {ungrouped.length > 0 && (
                      <ul className="open-gym-signups">
                        {ungrouped.map((signup) => (
                          <SignupRow key={signup.id} signup={signup} />
                        ))}
                      </ul>
                    )}
                  </>
                )
              })()
            )}

            {full ? (
              // Once full, unpaid signups can no longer claim a spot ahead of
              // the waitlist, so they're folded into it (ordered by when
              // each person actually joined, paid or not).
              (() => {
                const combinedWaitlist = [...detail.waitlist, ...detail.pendingSignups.map(signupAsWaitlistEntry)].sort(
                  (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                )
                return (
                  combinedWaitlist.length > 0 && (
                    <>
                      <h2 className="open-gym-waitlist-heading">Waitlist</h2>
                      <ul className="open-gym-signups">
                        {combinedWaitlist.map((entry) => (
                          <WaitlistRow key={entry.id} entry={entry} />
                        ))}
                      </ul>
                    </>
                  )
                )
              })()
            ) : (
              detail.pendingSignups.length > 0 && (
                <>
                  <h2 className="open-gym-waitlist-heading">Pending</h2>
                  <p className="signup-payment-notice">
                    Your spot will not be confirmed until you make payment ({detail.price}).
                    <div>Venmo:{' '}
                      <a href="https://venmo.com/u/ducktatorsports" target="_blank" rel="noreferrer">
                        @ducktatorsports
                      </a></div>
                    <div>Zelle: ducktatorsports</div>
                  </p>
                  <ul className="open-gym-signups">
                    {detail.pendingSignups.map((signup) => (
                      <SignupRow key={signup.id} signup={signup} />
                    ))}
                  </ul>
                </>
              )
            )}
          </>
        )}

        {showModal && detail && (
          <SignupModal
            groupNames={detail.groupNames}
            positions={detail.positions}
            price={detail.price}
            waitlist={modalMode === 'waitlist'}
            onCancel={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        )}

        {toastMessage && (
          <div className="open-gym-toast" role="status">
            {toastMessage}
          </div>
        )}
      </main>
    </>
  )
}
