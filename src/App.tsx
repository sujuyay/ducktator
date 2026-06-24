import { LineupSimulator, PLAYER_COUNT } from '@jkim430/lineup'
import type { DeepPartial, LineupSettings, RotationValidator } from '@jkim430/lineup'
import '@jkim430/lineup/style.css'
import { Header } from './Header'


// Bench method: scale the required females on court to the roster size -
// 2 for a 6-8 player roster, 3 for 9-10. Only full courts are checked.
const benchMinFemales: RotationValidator = (lineup) => {
  const rosterSize = Object.keys(lineup.roster).length;
  const required = rosterSize >= 9 && rosterSize <= 10 ? 3 : rosterSize >= 6 && rosterSize <= 8 ? 2 : 0;
  if (required === 0) return { messages: [] };

  const females = Object.values(lineup.roster).filter((c) => c.gender === 'female').length;
  return females < required ? { messages: [`Must have ${required} females in lineup`] } : { messages: [] };
};

// Substitutions method: the court needs 2 girls. Exception: the libero (a girl)
// may leave during serve - dropping to 1 girl - once she has already served for
// her player in an earlier rotation, so another player can serve. On receive she
// must be back in the court's back row.
const subsLiberoCourtRule: RotationValidator = (lineup, rotationIndex, phase) => {
  const court = lineup.rotations[rotationIndex]?.[phase]?.court;
  // Only validate a fully-filled court (skip rotation 1 mid-setup).
  if (!court || !court.every((c) => c.playerId)) return { messages: [] };

  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  const girls = court.filter((c) => lineup.roster[c.playerId]?.gender === 'female').length;
  const backRow = court.slice(PLAYER_COUNT / 2);
  const liberoOnCourt = !!liberoId && court.some((c) => c.playerId === liberoId);

  if (phase === 'receive') {
    // On receive the libero must be back on the back row.
    if (liberoId && !backRow.some((c) => c.playerId === liberoId)) {
      return { messages: ['Must have 2 females on court'] };
    }
    return girls >= 2 ? { messages: [] } : { messages: ['Must have 2 females on court'] };
  }

  // Serve: 2 girls required, unless the libero has already served (in an earlier
  // serve rotation) and has now left the court so another player can serve.
  if (girls >= 2) return { messages: [] };
  const serverIndex = PLAYER_COUNT - 1;
  const liberoHasServed = lineup.rotations
    .slice(0, rotationIndex)
    .some((r) => r.serve.court[serverIndex]?.playerId === liberoId);
  if (girls === 1 && !liberoOnCourt && liberoHasServed) return { messages: [] };

  return { messages: ['Must have 2 females on court'] };
};

const settings: DeepPartial<LineupSettings> = {
  minGirls: { default: 1, min: 0, autoFulfill: false, editable: false },
  maxSizePerBench: 2,
  maxRosterSize: 10,
  numLineups: 6,
  validators: { bench: [benchMinFemales], substitutions: [subsLiberoCourtRule] },
  colors: {
    bgPrimary: '#0f1419',
    bgSecondary: '#1a1f2e',
    bgTertiary: '#252d3d',
    courtBg: '#162322',
    courtLines: '#1e3a36',
    textPrimary: '#f0f4f8',
    textSecondary: '#8899a6',
    textMuted: '#657786',
    male: '#4dabf7',
    female: '#f06595',
    danger: '#e74c3c',
    accentPrimary: '#F2C230',
    accentSecondary: '#D9A82B',
    positions: {
      setter: '#E67E22',
      outside_hitter: '#3366E6',
      opposite_hitter: '#FF6B6B',
      libero: '#2ECC71',
      middle_blocker: '#9B59B6',
      defensive_specialist: '#F03292',
    },
  },
}

// Analytics intentionally not wired up yet (will pass onTrack later).
function App() {
  return (
    <>
      <Header />
      <LineupSimulator settings={settings} />
    </>
  )
}

export default App
