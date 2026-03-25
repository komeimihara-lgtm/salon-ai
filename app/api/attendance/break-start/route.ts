import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayJstYmd } from '@/lib/attendance-utils'
import { requireSalonAndStaffFromPost } from '@/lib/attendance-api-helpers'

export async function POST(req: NextRequest) {
  const gate = await requireSalonAndStaffFromPost(req)
  if (!gate.ok) return gate.response

  const { staffId } = gate
  const date = todayJstYmd()
  const admin = getSupabaseAdmin()

  const { data: row } = await admin
    .from('attendance_records')
    .select('id, clock_in, clock_out, break_start, break_end')
    .eq('staff_id', staffId)
    .eq('date', date)
    .maybeSingle()

  if (!row?.clock_in) {
    return NextResponse.json({ error: '先に出勤打刻してください' }, { status: 400 })
  }
  if (row.clock_out) {
    return NextResponse.json({ error: '退勤済みのため休憩を開始できません' }, { status: 400 })
  }
  if (row.break_start && !row.break_end) {
    return NextResponse.json({ error: '既に休憩中です' }, { status: 400 })
  }
  if (row.break_start && row.break_end) {
    return NextResponse.json(
      { error: '本日の休憩は既に終了しています（労働時間計算のため1日1休憩のみ対応）' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  if (!row.id) {
    return NextResponse.json({ error: '勤怠レコードがありません' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('attendance_records')
    .update({ break_start: now, break_end: null })
    .eq('id', row.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
