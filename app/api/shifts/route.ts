import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM
  const date = searchParams.get('date')   // YYYY-MM-DD

  let query = supabase
    .from('shifts')
    .select('*, staff(id, name, color)')
    .eq('salon_id', salonId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (date) {
    query = query.eq('date', date)
  } else if (month) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    query = query.gte('date', `${month}-01`).lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shifts: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()

  // 一括保存
  if (Array.isArray(body.shifts) && body.shifts.length > 0) {
    for (const s of body.shifts) {
      const { staff_id, date, start_time, end_time } = s
      if (!staff_id || !date || !start_time || !end_time) continue
      await supabase.from('shifts').upsert(
        { salon_id: salonId, staff_id, date, start_time: String(start_time).slice(0, 5), end_time: String(end_time).slice(0, 5) },
        { onConflict: 'staff_id,date' }
      )
    }
    return NextResponse.json({ success: true })
  }

  // 単体保存
  const { staff_id, date, start_time, end_time } = body
  const { data, error } = await supabase
    .from('shifts')
    .upsert({
      salon_id: salonId,
      staff_id,
      date,
      start_time,
      end_time,
    }, { onConflict: 'staff_id,date' })
    .select('*, staff(id, name, color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { staff_id, date } = await req.json()
  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('staff_id', staff_id)
    .eq('date', date)
    .eq('salon_id', salonId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
