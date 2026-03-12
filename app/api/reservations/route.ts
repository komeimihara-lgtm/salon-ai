import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const salonId = getSalonIdFromCookie()
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('reservations')
      .select('*')
      .eq('salon_id', salonId)
      .order('reservation_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (start && end) {
      query = query.gte('reservation_date', start).lte('reservation_date', end)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ reservations: data || [] })
  } catch (error) {
    console.error('予約一覧取得エラー:', error)
    return NextResponse.json({ error: '予約データの取得に失敗しました' }, { status: 500 })
  }
}
