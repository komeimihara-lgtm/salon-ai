/** JST の今日を YYYY-MM-DD */
export function todayJstYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/** ISO を JST で「分」に（0〜1439） */
export function isoToJstMinutes(iso: string): number {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

/** HH:MM または HH:MM:SS を分に */
export function timeStrToMinutes(t: string): number {
  const [h, m] = (t || '00:00').slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function computeActualWorkMinutes(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
  breakStart: string | null | undefined,
  breakEnd: string | null | undefined
): number | null {
  if (!clockIn || !clockOut) return null
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  let breakMs = 0
  if (breakStart && breakEnd) {
    breakMs = Math.max(0, new Date(breakEnd).getTime() - new Date(breakStart).getTime())
  }
  return Math.max(0, Math.round((ms - breakMs) / 60000))
}

export function isLateClockIn(clockInIso: string, shiftStartTime: string | null | undefined): boolean {
  if (!shiftStartTime) return false
  return isoToJstMinutes(clockInIso) > timeStrToMinutes(shiftStartTime)
}

export function isEarlyClockOut(clockOutIso: string, shiftEndTime: string | null | undefined): boolean {
  if (!shiftEndTime) return false
  return isoToJstMinutes(clockOutIso) < timeStrToMinutes(shiftEndTime)
}

export type AttendanceStatus = 'not_started' | 'working' | 'on_break' | 'finished'

export function deriveAttendanceStatus(row: {
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
} | null): AttendanceStatus {
  if (!row?.clock_in) return 'not_started'
  if (row.clock_out) return 'finished'
  if (row.break_start && !row.break_end) return 'on_break'
  return 'working'
}
