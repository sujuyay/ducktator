// Data-access layer for open gyms, backed by Supabase (see the `open_gyms`,
// `position_slots`, `signups`, and `waitlist` tables). Positions are plain
// text rows in `position_slots` rather than a fixed enum, so adding a new
// position (e.g. "Libero") is just inserting rows - no schema change needed.
//
// Phone numbers are deliberately absent from the public read path. The `anon`
// role only holds column-level SELECT grants on the non-phone columns, so
// asking for `phone_number` (or `*`) as an anonymous caller is rejected by
// Postgres outright. The public and admin shapes are separate types below so
// that boundary is enforced at compile time too, rather than relying on nobody
// ever rendering a field they shouldn't.

import { supabase } from './supabaseClient'

export type Position = string

export interface PositionSlots {
  position: Position
  available: number
  filled: number
}

export interface OpenGymSummary {
  id: string
  date: string // "YYYY-MM-DD"
  start: string // e.g. "6:00 PM", for display
  end: string // e.g. "8:00 PM", for display
  startTime: string // ISO instant - the underlying value, for editing
  endTime: string // ISO instant - also used to tell whether the gym is over
  location: string
  price: string
  spotsFilled: number
  spotsAvailable: number
  pendingCount: number
  waitlistCount: number
}

export interface Signup {
  id: string
  timestamp: string // ISO 8601
  firstName: string
  lastName: string
  groupName: string
  team: string // '' until assigned manually
  position: Position
  waiverCompleted: boolean
  paid: boolean
}

export interface WaitlistEntry {
  id: string
  timestamp: string // ISO 8601
  firstName: string
  lastName: string
  groupName: string
  waiverCompleted: boolean
}

// Admin reads additionally carry the phone number, which requires a signed-in
// session to fetch at all.
export interface AdminSignup extends Signup {
  phoneNumber: string
}

export interface AdminWaitlistEntry extends WaitlistEntry {
  phoneNumber: string
}

interface OpenGymDetailBase<S extends Signup, W extends WaitlistEntry> extends OpenGymSummary {
  positions: PositionSlots[]
  groupNames: string[]
  signups: S[] // paid only, sorted most recent first
  pendingSignups: S[] // unpaid, sorted most recent first
  waitlist: W[] // sorted by join order, earliest first
}

export type OpenGymDetail = OpenGymDetailBase<Signup, WaitlistEntry>
export type AdminOpenGymDetail = OpenGymDetailBase<AdminSignup, AdminWaitlistEntry>

export interface SignupInput {
  firstName: string
  lastName: string
  phoneNumber: string
  groupName: string
  position: Position
  waiverCompleted: boolean
}

export interface WaitlistInput {
  firstName: string
  lastName: string
  phoneNumber: string
  groupName: string
  waiverCompleted: boolean
}

// Open gym dates/times are always in US Eastern time (observing DST, i.e.
// EST/EDT as a wall clock in America/New_York would show).
const EASTERN_TZ = 'America/New_York'

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

function easternParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

// How far Eastern's wall clock sits from UTC at a given instant, in ms
// (negative, since America/New_York is behind UTC): -4h under EDT, -5h under EST.
function easternOffsetMs(date: Date): number {
  const p = easternParts(date)
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
  return asUTC - date.getTime()
}

// Eastern wall clock "YYYY-MM-DDTHH:MM" (what an <input type="datetime-local">
// produces) -> the matching UTC instant, so the admin enters plain Eastern
// times year-round without thinking about DST or their device's timezone.
//
// Solves `instant + offset(instant) = wall` by fixed-point iteration. The
// first pass samples the offset at the wall time read as UTC, which can land
// on the wrong side of a DST transition (e.g. 3 AM on the spring-forward day
// samples the previous evening, still EST, and lands an hour late). The second
// pass re-samples at that much closer instant, which settles it.
export function easternWallTimeToISO(wall: string): string {
  const withSeconds = wall.length === 16 ? `${wall}:00` : wall
  const wallAsUtc = new Date(`${withSeconds}Z`).getTime()
  const firstPass = wallAsUtc - easternOffsetMs(new Date(wallAsUtc))
  return new Date(wallAsUtc - easternOffsetMs(new Date(firstPass))).toISOString()
}

