import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.customer_name || !body.reservation_date || !body.start_time) {
      return NextResponse.json({ error: '顧客名・日付・時間は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const durationMin = body.duration_minutes ?? 60
    const [sh = 10, sm = 0] = (body.start_time || '10:00').slice(0, 5).split(':').map(Number)
    const endMin = sh * 60 + sm + durationMin
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const computedEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone || null,
        reservation_date: body.reservation_date,
        start_time: body.start_time,
        end_time: body.end_time || computedEndTime,
        menu: body.menu || null,
        staff_name: body.staff_name || null,
        price: body.price || 0,
        status: 'confirmed',
        memo: body.memo || null,
        bed_id: body.bed_id || null,
        duration_minutes: durationMin,
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
