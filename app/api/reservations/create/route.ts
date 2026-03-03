import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.customer_name || !body.reservation_date || !body.start_time) {
      return NextResponse.json({ error: '顧客名・日付・時間は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone || null,
        reservation_date: body.reservation_date,
        start_time: body.start_time,
        end_time: body.end_time || null,
        menu: body.menu || null,
        staff_name: body.staff_name || null,
        price: body.price || 0,
        status: 'confirmed',
        memo: body.memo || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('予約作成エラー:', error)
    return NextResponse.json({ error: '予約の登録に失敗しました' }, { status: 500 })
  }
}
