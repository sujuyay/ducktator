// Data-access layer for open gyms. Backed by an in-memory mock for now; the
// real "database" is a Google Drive folder of Sheets (one sheet per open gym,
// named after its date, with "Signups" and "Details" tabs - see
// scripts/apps-script.gs). Once that Apps Script Web App is deployed, swap the
// bodies of these functions for `fetch(APPS_SCRIPT_URL, ...)` calls - the
// signatures and shapes below are already modeled on what it will return.

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

interface MockOpenGym {
  date: string
  start: string
  end: string
  location: string
  price: string
  slots: Record<Position, number>
  signups: Signup[]
  waitlist: WaitlistEntry[]
}

const MOCK_OPEN_GYMS: MockOpenGym[] = [
  {
    date: '2026-08-01',
    start: '8:00 PM',
    end: '10:00 PM',
    location: 'Ducktator Sports Complex - Court 1',
    price: '$15',
    slots: { Setter: 2, Middle: 4, Outside: 4, Opposite: 2, Flex: 4 },
    signups: [
      {
        timestamp: '2026-07-20T14:32:00Z',
        firstName: 'Jamie',
        lastName: 'Lee',
        phoneNumber: '555-010-1234',
        groupName: 'The Spikers',
        team: 'Team A',
        position: 'Outside',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-19T09:10:00Z',
        firstName: 'Sam',
        lastName: 'Rivera',
        phoneNumber: '555-010-5678',
        groupName: 'The Spikers',
        team: 'Team A',
        position: 'Setter',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-18T20:05:00Z',
        firstName: 'Taylor',
        lastName: 'Kim',
        phoneNumber: '555-010-9012',
        groupName: '',
        team: 'Team B',
        position: 'Middle',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-17T20:05:00Z',
        firstName: 'Casey',
        lastName: 'Nguyen',
        phoneNumber: '555-010-3456',
        groupName: '',
        team: '',
        position: 'Flex',
        waiverCompleted: true,
        paid: false,
      },
    ],
    waitlist: [
      {
        timestamp: '2026-07-21T10:00:00Z',
        firstName: 'Drew',
        lastName: 'Nakamura',
        phoneNumber: '555-010-6543',
        groupName: '',
        waiverCompleted: true,
      },
    ],
  },
  {
    date: '2026-08-08',
    start: '8:00 PM',
    end: '10:00 PM',
    location: 'Ducktator Sports Complex - Court 1',
    price: '$15',
    slots: { Setter: 1, Middle: 1, Outside: 1, Opposite: 1, Flex: 1 },
    signups: [
      {
        timestamp: '2026-07-22T12:00:00Z',
        firstName: 'Alex',
        lastName: 'Torres',
        phoneNumber: '555-010-1111',
        groupName: '',
        team: '',
        position: 'Setter',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-22T12:05:00Z',
        firstName: 'Jordan',
        lastName: 'Blake',
        phoneNumber: '555-010-2222',
        groupName: '',
        team: '',
        position: 'Middle',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-22T12:10:00Z',
        firstName: 'Sydney',
        lastName: 'Park',
        phoneNumber: '555-010-3333',
        groupName: '',
        team: '',
        position: 'Outside',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-22T12:15:00Z',
        firstName: 'Cameron',
        lastName: 'Diaz',
        phoneNumber: '555-010-4444',
        groupName: '',
        team: '',
        position: 'Opposite',
        waiverCompleted: true,
        paid: true,
      },
      {
        timestamp: '2026-07-22T12:20:00Z',
        firstName: 'Reese',
        lastName: 'Nolan',
        phoneNumber: '555-010-5555',
        groupName: '',
        team: '',
        position: 'Flex',
        waiverCompleted: true,
        paid: true,
      },
    ],
    waitlist: [
      {
        timestamp: '2026-07-22T13:00:00Z',
        firstName: 'Harper',
        lastName: 'Quinn',
        phoneNumber: '555-010-6666',
        groupName: '',
        waiverCompleted: true,
      },
      {
        timestamp: '2026-07-22T13:30:00Z',
        firstName: 'Skyler',
        lastName: 'Reed',
        phoneNumber: '555-010-7777',
        groupName: '',
        waiverCompleted: true,
      },
    ],
  },
  {
    date: '2026-07-25',
    start: '7:00 PM',
    end: '9:00 PM',
    location: 'Ducktator Sports Complex - Court 2',
    price: '$10',
    slots: { Setter: 2, Middle: 4, Outside: 4, Opposite: 2, Flex: 4 },
    signups: [
      {
        timestamp: '2026-07-15T11:00:00Z',
        firstName: 'Morgan',
        lastName: 'Patel',
        phoneNumber: '555-010-7890',
        groupName: 'Net Gains',
        team: '',
        position: 'Middle',
        waiverCompleted: true,
        paid: true,
      },
    ],
    waitlist: [],
  },
  {
    date: '2026-07-10',
    start: '8:00 PM',
    end: '10:00 PM',
    location: 'Ducktator Sports Complex - Court 1',
    price: '$15',
    slots: { Setter: 2, Middle: 4, Outside: 4, Opposite: 2, Flex: 4 },
    signups: [
      {
        timestamp: '2026-07-01T18:00:00Z',
        firstName: 'Riley',
        lastName: 'Chen',
        phoneNumber: '555-010-2345',
        groupName: 'Net Gains',
        team: '',
        position: 'Opposite',
        waiverCompleted: true,
        paid: true,
      },
    ],
    waitlist: [],
  },
]

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

