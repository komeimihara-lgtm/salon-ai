import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')
    const salonIdParam = searchParams.get('salon_id')
    const salonId = salonIdParam || getSalonId()

    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('customer_tickets')
      .select('id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date, customers(name)')
      .eq('salon_id', salonId)
      .order('purchased_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    let tickets = (data || []).map((r: Record<string, unknown>) => toCustomerTicket(r))
    if (tickets.length === 0 && !salonIdParam) {
      const { data: fallback } = await supabase
        .from('customer_tickets')
        .select('id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date, customers(name)')
        .order('purchased_at', { ascending: false })
      if (customerId) {
        tickets = (fallback || []).filter((r: Record<string, unknown>) => r.customer_id === customerId).map((r: Record<string, unknown>) => toCustomerTicket(r))
      } else {
        tickets = (fallback || []).map((r: Record<string, unknown>) => toCustomerTicket(r))
      }
    }
    return NextResponse.json({ tickets })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('customer-tickets GET error:', err.message, err.stack)
    return NextResponse.json(
      { error: 'customer_ticketsの取得に失敗しました', details: err.message },
      { status: 500 }
    )
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

    const salonId = getSalonId()
    if (!customer_id || !plan_name || !menu_name || total_sessions == null || remaining_sessions == null) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const purchasedAt = purchased_at || new Date().toISOString().slice(0, 10)
    const expiryDate = expiry_date || null
    const unitPrice = unit_price != null ? Number(unit_price) : null

    const insertData = {
      salon_id: salonId,
      customer_id,
      ticket_plan_id: ticket_plan_id || null,
      plan_name,
      menu_name,
      total_sessions: Number(total_sessions),
      remaining_sessions: Number(remaining_sessions),
      unit_price: unitPrice,
      purchased_at: purchasedAt,
      expiry_date: expiryDate,
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_tickets')
      .insert(insertData)
      .select('id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date')
      .single()

    if (error) {
      console.error('[customer-tickets] POST Supabase error:', error.message, error.details, error.hint)
      throw error
    }
    return NextResponse.json({ ticket: toCustomerTicket({ ...data, customer_name: customer_name || '' }) })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    const supabaseErr = e as { message?: string; details?: string; hint?: string }
    const details = [supabaseErr.message, supabaseErr.details, supabaseErr.hint].filter(Boolean).join(' ') || err.message
    console.error('[customer-tickets] POST 詳細エラー:', err, details)
    return NextResponse.json(
      { error: 'customer_ticketの登録に失敗しました', details },
      { status: 500 }
    )
  }
}
