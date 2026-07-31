import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Position, PositionSlots, SignupInput, WaitlistInput } from '../api/openGyms'
import { getPositionColor, withAlpha } from '../positionColors'
import './SignupModal.css'

const NEW_GROUP = '__new__'

// Capitalizes the first letter after the start of the string or a space/
// hyphen/apostrophe, without touching the rest (so "McDonald" typed as-is
// stays intact rather than getting force-lowercased).
const capitalizeName = (value: string) => value.replace(/(^|[\s'-])([a-z])/g, (_, sep, char) => sep + char.toUpperCase())

interface SignupModalProps {
  groupNames: string[]
  positions: PositionSlots[]
  price: string
  waitlist?: boolean
  onCancel: () => void
  onSubmit: (input: SignupInput | WaitlistInput) => Promise<void>
}

export function SignupModal({ groupNames, positions, price, waitlist = false, onCancel, onSubmit }: SignupModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [groupChoice, setGroupChoice] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [position, setPosition] = useState<Position | null>(null)
  const [waiverCompleted, setWaiverCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groupName = groupChoice === NEW_GROUP ? newGroupName.trim() : groupChoice
  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    phoneNumber.length === 10 &&
    (waitlist || position !== null) &&
    waiverCompleted &&
    (groupChoice !== NEW_GROUP || newGroupName.trim() !== '')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    if (!waitlist && !position) return

    setSubmitting(true)
    setError(null)
    try {
      if (waitlist) {
        await onSubmit({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          groupName,
          waiverCompleted,
        })
      } else {
        await onSubmit({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          groupName,
          position: position as Position,
          waiverCompleted,
        })
      }
    } catch {
      setError('Something went wrong submitting your signup. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="signup-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sign up for open gym"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="signup-modal">
        <h2 className="signup-modal-header">{waitlist ? 'Join Waitlist' : 'Sign Up'}</h2>
        <form className="signup-modal-form" onSubmit={handleSubmit}>
        <div className="signup-modal-body">
        {!waitlist &&
          (<p className="signup-payment-notice">
            Your spot will not be confirmed until you make payment ({price}).
            <div>Venmo:{' '}
              <a href="https://venmo.com/u/ducktatorsports" target="_blank" rel="noreferrer">
                @ducktatorsports
              </a></div>
            <div>Zelle: ducktatorsports</div>
          </p>)
        }
          <label className="signup-field">
            First Name
            <input
              value={firstName}
              onChange={(e) => setFirstName(capitalizeName(e.target.value))}
              required
            />
          </label>

          <label className="signup-field">
            Last Name
            <input
              value={lastName}
              onChange={(e) => setLastName(capitalizeName(e.target.value))}
              required
            />
          </label>

          <label className="signup-field">
            Phone Number
            <input
              type="tel"
              inputMode="numeric"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
            />
          </label>

          <label className="signup-field">
            Group Name (optional)
            <select value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
              <option value="">None</option>
              {groupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={NEW_GROUP}>Create New Group</option>
            </select>
            <span className="signup-field-subtext">
              We will do our best to place you on the same team as others with your group name.
            </span>
          </label>

          {groupChoice === NEW_GROUP && (
            <label className="signup-field">
              New Group Name
              <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
            </label>
          )}

          {!waitlist && (
            <div className="signup-field">
              Position
              <div className="signup-position-buttons">
                {positions.map((p) => {
                  const remaining = p.available - p.filled
                  const disabled = remaining <= 0
                  return (
                    <button
                      key={p.position}
                      type="button"
                      className={`signup-position-button${position === p.position ? ' selected' : ''}`}
                      disabled={disabled}
                      onClick={() => setPosition(p.position)}
                      style={
                        position === p.position
                          ? { borderColor: getPositionColor(p.position), background: getPositionColor(p.position) }
                          : {
                              borderColor: getPositionColor(p.position),
                              background: withAlpha(getPositionColor(p.position), '26'),
                            }
                      }
                    >
                      {p.position}
                      <span className="signup-position-count">{disabled ? 'Full' : `${remaining} open`}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <details className="signup-waiver-details">
            <summary>Waiver &amp; Code of Conduct</summary>
            <div className="signup-waiver-text">
              <p>
                <strong>WAIVER AND RELEASE OF LIABILITY</strong>
              </p>
              <p>
                I acknowledge that participation in recreational sports activities, including volleyball, involves
                inherent risks of injury, including but not limited to falls, collisions, contact with other
                participants, and other unforeseen risks that may result in serious injury, illness, or death.
              </p>
              <p>
                I voluntarily choose to participate in activities organized by Ducktator Sports and assume all
                risks associated with such participation.
              </p>
              <p>
                I hereby release, waive, and discharge Ducktator Sports, its owners, organizers, agents, and
                affiliates from any and all liability, claims, demands, or causes of action arising out of or
                related to any injury, damage, or loss that may be sustained while participating in league
                activities, whether caused by negligence or otherwise, to the fullest extent permitted by law.
              </p>
              <p>
                I understand that this release includes any claims based on the actions, omissions, or negligence
                of the released parties.
              </p>
              <p>
                I certify that I am physically able to participate in the activities and have not been advised
                otherwise by a qualified medical professional.
              </p>
              <p>
                I agree to abide by all rules and instructions provided by league organizers and acknowledge that
                failure to do so may result in removal from participation.
              </p>
              <p>
                I understand that I am responsible for my own medical insurance and that Ducktator Sports does not
                provide medical coverage for injuries sustained during participation.
              </p>
              <p>
                <strong>CODE OF CONDUCT</strong>
              </p>
              <p>
                Ducktator Sports reserves the right, in its sole discretion, to suspend, remove, deny participation
                to, or permanently ban any player, spectator, guest, or team when it determines such action is
                necessary for safety, security, legal compliance, facility requirements, sportsmanship, operational
                needs, or the best interests of the league.
              </p>
              <p>
                Any participant who is suspended, removed, denied participation, or banned by Ducktator Sports,
                whether for a violation of league rules or for any other reason permitted under this policy, shall
                not be entitled to a refund of league fees, registration fees, membership fees, or any other
                amounts previously paid, except where required by applicable law or where Ducktator Sports
                expressly elects to provide a refund.
              </p>
            </div>
          </details>

          <label className="signup-field signup-waiver">
            <input
              type="checkbox"
              checked={waiverCompleted}
              onChange={(e) => setWaiverCompleted(e.target.checked)}
            />
            <span>
              I confirm the following:
              <ol>
                <li>I am 18 years or older</li>
                <li>I have read and agree to the Waiver and Release of Liability</li>
                <li>I have read and agree to the Code of Conduct</li>
              </ol>
            </span>
          </label>

          {error && <p className="signup-error">{error}</p>}
        </div>

        <div className="signup-modal-actions">
          <button type="button" className="signup-cancel" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="signup-submit" disabled={!canSubmit || submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
