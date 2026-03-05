import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

/** リスケ: 日時を更新し、ステータスを rescheduled に変更 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, reservation_date, start_time, end_time } = body
    if (!id || !reservation_date || !start_time) {
      return NextResponse.json({ error: 'id, reservation_date, start_time が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('reservations')
      .update({
        reservation_date,
        start_time: start_time.length === 5 ? start_time : `${start_time}:00`,
        end_time: end_time ? (end_time.length === 5 ? end_time : `${end_time}:00`) : null,
        status: 'rescheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ reservation: data })
  } catch (e) {
    console.error('リスケエラー:', e)
    return NextResponse.json({ error: 'リスケに失敗しました' }, { status: 500 })
  }
}
