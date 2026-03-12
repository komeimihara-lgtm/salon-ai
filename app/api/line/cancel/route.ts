import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'
import { recalcCustomerAfterCancel } from '@/lib/recalc-customer'

const salonId = getSalonIdFromCookie()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reservation_id, line_user_id } = body
    if (!reservation_id || !line_user_id) {
      return NextResponse.json({ error: 'reservation_id と line_user_id が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservation_id)
      .eq('salon_id', salonId)
      .single()

    if (fetchErr || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    await supabase
      .from('reservations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', reservation_id)

    const customerId = reservation.customer_id
    if (customerId) {
      await recalcCustomerAfterCancel(customerId)
    }

    const { data: salon } = await supabase
      .from('salons')
      .select('line_channel_access_token')
      .eq('id', salonId)
      .single()

    const accessToken = salon?.line_channel_access_token
    if (accessToken) {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to: line_user_id,
          messages: [{
            type: 'text',
            text: 'ご予約をキャンセルしました。\nまたのご来店をお待ちしております🌸',
          }],
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('LINE cancel error:', e)
    return NextResponse.json({ error: 'キャンセル処理に失敗しました' }, { status: 500 })
  }
}
