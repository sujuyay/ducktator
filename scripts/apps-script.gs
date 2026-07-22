/**
 * Deploy as a Google Apps Script Web App (Extensions > Apps Script, from a
 * throwaway Sheet or standalone script bound to the Drive account that owns
 * the open gyms folder). Deploy > New deployment > type "Web app",
 * execute as "Me", access "Anyone". Set the resulting URL as
 * VITE_APPS_SCRIPT_URL and point src/api/openGyms.ts at it instead of the
 * mock data.
 *
 * Folder layout: one Google Sheet per open gym, named with its date
 * (e.g. "2026-08-15"), inside FOLDER_ID. Each sheet has three tabs:
 *   Details: header row + one data row with
 *     Start | End | Location | Price | Setter | Middle | Outside | Opposite | Flex
 *   Signups: header row + one row per signup with
 *     Timestamp | First Name | Last Name | Phone Number | Group Name | Team | Position | Waiver Completed | Paid
 *   Waitlist: header row + one row per waitlist entry with
 *     Timestamp | First Name | Last Name | Phone Number | Group Name | Waiver Completed
 *   (Signups' Team is filled in manually after the fact - blank until then.)
 *
 * Endpoints (all JSON):
 *   GET  ?action=list                -> OpenGymSummary[]
 *   GET  ?action=list-past            -> OpenGymSummary[] (ended within the last month)
 *   GET  ?action=get&date=YYYY-MM-DD -> OpenGymDetail
 *   POST { date, firstName, lastName, phoneNumber, groupName, position, waiverCompleted } -> Signup
 *   POST { date, type: 'waitlist', firstName, lastName, phoneNumber, groupName, waiverCompleted } -> WaitlistEntry
 */

const FOLDER_ID = 'REPLACE_WITH_DRIVE_FOLDER_ID'
const POSITIONS = ['Setter', 'Middle', 'Outside', 'Opposite', 'Flex']

function doGet(e) {
  const action = e.parameter.action
  if (action === 'list') return respond(listOpenGyms())
  if (action === 'list-past') return respond(listPastOpenGyms())
  if (action === 'get') return respond(getOpenGym(e.parameter.date))
  return respond({ error: 'Unknown action' }, 400)
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  if (body.type === 'waitlist') return respond(addWaitlistEntry(body.date, body))
  return respond(addSignup(body.date, body))
}

function respond(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
  output.setMimeType(ContentService.MimeType.JSON)
  return output
}

function openGymSheets() {
  const folder = DriveApp.getFolderById(FOLDER_ID)
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS)
  const sheets = []
  while (files.hasNext()) sheets.push(SpreadsheetApp.open(files.next()))
  return sheets
}

function readDetails(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Details')
  const [, row] = sheet.getDataRange().getValues()
  const [start, end, location, price, setter, middle, outside, opposite, flex] = row
  return {
    start,
    end,
    location,
    price: String(price),
    slots: { Setter: setter, Middle: middle, Outside: outside, Opposite: opposite, Flex: flex },
  }
}

function readSignups(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Signups')
  const [, ...rows] = sheet.getDataRange().getValues()
  return rows
    .filter((r) => r[1])
    .map(([timestamp, firstName, lastName, phoneNumber, groupName, team, position, waiverCompleted, paid]) => ({
      timestamp: new Date(timestamp).toISOString(),
      firstName,
      lastName,
      phoneNumber: phoneNumber || '',
      groupName: groupName || '',
      team: team || '',
      position,
      waiverCompleted: String(waiverCompleted).toUpperCase() === 'Y',
      paid: String(paid).toUpperCase() === 'Y',
    }))
}

function readWaitlist(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Waitlist')
  const [, ...rows] = sheet.getDataRange().getValues()
  return rows
    .filter((r) => r[1])
    .map(([timestamp, firstName, lastName, phoneNumber, groupName, waiverCompleted]) => ({
      timestamp: new Date(timestamp).toISOString(),
      firstName,
      lastName,
      phoneNumber: phoneNumber || '',
      groupName: groupName || '',
      waiverCompleted: String(waiverCompleted).toUpperCase() === 'Y',
    }))
}

function summarize(date, details, signups, waitlistCount) {
  const spotsAvailable = POSITIONS.reduce((sum, p) => sum + details.slots[p], 0)
  const spotsFilled = signups.filter((s) => s.paid).length
  return { date, start: details.start, end: details.end, location: details.location, price: details.price, spotsFilled, spotsAvailable, waitlistCount }
}

function listOpenGyms() {
  return openGymSheets()
    .map((ss) => summarize(ss.getName(), readDetails(ss), readSignups(ss), readWaitlist(ss).length))
    .filter((summary) => !isPast(summary.date, summary.end))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

function listPastOpenGyms() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 1)

  return openGymSheets()
    .map((ss) => summarize(ss.getName(), readDetails(ss), readSignups(ss), readWaitlist(ss).length))
    .filter((summary) => isPast(summary.date, summary.end) && new Date(summary.date) >= cutoff)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

function getOpenGym(date) {
  const spreadsheet = openGymSheets().find((ss) => ss.getName() === date)
  if (!spreadsheet) return { error: 'Not found' }

  const details = readDetails(spreadsheet)
  const signups = readSignups(spreadsheet)
  const positions = POSITIONS.map((position) => ({
    position,
    available: details.slots[position],
    filled: signups.filter((s) => s.paid && s.position === position).length,
  }))
  const groupNames = [...new Set(signups.map((s) => s.groupName).filter(Boolean))].sort()
  const paidSignups = signups.filter((s) => s.paid).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const waitlist = readWaitlist(spreadsheet).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  return { ...summarize(date, details, signups, waitlist.length), positions, groupNames, signups: paidSignups, waitlist }
}

function addSignup(date, input) {
  const spreadsheet = openGymSheets().find((ss) => ss.getName() === date)
  if (!spreadsheet) return { error: 'Not found' }

  const sheet = spreadsheet.getSheetByName('Signups')
  sheet.appendRow([
    new Date(),
    input.firstName,
    input.lastName,
    input.phoneNumber || '',
    input.groupName || '',
    '', // Team - filled in manually later
    input.position,
    input.waiverCompleted ? 'Y' : 'N',
    'N',
  ])
  return { ok: true }
}

function addWaitlistEntry(date, input) {
  const spreadsheet = openGymSheets().find((ss) => ss.getName() === date)
  if (!spreadsheet) return { error: 'Not found' }

  const sheet = spreadsheet.getSheetByName('Waitlist')
  sheet.appendRow([
    new Date(),
    input.firstName,
    input.lastName,
    input.phoneNumber || '',
    input.groupName || '',
    input.waiverCompleted ? 'Y' : 'N',
  ])
  return { ok: true }
}

// Mirrors src/api/openGyms.ts's isOpenGymPast - dates/times are Eastern.
// Set this script's project timezone (Project Settings) to America/New_York
// so `new Date(...)` below parses the sheet's date/time as Eastern wall time.
function isPast(date, end) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(end).trim())
  let hours = match ? Number(match[1]) % 12 : 0
  if (match && match[3].toUpperCase() === 'PM') hours += 12
  const minutes = match ? Number(match[2]) : 0
  const endInstant = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  return endInstant.getTime() <= Date.now()
}
