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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')

    let query = getSupabaseAdmin()
      .from('customer_tickets')
      .select('id, customer_id, customer_name, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date')
      .eq('salon_id', DEMO_SALON_ID)
      .order('purchased_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    const tickets = (data || []).map((r: Record<string, unknown>) => toCustomerTicket(r))
    return NextResponse.json({ tickets })
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
      ticket_plan_id,
      plan_name,
      menu_name,
      total_sessions,
      remaining_sessions,
      unit_price,
      purchased_at,
      expiry_date,
    } = body

    if (!customer_id || !plan_name || !menu_name || total_sessions == null || remaining_sessions == null) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const purchasedAt = purchased_at || new Date().toISOString()
    const expiryDate = expiry_date || null
    const unitPrice = unit_price != null ? Number(unit_price) : null

    const { data, error } = await getSupabaseAdmin()
      .from('customer_tickets')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id,
        customer_name: customer_name || '',
        ticket_plan_id: ticket_plan_id || null,
        plan_name,
        menu_name,
        total_sessions,
        remaining_sessions,
        unit_price: unitPrice,
        purchased_at: purchasedAt,
        expiry_date: expiryDate,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ticket: toCustomerTicket({ ...data, customer_name: customer_name || '' }) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
