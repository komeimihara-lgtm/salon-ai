import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayJstYmd, isLateClockIn } from '@/lib/attendance-utils'
import { fetchShift, requirePunchContext } from '@/lib/attendance-api-helpers'

export async function POST() {
  const gate = await requirePunchContext()
  if (!gate.ok) return gate.response

  const { salonId, staffId } = gate.ctx
  const date = todayJstYmd()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from('attendance_records')
    .select('id, clock_in')
    .eq('staff_id', staffId)
    .eq('date', date)
    .maybeSingle()

  if (existing?.clock_in) {
    return NextResponse.json({ error: '本日は既に出勤打刻済みです' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const shift = await fetchShift(salonId, staffId, date)
  const isLate = isLateClockIn(now, shift?.start_time ?? null)

  if (existing?.id) {
    const { data, error } = await admin
      .from('attendance_records')
      .update({ clock_in: now, is_late: isLate })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ record: data })
  }

  const { data, error } = await admin
    .from('attendance_records')
    .insert({
      salon_id: salonId,
      staff_id: staffId,
      date,
      clock_in: now,
      is_late: isLate,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
