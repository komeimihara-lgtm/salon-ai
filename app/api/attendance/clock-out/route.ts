import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  todayJstYmd,
  computeActualWorkMinutes,
  isEarlyClockOut,
} from '@/lib/attendance-utils'
import { fetchShift, requirePunchContext } from '@/lib/attendance-api-helpers'

export async function POST() {
  const gate = await requirePunchContext()
  if (!gate.ok) return gate.response

  const { salonId, staffId } = gate.ctx
  const date = todayJstYmd()
  const admin = getSupabaseAdmin()

  const { data: row } = await admin
    .from('attendance_records')
    .select('*')
    .eq('staff_id', staffId)
    .eq('date', date)
    .maybeSingle()

  if (!row?.clock_in) {
    return NextResponse.json({ error: '出勤打刻がありません' }, { status: 400 })
  }
  if (row.clock_out) {
    return NextResponse.json({ error: '本日は既に退勤打刻済みです' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let breakEnd = row.break_end as string | null
  if (row.break_start && !breakEnd) {
    breakEnd = now
  }

  const shift = await fetchShift(salonId, staffId, date)
  const isEarlyLeave = isEarlyClockOut(now, shift?.end_time ?? null)
  const actualWorkMinutes = computeActualWorkMinutes(
    row.clock_in as string,
    now,
    row.break_start as string | null,
    breakEnd
  )

  const { data, error } = await admin
    .from('attendance_records')
    .update({
      clock_out: now,
      break_end: breakEnd,
      is_early_leave: isEarlyLeave,
      actual_work_minutes: actualWorkMinutes,
    })
    .eq('id', row.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
