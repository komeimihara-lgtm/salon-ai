import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export type MonthlyRow = {
  month: number
  monthLabel: string
  cashSales: number
  consumeSales: number
  productSales: number
  serviceLiability: number
  visitors: number
  unitPrice: number
  newVisitors: number
  newReservations: number
  achievementRate: number
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? '', 10)
    const salonId = searchParams.get('salon_id') || DEMO_SALON_ID

    if (isNaN(year)) {
      return NextResponse.json({ error: 'year が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: sales } = await supabase
      .from('sales')
      .select('sale_date, amount, sale_type')
      .eq('salon_id', salonId)
      .gte('sale_date', `${year}-01-01`)
      .lte('sale_date', `${year}-12-31`)

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

    const { data: salon } = await supabase
      .from('salons')
      .select('monthly_target')
      .eq('id', salonId)
      .single()

    const monthlyTarget = Number(salon?.monthly_target ?? 0) || 3000000

    const rows: MonthlyRow[] = []
    for (let m = 1; m <= 12; m++) {
      const start = `${year}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(year, m, 0).getDate()
      const end = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      let cashSales = 0
      let consumeSales = 0
      let productSales = 0
      const monthSales = (sales || []).filter(
        (s: { sale_date: string }) => s.sale_date >= start && s.sale_date <= end
      )

      for (const s of monthSales) {
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

      const visitors = monthSales.length
      const totalSales = cashSales + consumeSales + productSales
      const unitPrice = visitors > 0 ? Math.round(consumeSales / visitors) : 0
      const achievementRate = monthlyTarget > 0 ? Math.round((totalSales / monthlyTarget) * 100) : 0

      const { count: newVisitors } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .gte('first_visit_date', start)
        .lte('first_visit_date', end)

      const { count: newReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59.999`)

      rows.push({
        month: m,
        monthLabel: `${m}月`,
        cashSales,
        consumeSales,
        productSales,
        serviceLiability: serviceLiabilityTotal,
        visitors,
        unitPrice,
        newVisitors: newVisitors ?? 0,
        newReservations: newReservations ?? 0,
        achievementRate,
      })
    }

    const totals = {
      cashSales: rows.reduce((s, r) => s + r.cashSales, 0),
      consumeSales: rows.reduce((s, r) => s + r.consumeSales, 0),
      productSales: rows.reduce((s, r) => s + r.productSales, 0),
      visitors: rows.reduce((s, r) => s + r.visitors, 0),
      newVisitors: rows.reduce((s, r) => s + r.newVisitors, 0),
      newReservations: rows.reduce((s, r) => s + r.newReservations, 0),
    }
    const avgUnitPrice = totals.visitors > 0
      ? Math.round((rows.reduce((s, r) => s + r.consumeSales, 0) / totals.visitors))
      : 0

    return NextResponse.json({
      year,
      monthlyTarget,
      rows,
      totals: {
        ...totals,
        totalSales: totals.cashSales + totals.consumeSales + totals.productSales,
        avgUnitPrice,
        avgAchievementRate: rows.length > 0
          ? Math.round(rows.reduce((s, r) => s + r.achievementRate, 0) / rows.length)
          : 0,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
