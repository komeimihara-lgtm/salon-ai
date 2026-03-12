import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/**
 * 期限切れ回数券のチェック・失効処理
 * - expiry_date < 今日 かつ remaining_sessions > 0 の回数券を失効
 * - ticket_expirations に履歴を記録
 * - customer_tickets の remaining_sessions を 0 に更新
 */
export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()
    const today = new Date().toISOString().slice(0, 10)

    const { data: expiredTickets, error: fetchErr } = await supabase
      .from('customer_tickets')
      .select('id, salon_id, customer_id, plan_name, remaining_sessions, unit_price, expiry_date')
      .eq('salon_id', salonId)
      .lt('expiry_date', today)
      .gt('remaining_sessions', 0)

    if (fetchErr) {
      console.error('check-expiry fetch error:', fetchErr)
      return NextResponse.json({ error: '期限切れチェックに失敗しました', details: fetchErr.message }, { status: 500 })
    }

    if (!expiredTickets || expiredTickets.length === 0) {
      return NextResponse.json({ processed: 0, message: '期限切れの回数券はありません' })
    }

    for (const t of expiredTickets) {
      const remaining = Number(t.remaining_sessions ?? 0)
      const unitPrice = Number(t.unit_price ?? 0)
      const totalAmount = remaining * unitPrice
      const expiryDate = t.expiry_date
        ? (typeof t.expiry_date === 'string' ? t.expiry_date.slice(0, 10) : String(t.expiry_date).slice(0, 10))
        : today

      const { error: insertErr } = await supabase.from('ticket_expirations').insert({
        salon_id: t.salon_id,
        customer_id: t.customer_id,
        customer_ticket_id: t.id,
        plan_name: t.plan_name,
        expired_sessions: remaining,
        unit_price: unitPrice,
        total_amount: totalAmount,
        expiry_date: expiryDate,
        memo: '有効期限切れによる失効',
      })

      if (insertErr) {
        console.error('ticket_expirations insert error:', insertErr)
        continue
      }

      const { error: updateErr } = await supabase
        .from('customer_tickets')
        .update({ remaining_sessions: 0 })
        .eq('id', t.id)

      if (updateErr) {
        console.error('customer_tickets update error:', updateErr)
      }
    }

    return NextResponse.json({
      processed: expiredTickets.length,
      message: `${expiredTickets.length}件の回数券を期限切れとして処理しました`,
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('check-expiry error:', err.message)
    return NextResponse.json({ error: '期限切れチェックに失敗しました', details: err.message }, { status: 500 })
  }
}
