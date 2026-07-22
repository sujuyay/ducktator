import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../Header'
import { listOpenGyms, listPastOpenGyms } from '../api/openGyms'
import type { OpenGymSummary } from '../api/openGyms'
import { AvailabilityBar } from '../components/AvailabilityBar'
import { Spinner } from '../components/Spinner'
import { formatDate } from './openGymFormat'
import './OpenGymsListPage.css'

function OpenGymsTable({ openGyms }: { openGyms: OpenGymSummary[] }) {
  return (
    <div className="open-gyms-table" role="table">
      <div className="open-gyms-row open-gyms-header" role="row">
        <span role="columnheader">Date</span>
        <span role="columnheader">Time</span>
        <span role="columnheader">Location</span>
        <span role="columnheader">Price</span>
        <span role="columnheader">Availability</span>
      </div>

      {openGyms.map((gym) => (
        <Link
          key={gym.date}
          className="open-gyms-row open-gym-card"
          to={`/open-gyms/${gym.date}`}
          state={{ summary: gym }}
          role="row"
        >
          <span className="open-gym-card-date">{formatDate(gym.date)}</span>
          <span>
            {gym.start} - {gym.end}
          </span>
          <span>{gym.location}</span>
          <span>{gym.price}</span>
          <AvailabilityBar filled={gym.spotsFilled} available={gym.spotsAvailable} waitlistCount={gym.waitlistCount} />
        </Link>
      ))}
    </div>
  )
}

export function OpenGymsListPage() {
  const [upcoming, setUpcoming] = useState<OpenGymSummary[] | null>(null)
  const [past, setPast] = useState<OpenGymSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listOpenGyms()
      .then((gyms) => {
        if (!cancelled) setUpcoming(gyms)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load open gyms.')
      })
    listPastOpenGyms().then((gyms) => {
      if (!cancelled) setPast(gyms)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <Header />
      <main className="open-gyms-list">
        <h1>Open Gyms</h1>

        {error && <p className="open-gyms-error">{error}</p>}
        {!error && upcoming === null && <Spinner />}
        {!error && upcoming?.length === 0 && <p>No upcoming open gyms right now - check back soon.</p>}
        {!error && upcoming && upcoming.length > 0 && <OpenGymsTable openGyms={upcoming} />}

        {past && past.length > 0 && (
          <>
            <h2 className="open-gyms-section-heading">Past Open Gyms</h2>
            <OpenGymsTable openGyms={past} />
          </>
        )}
      </main>
    </>
  )
}
