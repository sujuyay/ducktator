// Data-access layer for open gyms, backed by the Google Apps Script Web App
// defined in scripts/apps-script.gs. That script reads/writes a Google Drive
// folder of Sheets (one sheet per open gym, named after its date, with
// "Details", "Signups", and "Waitlist" tabs) and is deployed separately from
// this site - see scripts/apps-script.gs's header comment for deploy steps.

export type Position = 'Setter' | 'Middle' | 'Outside' | 'Opposite' | 'Flex'

export const POSITIONS: Position[] = ['Setter', 'Middle', 'Outside', 'Opposite', 'Flex']

export interface PositionSlots {
  position: Position
  available: number
  filled: number
}

export interface OpenGymSummary {
  date: string // sheet title, e.g. "2026-08-15"
  start: string
  end: string
  location: string
  price: string
  spotsFilled: number
  spotsAvailable: number
  waitlistCount: number
}

export interface Signup {
  timestamp: string // ISO 8601
  firstName: string
  lastName: string
  phoneNumber: string
  groupName: string
  team: string // '' until assigned manually
  position: Position
  waiverCompleted: boolean
  paid: boolean
}

export interface WaitlistEntry {
  timestamp: string // ISO 8601
  firstName: string
  lastName: string
  phoneNumber: string
  groupName: string
  waiverCompleted: boolean
}

export interface OpenGymDetail extends OpenGymSummary {
  positions: PositionSlots[]
  groupNames: string[]
  signups: Signup[] // paid only, sorted most recent first
  waitlist: WaitlistEntry[] // sorted by join order, earliest first
}

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

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

function requireUrl(): string {
  if (!APPS_SCRIPT_URL) {
    throw new Error(
      'VITE_APPS_SCRIPT_URL is not set. Deploy scripts/apps-script.gs as a Web App and set the URL in .env.local.',
    )
  }
  return APPS_SCRIPT_URL
}

interface ErrorResponse {
  error: string
}

const isErrorResponse = (data: unknown): data is ErrorResponse =>
  typeof data === 'object' && data !== null && typeof (data as ErrorResponse).error === 'string'

async function get<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(requireUrl())
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetch(url.toString())
  const data = await response.json()
  if (isErrorResponse(data)) throw new Error(data.error)
  return data as T
}

// Sent as text/plain (not application/json) so the browser doesn't preflight
// the request with an OPTIONS call - Apps Script Web Apps don't implement
// doOptions, so a preflighted request would fail outright. doPost still
// parses the body as JSON regardless of the declared content type.
async function post<T>(body: unknown): Promise<T> {
  const response = await fetch(requireUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (isErrorResponse(data)) throw new Error(data.error)
  return data as T
}

// Open gym dates/times are always in US Eastern time (observing DST, i.e.
// EST/EDT as a wall clock in America/New_York would show).
const EASTERN_TZ = 'America/New_York'

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUTC - date.getTime()
}

function parseEasternDateTime(date: string, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  let hh = '00'
  let minutes = '00'
  if (match) {
    let hours = Number(match[1]) % 12
    if (match[3].toUpperCase() === 'PM') hours += 12
    hh = String(hours).padStart(2, '0')
    minutes = match[2]
  }

  // Interpret the wall-clock date/time as if it were UTC, then shift by
  // America/New_York's actual offset (EST or EDT) at that moment.
  const naiveUtc = new Date(`${date}T${hh}:${minutes}:00Z`)
  return new Date(naiveUtc.getTime() - tzOffsetMs(naiveUtc, EASTERN_TZ))
}

// An open gym is "in the future" (and available to sign up for) until it ends.
export const isOpenGymPast = (date: string, end: string) => parseEasternDateTime(date, end).getTime() <= Date.now()

// Module-level cache, shared by every page for the lifetime of the SPA (this
// module is only ever loaded once, so navigating between routes doesn't
// re-import it). Caches in-flight promises, not just resolved values, so
// concurrent callers (e.g. React StrictMode's double effect) share one
// request instead of firing two.
let openGymsCache: Promise<OpenGymSummary[]> | null = null
let pastOpenGymsCache: Promise<OpenGymSummary[]> | null = null
const openGymDetailCache = new Map<string, Promise<OpenGymDetail | undefined>>()

function invalidateCaches(date: string) {
  openGymsCache = null
  pastOpenGymsCache = null
  openGymDetailCache.delete(date)
}

export async function listOpenGyms(): Promise<OpenGymSummary[]> {
  openGymsCache ??= get<OpenGymSummary[]>({ action: 'list' })
  return openGymsCache
}

export async function listPastOpenGyms(): Promise<OpenGymSummary[]> {
  pastOpenGymsCache ??= get<OpenGymSummary[]>({ action: 'list-past' })
  return pastOpenGymsCache
}

export async function getOpenGym(date: string): Promise<OpenGymDetail | undefined> {
  let cached = openGymDetailCache.get(date)
  if (!cached) {
    cached = get<OpenGymDetail>({ action: 'get', date }).catch((err: unknown) => {
      if (err instanceof Error && err.message === 'Not found') return undefined
      throw err
    })
    openGymDetailCache.set(date, cached)
  }
  return cached
}

export async function createSignup(date: string, input: SignupInput): Promise<Signup> {
  const signup = await post<Signup>({ date, ...input })
  invalidateCaches(date)
  return signup
}

export async function joinWaitlist(date: string, input: WaitlistInput): Promise<WaitlistEntry> {
  const entry = await post<WaitlistEntry>({ date, type: 'waitlist', ...input })
  invalidateCaches(date)
  return entry
}
