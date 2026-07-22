import './AvailabilityBar.css'

interface AvailabilityBarProps {
  filled: number
  available: number
  waitlistCount?: number
}

// Colored by how full the open gym is - green while there's plenty of room,
// yellow as it fills up, red as it nears capacity, blue once it's full.
function fillLevel(ratio: number): 'low' | 'medium' | 'high' | 'full' {
  if (ratio >= 1) return 'full'
  if (ratio > 0.75) return 'high'
  if (ratio >= 0.5) return 'medium'
  return 'low'
}

export function AvailabilityBar({ filled, available, waitlistCount = 0 }: AvailabilityBarProps) {
  const ratio = available > 0 ? filled / available : 0
  const level = fillLevel(ratio)

  return (
    <div className="availability">
      <div className="availability-label">
        {filled}/{available} spots filled{waitlistCount > 0 && ` (${waitlistCount} waitlist)`}
      </div>
      <div className="availability-track">
        <div
          className={`availability-fill availability-fill-${level}`}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
    </div>
  )
}