const isFuture = (gym: MockOpenGym) => !isOpenGymPast(gym.date, gym.end)

const isWithinPastMonth = (gym: MockOpenGym) => {
  const end = parseEasternDateTime(gym.date, gym.end).getTime()
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 1)
  return end <= Date.now() && end >= cutoff.getTime()
}

const paidFilled = (gym: MockOpenGym, position: Position) =>
  gym.signups.filter((s) => s.paid && s.position === position).length

const toSummary = (gym: MockOpenGym): OpenGymSummary => {
  const spotsAvailable = POSITIONS.reduce((sum, p) => sum + gym.slots[p], 0)
  const spotsFilled = POSITIONS.reduce((sum, p) => sum + paidFilled(gym, p), 0)
  return {
    date: gym.date,
    start: gym.start,
    end: gym.end,
    location: gym.location,
    price: gym.price,
    spotsFilled,
    spotsAvailable,
    waitlistCount: gym.waitlist.length,
  }
}

const toDetail = (gym: MockOpenGym): OpenGymDetail => {
  const positions: PositionSlots[] = POSITIONS.map((position) => ({
    position,
    available: gym.slots[position],
    filled: paidFilled(gym, position),
  }))

  const groupNames = [...new Set(gym.signups.map((s) => s.groupName).filter(Boolean))].sort()

  const signups = gym.signups
    .filter((s) => s.paid)
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const waitlist = gym.waitlist
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return { ...toSummary(gym), positions, groupNames, signups, waitlist }
}

export async function listOpenGyms(): Promise<OpenGymSummary[]> {
  return MOCK_OPEN_GYMS.filter(isFuture)
    .map(toSummary)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export async function listPastOpenGyms(): Promise<OpenGymSummary[]> {
  return MOCK_OPEN_GYMS.filter(isWithinPastMonth)
    .map(toSummary)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getOpenGym(date: string): Promise<OpenGymDetail | undefined> {
  const gym = MOCK_OPEN_GYMS.find((g) => g.date === date)
  return gym ? toDetail(gym) : undefined
}

export async function createSignup(date: string, input: SignupInput): Promise<Signup> {
  const gym = MOCK_OPEN_GYMS.find((g) => g.date === date)
  if (!gym) throw new Error(`Open gym ${date} not found`)

  const signup: Signup = {
    timestamp: new Date().toISOString(),
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    groupName: input.groupName,
    team: '',
    position: input.position,
    waiverCompleted: input.waiverCompleted,
    paid: false,
  }
  gym.signups.push(signup)
  return signup
}

export async function joinWaitlist(date: string, input: WaitlistInput): Promise<WaitlistEntry> {
  const gym = MOCK_OPEN_GYMS.find((g) => g.date === date)
  if (!gym) throw new Error(`Open gym ${date} not found`)

  const entry: WaitlistEntry = {
    timestamp: new Date().toISOString(),
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: input.phoneNumber,
    groupName: input.groupName,
    waiverCompleted: input.waiverCompleted,
  }
  gym.waitlist.push(entry)
  return entry
}
