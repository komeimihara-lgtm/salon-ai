import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export type DailyRow = {
  date: string
  dayOfWeek: string
  cashSales: number
  consumeSales: number
  productSales: number
  serviceLiability: number
  visitors: number
  unitPrice: number
  newVisitors: number
  newReservations: number
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? '', 10)
    const month = parseInt(searchParams.get('month') ?? '', 10)
    const salonId = searchParams.get('salon_id') || getSalonIdFromCookie()

    if (isNaN(year) || isNaN(month)) {
      return NextResponse.json({ error: 'year, month が必要です' }, { status: 400 })
    }

    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const supabase = getSupabaseAdmin()

    const { data: sales } = await supabase
      .from('sales')
      .select('sale_date, amount, sale_type')
      .eq('salon_id', salonId)
      .gte('sale_date', start)
      .lte('sale_date', end)

    const { data: tickets } = await supabase
      .from('customer_tickets')
      .select('remaining_sessions, unit_price')
      .eq('salon_id', salonId)

    let serviceLiabilityTotal = 0
    for (const t of tickets || []) {
      const r = Number(t.remaining_sessions ?? 0)
      const u = Number(t.unit_price ?? 0)
      if (r > 0 && u > 0) serviceLiabilityTotal += r * u
    }

    const DAYS = ['日', '月', '火', '水', '木', '金', '土']
    const rows: DailyRow[] = []

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = DAYS[new Date(year, month - 1, d).getDay()]

      let cashSales = 0
      let consumeSales = 0
      let productSales = 0
      const daySales = (sales || []).filter((s: { sale_date: string }) => s.sale_date === dateStr)

      for (const s of daySales) {
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

      const visitors = daySales.length
      const unitPrice = visitors > 0 ? Math.round(consumeSales / visitors) : 0

      const { count: newVisitors } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('first_visit_date', dateStr)

      const { count: newReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .gte('created_at', `${dateStr}T00:00:00`)
        .lt('created_at', `${dateStr}T23:59:59.999`)

      rows.push({
        date: dateStr,
        dayOfWeek,
        cashSales,
        consumeSales,
        productSales,
        serviceLiability: serviceLiabilityTotal,
        visitors,
        unitPrice,
        newVisitors: newVisitors ?? 0,
        newReservations: newReservations ?? 0,
      })
    }

    const { data: salon } = await supabase
      .from('salons')
      .select('monthly_target')
      .eq('id', salonId)
      .single()

    const monthlyTarget = Number(salon?.monthly_target ?? 0) || 3000000
    const totalCash = rows.reduce((s, r) => s + r.cashSales, 0)
    const totalConsume = rows.reduce((s, r) => s + r.consumeSales, 0)
    const totalProduct = rows.reduce((s, r) => s + r.productSales, 0)
    const totalSales = totalCash + totalConsume + totalProduct
    const achievementRate = monthlyTarget > 0 ? Math.round((totalSales / monthlyTarget) * 100) : 0

    return NextResponse.json({
      year,
      month,
      monthlyTarget,
      achievementRate,
      rows,
      totals: {
        cashSales: totalCash,
        consumeSales: totalConsume,
        productSales: totalProduct,
        totalSales,
        visitors: rows.reduce((s, r) => s + r.visitors, 0),
        newVisitors: rows.reduce((s, r) => s + r.newVisitors, 0),
        newReservations: rows.reduce((s, r) => s + r.newReservations, 0),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