// Inverse of easternWallTimeToISO, for populating a datetime-local input.
export function isoToEasternWallTime(iso: string): string {
  const p = easternParts(new Date(iso))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// The Eastern calendar date an instant falls on, for the `date` column.
export function easternDate(iso: string): string {
  return isoToEasternWallTime(iso).slice(0, 10)
}

// An open gym is "in the future" (and available to sign up for) until it ends.
export const isOpenGymPast = (endTime: string) => new Date(endTime).getTime() <= Date.now()

interface SummaryRow {
  id: string
  date: string
  start_time: string
  end_time: string
  location: string
  price: string
  position_slots: { available: number }[]
  signups: { paid: boolean }[]
  waitlist: { id: string }[]
}

const SUMMARY_SELECT =
  'id, date, start_time, end_time, location, price, position_slots(available), signups(paid), waitlist(id)'

function rowToSummary(row: SummaryRow): OpenGymSummary {
  return {
    id: row.id,
    date: row.date,
    start: formatTime(row.start_time),
    end: formatTime(row.end_time),
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    price: row.price,
    spotsAvailable: row.position_slots.reduce((sum, p) => sum + p.available, 0),
    spotsFilled: row.signups.filter((s) => s.paid).length,
    pendingCount: row.signups.filter((s) => !s.paid).length,
    waitlistCount: row.waitlist.length,
  }
}

// Column lists are spelled out rather than using `*` because `*` expands to
// include phone_number, which the anon role has no grant on.
const PUBLIC_SIGNUP_COLUMNS = 'id, created_at, first_name, last_name, group_name, position, waiver_completed, paid, team'
const PUBLIC_WAITLIST_COLUMNS = 'id, created_at, first_name, last_name, group_name, waiver_completed'
const ADMIN_SIGNUP_COLUMNS = `${PUBLIC_SIGNUP_COLUMNS}, phone_number`
const ADMIN_WAITLIST_COLUMNS = `${PUBLIC_WAITLIST_COLUMNS}, phone_number`

const detailSelect = (signupColumns: string, waitlistColumns: string) =>
  `id, date, start_time, end_time, location, price, position_slots(position, available), ` +
  `signups(${signupColumns}), waitlist(${waitlistColumns})`

interface SignupRow {
  id: string
  created_at: string
  first_name: string
  last_name: string
  group_name: string
  position: string
  waiver_completed: boolean
  paid: boolean
  team: string
  phone_number?: string // admin reads only
}

interface WaitlistRow {
  id: string
  created_at: string
  first_name: string
  last_name: string
  group_name: string
  waiver_completed: boolean
  phone_number?: string // admin reads only
}

interface DetailRow extends SummaryRow {
  position_slots: { position: string; available: number }[]
  signups: SignupRow[]
  waitlist: WaitlistRow[]
}

function rowToSignup(row: SignupRow): Signup {
  return {
    id: row.id,
    timestamp: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    groupName: row.group_name,
    team: row.team,
    position: row.position,
    waiverCompleted: row.waiver_completed,
    paid: row.paid,
  }
}

function rowToWaitlistEntry(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    timestamp: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    groupName: row.group_name,
    waiverCompleted: row.waiver_completed,
  }
}

const rowToAdminSignup = (row: SignupRow): AdminSignup => ({
  ...rowToSignup(row),
  phoneNumber: row.phone_number ?? '',
})

const rowToAdminWaitlistEntry = (row: WaitlistRow): AdminWaitlistEntry => ({
  ...rowToWaitlistEntry(row),
  phoneNumber: row.phone_number ?? '',
})

const newestFirst = (a: { timestamp: string }, b: { timestamp: string }) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

const oldestFirst = (a: { timestamp: string }, b: { timestamp: string }) =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()

function assembleDetail<S extends Signup, W extends WaitlistEntry>(
  row: DetailRow,
  allSignups: S[],
  allWaitlist: W[],
): OpenGymDetailBase<S, W> {
  const signups = allSignups.filter((s) => s.paid).sort(newestFirst)
  const pendingSignups = allSignups.filter((s) => !s.paid).sort(newestFirst)
  const waitlist = [...allWaitlist].sort(oldestFirst)
  const positions: PositionSlots[] = row.position_slots.map((p) => ({
    position: p.position,
    available: p.available,
    filled: signups.filter((s) => s.position === p.position).length,
  }))

  return {
    id: row.id,
    date: row.date,
    start: formatTime(row.start_time),
    end: formatTime(row.end_time),
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    price: row.price,
    spotsAvailable: positions.reduce((sum, p) => sum + p.available, 0),
    spotsFilled: signups.length,
    pendingCount: pendingSignups.length,
    waitlistCount: waitlist.length,
    positions,
    groupNames: [...new Set(allSignups.map((s) => s.groupName).filter(Boolean))].sort(),
    signups,
    pendingSignups,
    waitlist,
  }
}

