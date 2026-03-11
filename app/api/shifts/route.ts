import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM
    const date = searchParams.get('date')   // YYYY-MM-DD (今日のシフト用)

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('shifts')
      .select('id, staff_id, date, start_time, end_time')
      .eq('salon_id', salonId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (month) {
      const start = `${month}-01`
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const end = `${month}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('date', start).lte('date', end)
    } else if (date) {
      query = query.eq('date', date)
    }

    const { data: shiftData, error } = await query
    if (error) throw error

    const staffIds = Array.from(new Set((shiftData || []).map((s: { staff_id: string }) => s.staff_id)))
    const staffMap: Record<string, { name: string; color: string }> = {}
    if (staffIds.length > 0) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, color')
        .in('id', staffIds)
      for (const s of staffData || []) {
        staffMap[s.id] = { name: s.name, color: s.color || '#C4728A' }
      }
    }

    const shifts = (shiftData || []).map((s: { id: string; staff_id: string; date: string; start_time: string; end_time: string }) => {
      const staff = staffMap[s.staff_id]
      return {
        id: s.id,
        staffId: s.staff_id,
        staffName: staff?.name ?? '',
        staffColor: staff?.color ?? '#C4728A',
        date: s.date,
        start: s.start_time?.slice(0, 5) ?? '09:00',
        end: s.end_time?.slice(0, 5) ?? '18:00',
      }
    })

    return NextResponse.json({ shifts })
  } catch (e) {
    console.error('シフト取得エラー:', e)
    return NextResponse.json({ error: 'シフトの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shifts } = body as { shifts: Array<{ staff_id: string; date: string; start_time: string; end_time: string }> }
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ error: 'シフトデータが必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    for (const s of shifts) {
      const { staff_id, date, start_time, end_time } = s
      if (!staff_id || !date || !start_time || !end_time) continue

      await supabase.from('shifts').upsert(
        {
          salon_id: salonId,
          staff_id,
          date,
          start_time: start_time.length === 5 ? start_time : start_time.slice(0, 5),
          end_time: end_time.length === 5 ? end_time : end_time.slice(0, 5),
        },
        { onConflict: 'staff_id,date' }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('シフト保存エラー:', e)
    return NextResponse.json({ error: 'シフトの保存に失敗しました' }, { status: 500 })
  }
}
