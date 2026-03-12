import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

const PAYMENT_METHODS = ['cash', 'card', 'online', 'loan'] as const

const SELECT_COLS = 'id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date, customers(name)'
const SELECT_COLS_NO_UNIT_PRICE = 'id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, purchased_at, expiry_date, customers(name)'

function toCustomerTicket(row: Record<string, unknown>, hasUnitPrice = true) {
  const cust = row.customers as { name?: string } | null | undefined
  const totalSessions = Number(row.total_sessions ?? 0)
  const unitPriceVal = hasUnitPrice && row.unit_price != null ? Number(row.unit_price) : null
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name ?? cust?.name ?? '',
    ticketPlanId: row.ticket_plan_id,
    planName: row.plan_name,
    menuName: row.menu_name,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    unitPrice: unitPriceVal,
    purchasedAt: row.purchased_at,
    expiryDate: row.expiry_date,
  }
}

async function fetchTickets(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  salonId: string,
  customerId: string | null,
  selectCols: string,
  hasUnitPrice: boolean
) {
  let query = supabase
    .from('customer_tickets')
    .select(selectCols)
    .eq('salon_id', salonId)
    .order('purchased_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  const { data, error } = await query
  if (error) throw error
  const rows = (data || []) as unknown as Record<string, unknown>[]
  return rows.map((r) => toCustomerTicket(r, hasUnitPrice))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')
    const salonIdParam = searchParams.get('salon_id')
    const salonId = salonIdParam || getSalonIdFromCookie()

    const supabase = getSupabaseAdmin()
    let tickets: ReturnType<typeof toCustomerTicket>[]
    try {
      tickets = await fetchTickets(supabase, salonId, customerId, SELECT_COLS, true)
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      if (msg.includes('unit_price') || msg.includes('column') || msg.includes('does not exist')) {
        tickets = await fetchTickets(supabase, salonId, customerId, SELECT_COLS_NO_UNIT_PRICE, false)
      } else {
        throw e
      }
    }

    if (tickets.length === 0 && !salonIdParam) {
      try {
        const { data: fallback } = await supabase
          .from('customer_tickets')
          .select(SELECT_COLS)
          .order('purchased_at', { ascending: false })
        let rows = fallback || []
        if (customerId) rows = rows.filter((r: Record<string, unknown>) => r.customer_id === customerId)
        tickets = rows.map((r: Record<string, unknown>) => toCustomerTicket(r, true))
      } catch {
        const { data: fallback } = await supabase
          .from('customer_tickets')
          .select(SELECT_COLS_NO_UNIT_PRICE)
          .order('purchased_at', { ascending: false })
        let rows = fallback || []
        if (customerId) rows = rows.filter((r: Record<string, unknown>) => r.customer_id === customerId)
        tickets = rows.map((r: Record<string, unknown>) => toCustomerTicket(r, false))
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
      payment_method,
      record_sale,
      campaign_id,
      amount: bodyAmount,
    } = body

    const salonId = getSalonIdFromCookie()
    if (!customer_id || !plan_name || !menu_name || total_sessions == null || remaining_sessions == null) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const purchasedAt = purchased_at || new Date().toISOString().slice(0, 10)
    const expiryDate = expiry_date || null
    const unitPrice = unit_price != null ? Number(unit_price) : null

    const insertPayload: Record<string, unknown> = {
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
    if (campaign_id) insertPayload.campaign_id = campaign_id

    const insertDataWithUnitPrice = { ...insertPayload }
    const insertDataWithoutUnitPrice = { ...insertPayload }
    delete (insertDataWithoutUnitPrice as Record<string, unknown>).unit_price

    const selectCols = 'id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, unit_price, purchased_at, expiry_date'
    const selectColsNoUnitPrice = 'id, customer_id, ticket_plan_id, plan_name, menu_name, total_sessions, remaining_sessions, purchased_at, expiry_date'

    let result: { data: Record<string, unknown>; hasUnitPrice: boolean }
    const { data: data1, error: err1 } = await getSupabaseAdmin()
      .from('customer_tickets')
      .insert(insertDataWithUnitPrice)
      .select(selectCols)
      .single()

    if (!err1 && data1) {
      result = { data: data1, hasUnitPrice: true }
    } else {
      const msg = String(err1?.message ?? '')
      if (msg.includes('unit_price') || msg.includes('column') || msg.includes('does not exist')) {
        const { data: data2, error: err2 } = await getSupabaseAdmin()
          .from('customer_tickets')
          .insert(insertDataWithoutUnitPrice)
          .select(selectColsNoUnitPrice)
          .single()
        if (err2) {
          console.error('[customer-tickets] POST Supabase error:', err2.message, err2.details, err2.hint)
          throw err2
        }
        result = { data: data2 as Record<string, unknown>, hasUnitPrice: false }
      } else {
        console.error('[customer-tickets] POST Supabase error:', err1?.message, err1?.details, err1?.hint)
        throw err1
      }
    }
    const ticketData = { ...result.data, customer_name: customer_name || '' }
    const ticket = toCustomerTicket(ticketData, result.hasUnitPrice)

    // 売上計上（record_sale が true の場合）
    if (record_sale !== false) {
      let saleAmount = 0
      if (bodyAmount != null && Number(bodyAmount) > 0) {
        saleAmount = Number(bodyAmount)
      } else if (ticket_plan_id) {
        const { data: planRow } = await getSupabaseAdmin()
          .from('ticket_plans')
          .select('price')
          .eq('id', ticket_plan_id)
          .single()
        saleAmount = Number(planRow?.price ?? 0)
      }
      if (saleAmount > 0) {
        const saleType = PAYMENT_METHODS.includes(payment_method as (typeof PAYMENT_METHODS)[number]) ? payment_method : 'card'
        await getSupabaseAdmin()
          .from('sales')
          .insert({
            salon_id: salonId,
            sale_date: purchasedAt,
            amount: saleAmount,
            customer_id,
            customer_name: customer_name || null,
            memo: `${plan_name} 購入`,
            sale_type: saleType,
          })
      }
    }

    return NextResponse.json({ ticket })
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
