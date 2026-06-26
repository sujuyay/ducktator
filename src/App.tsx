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

// Bench method: when the libero would rotate off the back row it moves to the
// libero bench and its substitute plays, so the libero "sits out" until brought
// back. She may sit out at most N consecutive rotations, where N is the larger
// of the two side benches (the players cycling through court on that side). A
// rotation only counts as a sit-out when the libero is off court in both its
// serve and receive formations. Only the offending rotations are flagged: a
// rotation is invalid when the run of consecutive sit-outs ending at it exceeds
// N (so the first N out-rotations pass and each one after must have her back).
// The run is counted backwards, wrapping around the cycle.
//
// Rotation 1 (index 0) is never flagged - players are configured from there, so
// flagging it would block edits. The wrap-around streak that would end at it is
// instead checked when validating the last rotation. (The library only runs
// validators on a full court.)
const liberoBenchStreak: RotationValidator = (lineup, rotationIndex) => {
  const liberoId = Object.values(lineup.roster).find((p) => p.position === 'libero')?.id;
  const rotations = lineup.rotations;
  if (!liberoId || rotations.length === 0) return { messages: [] };

  // N = the greater of the two side-bench sizes (constant across the cascade).
  const first = rotations[0].serve;
  const maxBench = Math.max(first.leftBench.length, first.rightBench.length);

  // A rotation is a sit-out only when the libero is off court in both phases.
  const onCourt = (court: { playerId: string }[]) => court.some((c) => c.playerId === liberoId);
  const isOut = (i: number) => !onCourt(rotations[i].serve.court) && !onCourt(rotations[i].receive.court);

  // Consecutive sit-out rotations ending at index i, walking backwards and
  // wrapping around the cycle (a full lap means she never plays).
  const n = rotations.length;
  const streakEndingAt = (i: number): number => {
    if (!isOut(i)) return 0;
    let streak = 0;
    for (let k = 0; k < n; k++) {
      if (!isOut((i - k + n * n) % n)) break;
      streak++;
    }
    return streak;
  };

  // Skip rotation 1; on the last rotation, also check rotation 1's wrap-around
  // streak so the violation still surfaces (just not on rotation 1 itself).
  const indices: number[] = [];
  if (rotationIndex !== 0) indices.push(rotationIndex);
  if (rotationIndex === n - 1 && n > 1) indices.push(0);

  return indices.some((i) => streakEndingAt(i) > maxBench)
    ? { messages: [`Libero can only sit out for ${maxBench} rotation${maxBench === 1 ? '' : 's'}`] }
    : { messages: [] };
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
    bench: [benchMinFemales, liberoBenchStreak, liberoMaxReplacements],
    substitutions: [subsLiberoCourtRule, liberoMaxPositions],
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
