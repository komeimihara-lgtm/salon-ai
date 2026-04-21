import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { requireSalonOwner } from '@/lib/attendance-api-helpers'

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}

export async function GET(req: NextRequest) {
  const gate = await requireSalonOwner()
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(req.url)
  const y = parseInt(searchParams.get('year') || '', 10)
  const m = parseInt(searchParams.get('month') || '', 10)
  const staffFilter = searchParams.get('staff_id')

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: 'year と month（1-12）を指定してください' }, { status: 400 })
  }

  const { start, end } = monthRange(y, m)
  const admin = getSupabaseAdmin()

  let q = admin
    .from('attendance_records')
    .select('*, staff(id, name)')
    .eq('salon_id', gate.salonId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })

  if (staffFilter) {
    q = q.eq('staff_id', staffFilter)
  }

  const { data: records, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    staff_id: string
    actual_work_minutes: number | null
    is_late: boolean
    is_early_leave: boolean
    clock_in: string | null
    staff?: { id: string; name: string } | { id: string; name: string }[] | null
  }

  const byStaffMap = new Map<
    string,
    { staff_id: string; staff_name: string; work_days: number; total_minutes: number; late_count: number; early_leave_count: number }
  >()

  for (const raw of records || []) {
    const row = raw as Row
    const staffRel = row.staff
    const name =
      Array.isArray(staffRel) ? staffRel[0]?.name : (staffRel as { name?: string } | null)?.name
    const staffName = name || '（不明）'
    let agg = byStaffMap.get(row.staff_id)
    if (!agg) {
      agg = {
        staff_id: row.staff_id,
        staff_name: staffName,
        work_days: 0,
        total_minutes: 0,
        late_count: 0,
        early_leave_count: 0,
      }
      byStaffMap.set(row.staff_id, agg)
    }
    if (row.clock_in) {
      agg.work_days += 1
      agg.total_minutes += Number(row.actual_work_minutes ?? 0)
    }
    if (row.is_late) agg.late_count += 1
    if (row.is_early_leave) agg.early_leave_count += 1
  }

  return NextResponse.json({
    range: { start, end },
    records: records || [],
    byStaff: Array.from(byStaffMap.values()).sort((a, b) => a.staff_name.localeCompare(b.staff_name, 'ja')),
  })
}
