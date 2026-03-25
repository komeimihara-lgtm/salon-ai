import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayJstYmd, deriveAttendanceStatus } from '@/lib/attendance-utils'
import {
  fetchShift,
  requireSalonIdFromCookie,
  resolveStaffForAttendance,
} from '@/lib/attendance-api-helpers'

export async function GET(req: NextRequest) {
  const salon = await requireSalonIdFromCookie()
  if (!salon.ok) return salon.response

  const staffIdParam = new URL(req.url).searchParams.get('staff_id')
  const staff = await resolveStaffForAttendance(salon.salonId, staffIdParam)
  if (!staff.ok) return staff.response

  const { staffId, staffName } = staff
  const salonId = salon.salonId
  const date = todayJstYmd()
  const admin = getSupabaseAdmin()

  const [{ data: record }, shift] = await Promise.all([
    admin.from('attendance_records').select('*').eq('staff_id', staffId).eq('date', date).maybeSingle(),
    fetchShift(salonId, staffId, date),
  ])

  const status = deriveAttendanceStatus(record)

  const history: { label: string; at: string }[] = []
  const r = record as Record<string, string | null> | null
  if (r?.clock_in) history.push({ label: '出勤', at: r.clock_in })
  if (r?.break_start) history.push({ label: '休憩開始', at: r.break_start })
  if (r?.break_end) history.push({ label: '休憩終了', at: r.break_end })
  if (r?.clock_out) history.push({ label: '退勤', at: r.clock_out })

  return NextResponse.json({
    date,
    staff_name: staffName,
    status,
    record: record || null,
    shift: shift ? { start_time: shift.start_time, end_time: shift.end_time } : null,
    history,
  })
}
