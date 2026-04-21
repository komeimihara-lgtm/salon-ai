import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'

/**
 * 売上サマリー取得
 * 着金売上: sale_type が 'ticket_consume' 以外の合計
 * 消化売上: sale_type が 'ticket_consume' の合計
 * 役務残: customer_tickets の (remaining_sessions × unit_price) の合計
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const supabase = getSupabaseAdmin()

    let cashSales = 0
    let ticketConsumeSales = 0

    if (start && end) {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('amount, sale_type')
        .eq('salon_id', getSalonIdFromCookie())
        .eq('status', ACTIVE_SALE_STATUS)
        .gte('sale_date', start)
        .lte('sale_date', end)

      if (error) throw error

      for (const s of sales || []) {
        const amt = Number(s.amount ?? 0)
        if (s.sale_type === 'ticket_consume' || s.sale_type === 'subscription_consume') {
          ticketConsumeSales += amt
        } else {
          cashSales += amt
        }
      }
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('customer_tickets')
      .select('remaining_sessions, unit_price')
      .eq('salon_id', getSalonIdFromCookie())

    if (ticketsError) throw ticketsError

    let serviceLiability = 0
    for (const t of tickets || []) {
      const remaining = Number(t.remaining_sessions ?? 0)
      const unitPrice = Number(t.unit_price ?? 0)
      if (remaining > 0 && unitPrice > 0) {
        serviceLiability += remaining * unitPrice
      }
    }

    return NextResponse.json({
      cashSales,
      ticketConsumeSales,
      serviceLiability,
      totalSales: cashSales + ticketConsumeSales,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
