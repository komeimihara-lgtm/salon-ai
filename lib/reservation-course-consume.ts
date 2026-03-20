import { getSupabaseAdmin } from '@/lib/supabase'

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

export type CourseConsumeContext = {
  salonId: string
  reservationDate: string
  customerId: string
  customerName: string
  menu: string | null
  staffName: string | null
}

/**
 * 予約作成時: 回数券を1回消化し sales に ticket_consume を計上する。
 */
export async function consumeTicketAtBooking(
  supabase: SupabaseAdmin,
  ticketId: string,
  ctx: CourseConsumeContext
): Promise<void> {
  const { data: ticket } = await supabase
    .from('customer_tickets')
    .select('id, remaining_sessions, unit_price, ticket_plan_id, plan_name, salon_id')
    .eq('id', ticketId)
    .eq('salon_id', ctx.salonId)
    .single()

  if (!ticket || Number(ticket.remaining_sessions ?? 0) <= 0) {
    const err = new Error('回数券の残回数が不足しています')
    ;(err as Error & { code?: string }).code = 'TICKET_DEPLETED'
    throw err
  }

  const newRemaining = Number(ticket.remaining_sessions) - 1
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
    salon_id: ctx.salonId,
    sale_date: ctx.reservationDate,
    amount: unitPrice,
    customer_id: ctx.customerId || null,
    customer_name: ctx.customerName,
    sale_type: 'ticket_consume',
    ticket_id: ticketId,
    menu: ctx.menu || null,
    staff_name: ctx.staffName || null,
    memo: `コース消化（予約時）: ${ticket.plan_name || ctx.menu || '施術'}（残${newRemaining}回）`,
  })
}

/**
 * 予約作成時: サブスクを1回消化し sales に subscription_consume を計上する。
 */
export async function consumeSubscriptionAtBooking(
  supabase: SupabaseAdmin,
  subscriptionId: string,
  ctx: CourseConsumeContext
): Promise<void> {
  const { data: sub } = await supabase
    .from('customer_subscriptions')
    .select('id, sessions_used_in_period, plan_name, price, sessions_per_month, salon_id')
    .eq('id', subscriptionId)
    .eq('salon_id', ctx.salonId)
    .single()

  if (!sub) {
    const err = new Error('サブスクリプションが見つかりません')
    ;(err as Error & { code?: string }).code = 'SUB_NOT_FOUND'
    throw err
  }

  const newUsed = (sub.sessions_used_in_period || 0) + 1
  await supabase
    .from('customer_subscriptions')
    .update({ sessions_used_in_period: newUsed })
    .eq('id', subscriptionId)

  const unitPrice =
    sub.sessions_per_month > 0 ? Math.round(Number(sub.price) / sub.sessions_per_month) : 0

  await supabase.from('sales').insert({
    salon_id: ctx.salonId,
    sale_date: ctx.reservationDate,
    amount: unitPrice,
    customer_id: ctx.customerId || null,
    customer_name: ctx.customerName,
    sale_type: 'subscription_consume',
    menu: ctx.menu || null,
    staff_name: ctx.staffName || null,
    memo: `サブスク消化（予約時）: ${sub.plan_name || ctx.menu || '施術'}（今月${newUsed}/${sub.sessions_per_month}回）`,
  })
}
