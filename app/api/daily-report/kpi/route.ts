import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const salonId = searchParams.get('salon_id') || getSalonIdFromCookie()

    if (!date) {
      return NextResponse.json({ error: 'date が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: sales } = await supabase
      .from('sales')
      .select('amount, sale_type')
      .eq('salon_id', salonId)
      .eq('status', ACTIVE_SALE_STATUS)
      .eq('sale_date', date)

    let cashSales = 0
    let consumeSales = 0
    let productSales = 0
    for (const s of sales || []) {
      const amt = Number(s.amount ?? 0)
      const st = (s.sale_type as string) || 'cash'
      if (st === 'ticket_consume' || st === 'subscription_consume') {
        consumeSales += amt
      } else if (st === 'product') {
        productSales += amt
      } else {
        cashSales += amt
      }
    }

    const { data: tickets } = await supabase
      .from('customer_tickets')
      .select('remaining_sessions, unit_price')
      .eq('salon_id', salonId)

    let serviceLiability = 0
    for (const t of tickets || []) {
      const r = Number(t.remaining_sessions ?? 0)
      const u = Number(t.unit_price ?? 0)
      if (r > 0 && u > 0) serviceLiability += r * u
    }

    const visitors = (sales || []).length
    const unitPrice = visitors > 0 ? Math.round(consumeSales / visitors) : 0

    const { count: newVisitors } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .eq('first_visit_date', date)

    const { count: newReservations } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59.999`)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('salon_id', salonId)
      .eq('reservation_date', date)

    const totalReservations = (reservations || []).length
    const completedReservations = (reservations || []).filter((r: { status: string }) => r.status === 'completed').length

    return NextResponse.json({
      cashSales,
      consumeSales,
      productSales,
      serviceLiability,
      visitors,
      unitPrice,
      newVisitors: newVisitors ?? 0,
      newReservations: newReservations ?? 0,
      totalReservations,
      completedReservations,
      taskCompletionRate: totalReservations > 0 ? Math.round((completedReservations / totalReservations) * 100) : 0,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
