import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

function toCustomerSubscription(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    planId: row.plan_id,
    planName: row.plan_name,
    menuName: row.menu_name,
    price: row.price,
    sessionsPerMonth: row.sessions_per_month,
    startedAt: row.started_at,
    nextBillingDate: row.next_billing_date,
    sessionsUsedInPeriod: row.sessions_used_in_period,
    status: row.status,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { sessions_used_in_period, next_billing_date, status } = body

    const updates: Record<string, unknown> = {}
    if (sessions_used_in_period !== undefined) updates.sessions_used_in_period = sessions_used_in_period
    if (next_billing_date !== undefined) updates.next_billing_date = next_billing_date
    if (status !== undefined) updates.status = status

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .update(updates)
      .eq('id', params.id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ subscription: toCustomerSubscription(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