async function fetchDetailRow(id: string, select: string): Promise<DetailRow | undefined> {
  const { data, error } = await supabase.from('open_gyms').select(select).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DetailRow | null) ?? undefined
}

// Module-level cache, shared by every page for the lifetime of the SPA (this
// module is only ever loaded once, so navigating between routes doesn't
// re-import it). Caches in-flight promises, not just resolved values, so
// concurrent callers (e.g. React StrictMode's double effect) share one
// request instead of firing two.
let openGymsCache: Promise<OpenGymSummary[]> | null = null
let pastOpenGymsCache: Promise<OpenGymSummary[]> | null = null
const openGymDetailCache = new Map<string, Promise<OpenGymDetail | undefined>>()

// Exported so admin mutations (see admin.ts) can drop stale reads after
// changing data - the public pages share this same cache.
export function invalidateCaches(id?: string) {
  openGymsCache = null
  pastOpenGymsCache = null
  if (id === undefined) openGymDetailCache.clear()
  else openGymDetailCache.delete(id)
}

export async function listOpenGyms(): Promise<OpenGymSummary[]> {
  openGymsCache ??= (async () => {
    const { data, error } = await supabase
      .from('open_gyms')
      .select(SUMMARY_SELECT)
      .gt('end_time', new Date().toISOString())
      .order('date', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as SummaryRow[]).map(rowToSummary)
  })()
  return openGymsCache
}

export async function listPastOpenGyms(): Promise<OpenGymSummary[]> {
  pastOpenGymsCache ??= (async () => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 1)
    const { data, error } = await supabase
      .from('open_gyms')
      .select(SUMMARY_SELECT)
      .lte('end_time', new Date().toISOString())
      .gte('date', cutoff.toISOString().slice(0, 10))
      .order('date', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as SummaryRow[]).map(rowToSummary)
  })()
  return pastOpenGymsCache
}

// Every open gym regardless of date, newest first. Uncached - the admin page
// needs to see its own writes immediately.
export async function listAllOpenGyms(): Promise<OpenGymSummary[]> {
  const { data, error } = await supabase.from('open_gyms').select(SUMMARY_SELECT).order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as SummaryRow[]).map(rowToSummary)
}

export async function getOpenGym(id: string): Promise<OpenGymDetail | undefined> {
  let cached = openGymDetailCache.get(id)
  if (!cached) {
    cached = (async () => {
      const row = await fetchDetailRow(id, detailSelect(PUBLIC_SIGNUP_COLUMNS, PUBLIC_WAITLIST_COLUMNS))
      if (!row) return undefined
      return assembleDetail(row, row.signups.map(rowToSignup), row.waitlist.map(rowToWaitlistEntry))
    })()
    openGymDetailCache.set(id, cached)
  }
  return cached
}

// Admin variant: includes phone numbers and is never cached, so the admin page
// always reflects its own most recent writes.
export async function getOpenGymForAdmin(id: string): Promise<AdminOpenGymDetail | undefined> {
  const row = await fetchDetailRow(id, detailSelect(ADMIN_SIGNUP_COLUMNS, ADMIN_WAITLIST_COLUMNS))
  if (!row) return undefined
  return assembleDetail(row, row.signups.map(rowToAdminSignup), row.waitlist.map(rowToAdminWaitlistEntry))
}

// Inserts don't ask for the row back: returning it would need SELECT grants on
// the inserted columns, and no caller uses the result.
export async function createSignup(openGymId: string, input: SignupInput): Promise<void> {
  const { error } = await supabase.from('signups').insert({
    open_gym_id: openGymId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone_number: input.phoneNumber || '',
    group_name: input.groupName || '',
    position: input.position,
    waiver_completed: input.waiverCompleted,
  })
  if (error) throw new Error(error.message)
  invalidateCaches(openGymId)
}

export async function joinWaitlist(openGymId: string, input: WaitlistInput): Promise<void> {
  const { error } = await supabase.from('waitlist').insert({
    open_gym_id: openGymId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone_number: input.phoneNumber || '',
    group_name: input.groupName || '',
    waiver_completed: input.waiverCompleted,
  })
  if (error) throw new Error(error.message)
  invalidateCaches(openGymId)
}
