import { useState } from 'react'
import './Header.css'

// This app lives on a subdomain (app.ducktatorsports.com), so links point back
// at the main site absolutely.
const SITE = 'https://ducktatorsports.com'
const LOGO = 'https://cdn-app.teamlinkt.com/media/association_data/34093/site_data/images/site_logo.png?v=1768227161'

const NAV = [
  { label: 'Home', href: `${SITE}/dsv/Home`, current: true },
  { label: 'Schedule', href: `${SITE}/dsv/Schedule` },
  { label: 'Scores', href: `${SITE}/dsv/Scores` },
  { label: 'Standings', href: `${SITE}/dsv/Standings` },
  { label: 'Contact Us', href: `${SITE}/dsv/ContactUs` },
]

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="#fff" stroke="none" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
      <path d="M23 7.5a3 3 0 0 0-2.1-2.1C19.1 5 12 5 12 5s-7.1 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1c1.8.4 8.9.4 8.9.4s7.1 0 8.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.5zM9.8 15.3V8.7l5.7 3.3z" />
    </svg>
  )
}

// Self-contained reimplementation of the ducktatorsports.com header so the app
// feels native to the main site (no external theme styles imported).
export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="dsv-header">
      <div className="dsv-topbar">
        <span className="dsv-title">Ducktator Sports</span>
        <div className="dsv-socials">
          <a className="dsv-social" href="https://instagram.com/ducktatorsports" target="_blank" rel="noreferrer" aria-label="Instagram">
            <InstagramIcon />
          </a>
          <a className="dsv-social" href="https://www.youtube.com/@ducktatorsports/" target="_blank" rel="noreferrer" aria-label="YouTube">
            <YoutubeIcon />
          </a>
        </div>
      </div>

      <hr className="dsv-divider" />

      <div className="dsv-main">
        <a className="dsv-logo" href={`${SITE}/dsv`}>
          <img src={LOGO} alt="Ducktator Sports" />
        </a>

        <button
          type="button"
          className={`dsv-burger${open ? ' open' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav className={`dsv-nav${open ? ' open' : ''}`}>
          <ul>
            {NAV.map((item) => (
              <li key={item.label} className={item.current ? 'current' : ''}>
                <a href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
