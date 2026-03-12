import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/** 無断キャンセル: ステータスを no_show に変更、顧客の no_show_count を +1 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('customer_id')
      .eq('id', id)
      .eq('salon_id', getSalonIdFromCookie())
      .single()

    if (fetchErr || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    if (reservation.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('no_show_count')
        .eq('id', reservation.customer_id)
        .single()

      const current = Number(customer?.no_show_count ?? 0)
      await supabase
        .from('customers')
        .update({ no_show_count: current + 1, updated_at: new Date().toISOString() })
        .eq('id', reservation.customer_id)
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reservations')
      .update({ status: 'no_show', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw updateErr
    return NextResponse.json({ reservation: updated })
  } catch (e) {
    console.error('無断キャンセルエラー:', e)
    return NextResponse.json({ error: '無断キャンセル処理に失敗しました' }, { status: 500 })
  }
}
