import { useState } from 'react'
import type { FormEvent } from 'react'
import type { OpenGymInput, PositionSlotInput } from '../api/admin'
import { easternWallTimeToISO, isoToEasternWallTime } from '../api/openGyms'
import type { OpenGymDetail } from '../api/openGyms'

// Positions offered by default on a brand new gym. Positions are free-text in
// the database, so this is only a starting point - rows can be renamed, added,
// or removed per gym (e.g. adding "Libero").
const DEFAULT_SLOTS: PositionSlotInput[] = [
  { position: 'Setter', available: 4 },
  { position: 'Middle', available: 4 },
  { position: 'Outside', available: 8 },
  { position: 'Opposite', available: 4 },
  { position: 'Flex', available: 8 },
]

interface OpenGymFormProps {
  existing?: OpenGymDetail
  submitLabel: string
  onSubmit: (input: OpenGymInput) => Promise<void>
  onCancel?: () => void
}

export function OpenGymForm({ existing, submitLabel, onSubmit, onCancel }: OpenGymFormProps) {
  const [start, setStart] = useState(existing ? isoToEasternWallTime(existing.startTime) : '')
  const [end, setEnd] = useState(existing ? isoToEasternWallTime(existing.endTime) : '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [price, setPrice] = useState(existing?.price ?? '')
  const [slots, setSlots] = useState<PositionSlotInput[]>(
    existing ? existing.positions.map((p) => ({ position: p.position, available: p.available })) : DEFAULT_SLOTS,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validSlots = slots.filter((s) => s.position.trim() !== '')
  const canSubmit =
    start !== '' && end !== '' && location.trim() !== '' && price.trim() !== '' && validSlots.length > 0

  const updateSlot = (index: number, changes: Partial<PositionSlotInput>) =>
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...changes } : slot)))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    const startTime = easternWallTimeToISO(start)
    const endTime = easternWallTimeToISO(end)
    if (new Date(endTime) <= new Date(startTime)) {
      setError('End time must be after the start time.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        startTime,
        endTime,
        location: location.trim(),
        price: price.trim(),
        slots: validSlots.map((s) => ({ position: s.position.trim(), available: s.available })),
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving this open gym.')
      setSubmitting(false)
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label className="admin-field">
        Start (Eastern)
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
      </label>

      <label className="admin-field">
        End (Eastern)
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
      </label>

      <label className="admin-field">
        Location
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} required />
      </label>

      <label className="admin-field">
        Price
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$17" maxLength={20} required />
      </label>

      <div className="admin-field">
        Position Slots
        <div className="admin-slots">
          {slots.map((slot, i) => (
            <div className="admin-slot-row" key={i}>
              <input
                className="admin-slot-position"
                value={slot.position}
                onChange={(e) => updateSlot(i, { position: e.target.value })}
                placeholder="Position"
                maxLength={40}
                aria-label="Position name"
              />
              <input
                className="admin-slot-count"
                type="number"
                min={0}
                value={slot.available}
                onChange={(e) => updateSlot(i, { available: Math.max(0, Number(e.target.value)) })}
                aria-label={`${slot.position} slots`}
              />
              <button
                type="button"
                className="admin-slot-remove"
                onClick={() => setSlots((current) => current.filter((_, index) => index !== i))}
                aria-label={`Remove ${slot.position}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="admin-button admin-button-secondary admin-add-slot"
          onClick={() => setSlots((current) => [...current, { position: '', available: 0 }])}
        >
          + Add Position
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-form-actions">
        {onCancel && (
          <button type="button" className="admin-button admin-button-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button type="submit" className="admin-button" disabled={!canSubmit || submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
