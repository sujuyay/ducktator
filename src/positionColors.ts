import type { Position } from './api/openGyms'

// Matches the position colors used by the lineup tool (@jkim430/lineup),
// mapped onto open gym positions. Flex has no direct lineup equivalent, so it
// borrows the libero color (green) since that role isn't otherwise used here.
// Positions are free-text in the database (see position_slots), so a newly
// added position without an entry here falls back to a neutral color/initials
// until someone adds a proper mapping.
const POSITION_COLORS: Record<string, string> = {
  Setter: '#E6B333',
  Middle: '#9B59B6',
  Outside: '#3366E6',
  Opposite: '#FF6B6B',
  Flex: '#2ECC71',
}
const FALLBACK_COLOR = '#888888'

export const getPositionColor = (position: Position) => POSITION_COLORS[position] ?? FALLBACK_COLOR

// Appends an alpha channel to a "#RRGGBB" color, e.g. for a lighter tint.
export const withAlpha = (hex: string, alphaHex: string) => `${hex}${alphaHex}`

const POSITION_ABBREVIATIONS: Record<string, string> = {
  Setter: 'S',
  Middle: 'M',
  Opposite: 'OP',
  Outside: 'OH',
  Flex: 'F',
}

export const getPositionAbbreviation = (position: Position) =>
  POSITION_ABBREVIATIONS[position] ?? position.slice(0, 2).toUpperCase()
