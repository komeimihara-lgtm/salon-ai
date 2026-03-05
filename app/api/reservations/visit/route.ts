import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

/** 来店処理: ステータスを visited に変更、回数券があれば消化、sales に計上 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .single()

    if (fetchErr || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    const customerId = reservation.customer_id ?? ''
    const customerName = reservation.customer_name ?? ''
    const menu = reservation.menu ?? ''
    const price = Number(reservation.price ?? 0)
    const reservationDate = reservation.reservation_date

    // 回数券を検索（customer_tickets）
    const { data: tickets } = await supabase
      .from('customer_tickets')
      .select('id, customer_id, menu_name, remaining_sessions, unit_price, ticket_plan_id, customers(name)')
      .eq('salon_id', DEMO_SALON_ID)
      .gt('remaining_sessions', 0)

    const matchingTicket = (tickets || []).find((t: Record<string, unknown>) => {
      const cust = t.customers as { name?: string } | { name?: string }[] | null | undefined
      const tName = Array.isArray(cust) ? cust[0]?.name : cust?.name
      return (t.customer_id === customerId || (tName && tName === customerName)) &&
        (t.menu_name === menu || !menu)
    })

    if (matchingTicket) {
      const newRemaining = Number(matchingTicket.remaining_sessions ?? 0) - 1
      let unitPrice = matchingTicket.unit_price != null ? Number(matchingTicket.unit_price) : null
      if (unitPrice == null && matchingTicket.ticket_plan_id) {
        const { data: plan } = await supabase
          .from('ticket_plans')
          .select('price, total_sessions')
          .eq('id', matchingTicket.ticket_plan_id)
          .single()
        if (plan && plan.total_sessions > 0) {
          unitPrice = Math.round(Number(plan.price) / Number(plan.total_sessions))
        }
      }
      if (unitPrice == null) unitPrice = 0

      await supabase.from('customer_tickets').update({ remaining_sessions: newRemaining }).eq('id', matchingTicket.id)

      await supabase.from('sales').insert({
        salon_id: DEMO_SALON_ID,
        sale_date: reservationDate,
        amount: unitPrice,
        customer_id: customerId || null,
        customer_name: customerName,
        sale_type: 'ticket_consume',
        ticket_id: matchingTicket.id,
        memo: `予約来店: ${menu || '施術'}（残${newRemaining}回）`,
      })
    } else {
      // 都度払い: 消化売上を計上
      const amount = price > 0 ? price : 0
      if (amount > 0) {
        await supabase.from('sales').insert({
          salon_id: DEMO_SALON_ID,
          sale_date: reservationDate,
          amount,
          customer_id: customerId || null,
          customer_name: customerName,
          menu: menu || null,
          staff_name: reservation.staff_name || null,
          sale_type: 'cash',
          memo: `予約来店: ${menu || '施術'}`,
        })
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reservations')
      .update({ status: 'visited', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw updateErr
    return NextResponse.json({ reservation: updated })
  } catch (e) {
    console.error('来店処理エラー:', e)
    return NextResponse.json({ error: '来店処理に失敗しました' }, { status: 500 })
  }
}
