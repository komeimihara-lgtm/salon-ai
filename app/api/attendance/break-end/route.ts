import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayJstYmd } from '@/lib/attendance-utils'
import { requirePunchContext } from '@/lib/attendance-api-helpers'

export async function POST() {
  const gate = await requirePunchContext()
  if (!gate.ok) return gate.response

  const { staffId } = gate.ctx
  const date = todayJstYmd()
  const admin = getSupabaseAdmin()

  const { data: row } = await admin
    .from('attendance_records')
    .select('id, break_start, break_end, clock_out')
    .eq('staff_id', staffId)
    .eq('date', date)
    .maybeSingle()

  if (!row?.break_start) {
    return NextResponse.json({ error: '休憩開始打刻がありません' }, { status: 400 })
  }
  if (row.break_end) {
    return NextResponse.json({ error: '既に休憩終了打刻済みです' }, { status: 400 })
  }
  if (row.clock_out) {
    return NextResponse.json({ error: '退勤済みです' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('attendance_records')
    .update({ break_end: now })
    .eq('id', row.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
