import type { Position } from './api/openGyms'

// Matches the position colors used by the lineup tool (@jkim430/lineup),
// mapped onto open gym positions. Flex has no direct lineup equivalent, so it
// borrows the libero color (green) since that role isn't otherwise used here.
export const POSITION_COLORS: Record<Position, string> = {
  Setter: '#E6B333',
  Middle: '#9B59B6',
  Outside: '#3366E6',
  Opposite: '#FF6B6B',
  Flex: '#2ECC71',
}

// Appends an alpha channel to a "#RRGGBB" color, e.g. for a lighter tint.
export const withAlpha = (hex: string, alphaHex: string) => `${hex}${alphaHex}`

export const POSITION_ABBREVIATIONS: Record<Position, string> = {
  Setter: 'S',
  Middle: 'M',
  Opposite: 'OP',
  Outside: 'OH',
  Flex: 'F',
}
