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

    const { data, error } = await getSupabaseAdmin()
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
