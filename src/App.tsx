import { Navigate, Route, Routes } from 'react-router-dom'
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
  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  const girls = court.filter((c) => lineup.roster[c.playerId]?.gender === 'female').length;
  const liberoOnCourt = !!liberoId && court.some((c) => c.playerId === liberoId);
  // Serve: 2 girls required, unless the libero has already served (in an earlier
  // serve rotation) and has now left the court so another player can serve.
  if (girls >= 2) return { messages: [] };

  if (phase === 'receive' && girls < 2) {
    return { messages: ['Must have 2 females on court'] };
  }

  const serverIndex = PLAYER_COUNT - 1;
  const liberoHasServed = lineup.rotations
    .slice(0, rotationIndex)
    .some((r) => r.serve.court[serverIndex]?.playerId === liberoId);
  if (girls === 1 && !liberoOnCourt && liberoHasServed) return { messages: [] };

  return { messages: ['Must have 2 females on court'] };
};

// Both methods: across the full rotation cycle the libero must be on court for
// exactly 6 rotations. A rotation counts if the libero is on court in its serve,
// receive, or both phases. The (lineup-wide) violation is surfaced only on the
// rotations where she is off court.
//
// Rotation 1 (index 0) is never flagged: players are configured from there (and
// the library rejects edits that leave the active rotation invalid), and the
// libero may legitimately start off court at rotation 1. (The library only runs
// validators on a full court.)
const liberoSixRotations: RotationValidator = (lineup, rotationIndex) => {
  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  if (!liberoId) return { messages: [] };

  const onCourt = (court: { playerId: string }[]) => court.some((c) => c.playerId === liberoId);
  const count = lineup.rotations.filter((r) => onCourt(r.serve.court) || onCourt(r.receive.court)).length;
  if (count === 6) return { messages: [] };

  // Only surface the violation on rotations where the libero is off court.
  const here = lineup.rotations[rotationIndex];
  if (!here || onCourt(here.serve.court) || onCourt(here.receive.court)) return { messages: [] };

  return { messages: ['Libero must play exactly 6 rotations'] };
};

// Bench method: the libero may only replace at most 2 distinct players over the
// course of the lineup. The player the libero subs for sits on the libero bench,
// so the distinct players she has replaced are the unique libero-bench ids that
// aren't the libero herself (across every rotation/phase).
const liberoMaxReplacements: RotationValidator = (lineup) => {
  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  if (!liberoId) return { messages: [] };

  const replaced = new Set<string>();
  for (const r of lineup.rotations) {
    for (const phase of [r.serve, r.receive]) {
      for (const id of phase.liberoBench) {
        if (id && id !== liberoId) replaced.add(id);
      }
    }
  }

  return replaced.size > 2 ? { messages: ['Libero can only replace 2 positions'] } : { messages: [] };
};

// Subs method: the libero subs in for a player and takes their rotational
// position, so the players she replaces are the distinct rotationalPosition
// values she occupies while on court (across every rotation/phase). Cap at 2.
const liberoMaxPositions: RotationValidator = (lineup) => {
  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  if (!liberoId) return { messages: [] };

  const positions = new Set<number>();
  for (const r of lineup.rotations) {
    for (const phase of [r.serve, r.receive]) {
      for (const c of phase.court) {
        if (c.playerId === liberoId && c.rotationalPosition !== undefined) positions.add(c.rotationalPosition);
      }
    }
  }

  return positions.size > 2 ? { messages: ['Libero can only replace 2 positions'] } : { messages: [] };
};

const settings: DeepPartial<LineupSettings> = {
  minGirls: { default: 1, min: 0, autoFulfill: false, editable: false },
  maxRosterSize: 10,
  numLineups: 6,
  validators: {
    bench: [benchMinFemales, liberoSixRotations, liberoMaxReplacements],
    substitutions: [subsLiberoCourtRule, liberoMaxPositions, liberoSixRotations],
  },
  colors: {
    accentPrimary: '#06A4B4',
    accentSecondary: '#057a86',
  },
  defaultTheme: 'light',
}

// Umami's tracking script (loaded in index.html) exposes window.umami once ready.
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

// Forward the lineup's analytics events to Umami (no-op until the script loads).
const track = (event: string, data?: Record<string, unknown>) => {
  window.umami?.track(event, data)
}

// The lineup tool, served at /lineup.
function LineupPage() {
  return (
    <>
      <Header />
      <LineupSimulator settings={settings} onTrack={track} />
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/lineup" element={<LineupPage />} />
      {/* Anything else (incl. /) redirects to the lineup page for now. */}
      <Route path="*" element={<Navigate to="/lineup" replace />} />
    </Routes>
  )
}

export default App
