import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

function toCustomerTicket(row: Record<string, unknown>) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
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

    if (remaining_sessions == null) {
      return NextResponse.json({ error: 'remaining_sessions が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 現在のチケットを取得
    const { data: current, error: fetchError } = await supabase
      .from('customer_tickets')
      .select('id, customer_id, customer_name, ticket_plan_id, plan_name, unit_price, remaining_sessions')
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'チケットが見つかりません' }, { status: 404 })
    }

    const oldRemaining = Number(current.remaining_sessions ?? 0)
    const newRemaining = Number(remaining_sessions)

    // 消化売上を計上（remaining が減った場合）
    if (newRemaining < oldRemaining && newRemaining >= 0) {
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
      await supabase.from('sales').insert({
        salon_id: DEMO_SALON_ID,
        sale_date: today,
        amount: unitPrice,
        customer_id: current.customer_id,
        customer_name: current.customer_name || '',
        sale_type: 'ticket_consume',
        ticket_id: id,
        memo: `${current.plan_name} 消化（残${newRemaining}回）`,
      })
    }

    const { data, error } = await supabase
      .from('customer_tickets')
      .update({ remaining_sessions })
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ticket: toCustomerTicket(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
