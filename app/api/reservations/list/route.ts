import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') // YYYY-MM-DD
    const week = searchParams.get('week') // YYYY-MM-DD (週の開始日)
    const startParam = searchParams.get('start') // YYYY-MM-DD
    const endParam = searchParams.get('end') // YYYY-MM-DD
    const status = searchParams.get('status')

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('reservations')
      .select('*, customers(memo)')
      .eq('salon_id', DEMO_SALON_ID)
      .order('reservation_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (date) {
      query = query.eq('reservation_date', date)
    } else if (startParam && endParam) {
      query = query.gte('reservation_date', startParam).lte('reservation_date', endParam)
    } else if (week) {
      const weekStart = week
      const weekEnd = new Date(week)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const endStr = weekEnd.toISOString().split('T')[0]
      query = query.gte('reservation_date', weekStart).lte('reservation_date', endStr)
    }

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ reservations: data })
  } catch (error) {
    console.error('予約一覧取得エラー:', error)
    return NextResponse.json({ error: '予約データの取得に失敗しました' }, { status: 500 })
  }
}
