import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

/**
 * 日別売上明細取得
 * GET ?date=2026-03-05&type=cash | type=consume
 * - cash: sale_type が ticket_consume, subscription_consume 以外（着金売上）
 * - consume: sale_type が ticket_consume または subscription_consume（消化売上）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const type = searchParams.get('type')
    const salonIdParam = searchParams.get('salon_id')
    const salonId = salonIdParam || getSalonId()

    if (!date || !type) {
      return NextResponse.json({ error: 'date と type が必要です' }, { status: 400 })
    }
    if (type !== 'cash' && type !== 'consume') {
      return NextResponse.json({ error: 'type は cash または consume を指定してください' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('sales')
      .select('id, sale_date, amount, customer_id, customer_name, menu, staff_name, payment_method, sale_type, ticket_id, created_at, customers(name)')
      .eq('salon_id', salonId)
      .eq('sale_date', date)
      .order('created_at', { ascending: true })

    const { data: rows, error } = await query
    if (error) throw error

    const sales = (rows || []) as Array<Record<string, unknown>>

    const filtered = type === 'cash'
      ? sales.filter(s => s.sale_type !== 'ticket_consume' && s.sale_type !== 'subscription_consume')
      : sales.filter(s => s.sale_type === 'ticket_consume' || s.sale_type === 'subscription_consume')

    const getCustomerName = (s: Record<string, unknown>) => {
      const cn = s.customer_name
      if (cn && typeof cn === 'string') return cn
      const cust = s.customers
      if (cust && typeof cust === 'object' && !Array.isArray(cust) && 'name' in cust) return String((cust as { name?: unknown }).name ?? '-')
      if (Array.isArray(cust) && cust[0] && typeof cust[0] === 'object' && 'name' in cust[0]) return String((cust[0] as { name?: unknown }).name ?? '-')
      return '-'
    }

    if (type === 'consume' && filtered.some(s => s.ticket_id)) {
      const ticketIds = filtered.map(s => s.ticket_id).filter(Boolean) as string[]
      const { data: tickets } = await supabase
        .from('customer_tickets')
        .select('id, remaining_sessions')
        .in('id', ticketIds)
      const ticketMap = new Map((tickets || []).map((t: Record<string, unknown>) => [String(t.id), t.remaining_sessions]))
      return NextResponse.json({
        sales: filtered.map(s => ({
          id: s.id,
          customer_name: getCustomerName(s),
          menu: s.menu || '-',
          sale_type: s.sale_type,
          amount: s.amount,
          payment_method: s.payment_method,
          created_at: s.created_at,
          remaining_sessions: s.ticket_id ? ticketMap.get(String(s.ticket_id)) ?? '-' : '-',
        })),
        total: filtered.reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
      })
    }

    return NextResponse.json({
      sales: filtered.map(s => ({
        id: s.id,
        customer_name: getCustomerName(s),
        menu: s.menu || '-',
        sale_type: s.sale_type,
        amount: s.amount,
        payment_method: s.payment_method,
        created_at: s.created_at,
      })),
      total: filtered.reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('daily-detail error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
