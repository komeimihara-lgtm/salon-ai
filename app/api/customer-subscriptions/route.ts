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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')

    let query = getSupabaseAdmin()
      .from('customer_subscriptions')
      .select('*')
      .eq('salon_id', DEMO_SALON_ID)
      .order('started_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []).map((r: Record<string, unknown>) => toCustomerSubscription(r))
    return NextResponse.json({ subscriptions: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_id,
      customer_name,
      plan_id,
      plan_name,
      menu_name,
      price,
      sessions_per_month,
      started_at,
      next_billing_date,
    } = body

    if (!customer_id || !plan_id || !plan_name || !menu_name || price == null || sessions_per_month == null || !started_at || !next_billing_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id,
        customer_name: customer_name || '',
        plan_id,
        plan_name,
        menu_name,
        price,
        sessions_per_month,
        started_at,
        next_billing_date,
        sessions_used_in_period: 0,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ subscription: toCustomerSubscription(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
