// Admin-only auth and mutations. Everything here requires a signed-in
// Supabase user - the database's row level security policies only grant
// insert/update/delete on these tables to the `authenticated` role, so an
// unauthenticated caller gets rejected by Postgres regardless of what the UI
// allows. Public signup is disabled in the Supabase dashboard, so the only
// accounts that exist are ones created there by hand.

import type { Session } from '@supabase/supabase-js'
import { easternDate, invalidateCaches } from './openGyms'
import type { AdminWaitlistEntry, Position, Signup } from './openGyms'
import { supabase } from './supabaseClient'

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
  invalidateCaches()
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export interface PositionSlotInput {
  position: Position
  available: number
}

export interface OpenGymInput {
  startTime: string // ISO instant
  endTime: string // ISO instant
  location: string
  price: string
  slots: PositionSlotInput[]
}

// Slots live in their own table, so saving a gym means replacing its slot
// rows wholesale. Positions are free-text, so matching up which rows to keep
// would mean embedding names in a filter expression; deleting and re-inserting
// sidesteps that and can't be tripped up by a name containing a comma or
// quote. Signups reference positions by name rather than by foreign key, so
// they're unaffected by the churn.
async function writeSlots(openGymId: string, slots: PositionSlotInput[]): Promise<void> {
  const { error: deleteError } = await supabase.from('position_slots').delete().eq('open_gym_id', openGymId)
  if (deleteError) throw new Error(deleteError.message)

  const { error: insertError } = await supabase
    .from('position_slots')
    .insert(slots.map((s) => ({ open_gym_id: openGymId, position: s.position, available: s.available })))
  if (insertError) throw new Error(insertError.message)
}

export async function createOpenGym(input: OpenGymInput): Promise<string> {
  const { data, error } = await supabase
    .from('open_gyms')
    .insert({
      date: easternDate(input.startTime),
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      price: input.price,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await writeSlots(data.id, input.slots)
  invalidateCaches(data.id)
  return data.id
}

export async function updateOpenGym(id: string, input: OpenGymInput): Promise<void> {
  const { error } = await supabase
    .from('open_gyms')
    .update({
      date: easternDate(input.startTime),
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      price: input.price,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await writeSlots(id, input.slots)
  invalidateCaches(id)
}

// Cascades to position_slots, signups, and waitlist via their foreign keys.
export async function deleteOpenGym(id: string): Promise<void> {
  const { error } = await supabase.from('open_gyms').delete().eq('id', id)
  if (error) throw new Error(error.message)
  invalidateCaches(id)
}

export async function updateSignup(
  openGymId: string,
  signupId: string,
  changes: Partial<Pick<Signup, 'paid' | 'team' | 'position'>>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (changes.paid !== undefined) patch.paid = changes.paid
  if (changes.team !== undefined) patch.team = changes.team
  if (changes.position !== undefined) patch.position = changes.position

  const { error } = await supabase.from('signups').update(patch).eq('id', signupId)
  if (error) throw new Error(error.message)
  invalidateCaches(openGymId)
}

export async function deleteSignup(openGymId: string, signupId: string): Promise<void> {
  const { error } = await supabase.from('signups').delete().eq('id', signupId)
  if (error) throw new Error(error.message)
  invalidateCaches(openGymId)
}

export async function deleteWaitlistEntry(openGymId: string, entryId: string): Promise<void> {
  const { error } = await supabase.from('waitlist').delete().eq('id', entryId)
  if (error) throw new Error(error.message)
  invalidateCaches(openGymId)
}

// Moves a waitlist entry into signups at the given position. The signup keeps
// the entry's original created_at so it still sorts by when they actually
// joined, and starts unpaid - being promoted grants a spot, not payment.
export async function promoteWaitlistEntry(
  openGymId: string,
  entry: AdminWaitlistEntry,
  position: Position,
): Promise<void> {
  const { error: insertError } = await supabase.from('signups').insert({
    open_gym_id: openGymId,
    created_at: entry.timestamp,
    first_name: entry.firstName,
    last_name: entry.lastName,
    phone_number: entry.phoneNumber,
    group_name: entry.groupName,
    position,
    waiver_completed: entry.waiverCompleted,
    paid: false,
  })
  if (insertError) throw new Error(insertError.message)

  const { error: deleteError } = await supabase.from('waitlist').delete().eq('id', entry.id)
  if (deleteError) throw new Error(deleteError.message)
  invalidateCaches(openGymId)
}
