import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'

function toCustomerTicket(row: Record<string, unknown>) {
  const cust = row.customers as { name?: string } | null | undefined
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name ?? cust?.name ?? '',
    ticketPlanId: row.ticket_plan_id,
    planName: row.plan_name,
    menuName: row.menu_name,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    purchasedAt: row.purchased_at,
    expiryDate: row.expiry_date,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { remaining_sessions } = body
    const reasonRaw = typeof body.reason === 'string' ? body.reason.trim() : ''
    const consumeOne = body.consume_one === true
    const isManualAdjust = reasonRaw.length > 0

    if (remaining_sessions == null) {
      return NextResponse.json({ error: 'remaining_sessions が必要です' }, { status: 400 })
    }

    const salonId = await resolveSalonIdForOwnerApi(req)
    const supabase = getSupabaseAdmin()

    const { data: current, error: fetchError } = await supabase
      .from('customer_tickets')
      .select('id, customer_id, ticket_plan_id, plan_name, unit_price, remaining_sessions, total_sessions, customers(name)')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'チケットが見つかりません' }, { status: 404 })
    }

    const oldRemaining = Number(current.remaining_sessions ?? 0)
    const newRemaining = Number(remaining_sessions)
    if (!Number.isFinite(newRemaining) || newRemaining < 0) {
      return NextResponse.json({ error: 'remaining_sessions が不正です' }, { status: 400 })
    }
    if (consumeOne && newRemaining !== oldRemaining - 1) {
      return NextResponse.json({ error: '消化は1回分のみ指定できます' }, { status: 400 })
    }
    const totalCap = current.total_sessions != null ? Number(current.total_sessions) : null
    if (totalCap != null && Number.isFinite(totalCap) && newRemaining > totalCap) {
      return NextResponse.json(
        { error: `残回数は最大${totalCap}回までです` },
        { status: 400 }
      )
    }

    // 消化ボタン（consume_one）のときのみ消化売上を計上。手動調整（reason あり）では計上しない
    if (consumeOne && !isManualAdjust && newRemaining < oldRemaining && newRemaining >= 0) {
      let unitPrice = current.unit_price != null ? Number(current.unit_price) : null
      if (unitPrice == null && current.ticket_plan_id) {
        const { data: plan } = await supabase
          .from('ticket_plans')
          .select('price, total_sessions')
          .eq('id', current.ticket_plan_id)
          .single()
        if (plan && plan.total_sessions > 0) {
          unitPrice = Math.round(Number(plan.price) / Number(plan.total_sessions))
        }
      }
      if (unitPrice == null) {
        unitPrice = 0
      }

      const today = new Date().toISOString().slice(0, 10)
      const cust = current.customers as { name?: string } | null | undefined
      const customerName = cust?.name ?? ''
      await supabase.from('sales').insert({
        salon_id: salonId,
        sale_date: today,
        amount: unitPrice,
        customer_id: current.customer_id,
        customer_name: customerName,
        sale_type: 'ticket_consume',
        ticket_id: id,
        memo: `${current.plan_name} 消化（残${newRemaining}回）`,
        status: 'active',
      })
    }

    const { data, error } = await supabase
      .from('customer_tickets')
      .update({ remaining_sessions: newRemaining })
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error) throw error

    if (isManualAdjust && oldRemaining !== newRemaining) {
      const { error: logErr } = await supabase.from('customer_ticket_logs').insert({
        salon_id: salonId,
        customer_ticket_id: id,
        customer_id: current.customer_id,
        previous_remaining: oldRemaining,
        new_remaining: newRemaining,
        reason: reasonRaw,
      })
      if (logErr) {
        console.error('customer_ticket_logs insert:', logErr)
      }
    }

    return NextResponse.json({ ticket: toCustomerTicket(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
