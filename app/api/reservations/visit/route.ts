import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/** 来店処理: ステータスを visited に変更。都度払いは来店時にsales計上。コースは予約作成時計上済みならスキップ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()

    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single()

    if (fetchErr || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
    }

    const customerId = reservation.customer_id ?? ''
    const customerName = reservation.customer_name ?? ''
    const menu = reservation.menu ?? ''
    const price = Number(reservation.price ?? 0)
    const reservationDate = reservation.reservation_date
    const isCourse = reservation.is_course === true
    const ticketId = reservation.ticket_id
    const subscriptionId = reservation.subscription_id
    /** 予約作成時に既に消化・sales計上済み（回数券・サブスク） */
    const alreadyConsumedAtBooking = reservation.course_consumed_at_booking === true

    if (alreadyConsumedAtBooking && (ticketId || subscriptionId)) {
      // --- 予約作成時に回数券/サブスク消化・sales 済み。来店では追加計上しない ---
    } else if (isCourse && ticketId) {
      // --- コース消化: 回数券（旧データ・フラグなし予約は来店時に消化） ---
      const { data: ticket } = await supabase
        .from('customer_tickets')
        .select('id, remaining_sessions, unit_price, ticket_plan_id, plan_name')
        .eq('id', ticketId)
        .single()

      if (ticket && ticket.remaining_sessions > 0) {
        const newRemaining = ticket.remaining_sessions - 1
        let unitPrice = ticket.unit_price != null ? Number(ticket.unit_price) : null
        if (unitPrice == null && ticket.ticket_plan_id) {
          const { data: plan } = await supabase
            .from('ticket_plans')
            .select('price, total_sessions')
            .eq('id', ticket.ticket_plan_id)
            .single()
          if (plan && plan.total_sessions > 0) {
            unitPrice = Math.round(Number(plan.price) / Number(plan.total_sessions))
          }
        }
        if (unitPrice == null) unitPrice = 0

        const ticketUpdate: Record<string, unknown> = { remaining_sessions: newRemaining }
        if (newRemaining === 0) ticketUpdate.status = 'expired'
        await supabase.from('customer_tickets').update(ticketUpdate).eq('id', ticketId)

        await supabase.from('sales').insert({
          salon_id: salonId,
          sale_date: reservationDate,
          amount: unitPrice,
          customer_id: customerId || null,
          customer_name: customerName,
          sale_type: 'ticket_consume',
          ticket_id: ticketId,
          menu: menu || null,
          staff_name: reservation.staff_name || null,
          memo: `コース消化: ${ticket.plan_name || menu || '施術'}（残${newRemaining}回）`,
        })
      }
    } else if (isCourse && subscriptionId) {
      // --- コース消化: サブスク（旧データは来店時に消化） ---
      const { data: sub } = await supabase
        .from('customer_subscriptions')
        .select('id, sessions_used_in_period, plan_name, price, sessions_per_month')
        .eq('id', subscriptionId)
        .single()

      if (sub) {
        const newUsed = (sub.sessions_used_in_period || 0) + 1
        await supabase
          .from('customer_subscriptions')
          .update({ sessions_used_in_period: newUsed })
          .eq('id', subscriptionId)

        const unitPrice = sub.sessions_per_month > 0
          ? Math.round(Number(sub.price) / sub.sessions_per_month)
          : 0

        await supabase.from('sales').insert({
          salon_id: salonId,
          sale_date: reservationDate,
          amount: unitPrice,
          customer_id: customerId || null,
          customer_name: customerName,
          sale_type: 'subscription_consume',
          menu: menu || null,
          staff_name: reservation.staff_name || null,
          memo: `サブスク消化: ${sub.plan_name || menu || '施術'}（今月${newUsed}/${sub.sessions_per_month}回）`,
        })
      }
    } else {
      // --- 通常予約: 既存のチケット自動マッチング or 都度払い ---
      const { data: tickets } = await supabase
        .from('customer_tickets')
        .select('id, customer_id, menu_name, remaining_sessions, unit_price, ticket_plan_id, expiry_date, customers(name)')
        .eq('salon_id', salonId)
        .gt('remaining_sessions', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false })

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

        const ticketUpdate: Record<string, unknown> = { remaining_sessions: newRemaining }
        if (newRemaining === 0) ticketUpdate.status = 'expired'
        await supabase.from('customer_tickets').update(ticketUpdate).eq('id', matchingTicket.id)

        await supabase.from('sales').insert({
          salon_id: salonId,
          sale_date: reservationDate,
          amount: unitPrice,
          customer_id: customerId || null,
          customer_name: customerName,
          sale_type: 'ticket_consume',
          ticket_id: matchingTicket.id,
          memo: `予約来店: ${menu || '施術'}（残${newRemaining}回）`,
        })
      } else {
        const amount = price > 0 ? price : 0
        if (amount > 0) {
          await supabase.from('sales').insert({
            salon_id: salonId,
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
