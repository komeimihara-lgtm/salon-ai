import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, memo, menu, start_time, end_time, staff_name, price, reservation_date } = body

    if (!id) {
      return NextResponse.json({ error: 'IDは必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (status !== undefined) updates.status = status
    if (memo !== undefined) updates.memo = memo
    if (menu !== undefined) updates.menu = menu
    if (reservation_date !== undefined) updates.reservation_date = reservation_date
    if (start_time !== undefined) updates.start_time = start_time.length === 5 ? start_time : `${start_time}:00`
    if (end_time !== undefined) updates.end_time = end_time ? (end_time.length === 5 ? end_time : `${end_time}:00`) : null
    if (staff_name !== undefined) updates.staff_name = staff_name
    if (price !== undefined) updates.price = Number(price) || 0

    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('予約更新エラー:', error)
    return NextResponse.json({ error: '予約の更新に失敗しました' }, { status: 500 })
  }
}
