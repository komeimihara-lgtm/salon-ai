import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'

/**
 * KPIサマリー取得
 * 着金売上: sale_type が 'ticket_consume' 'subscription_consume' 以外の合計
 * 消化売上: sale_type が 'ticket_consume' または 'subscription_consume' の合計
 * 役務残: customer_tickets の (remaining_sessions × unit_price) の合計（前受金残高）
 *
 * クエリ:
 * - start, end: 3指標のみ返す
 * - year, month: 3指標 + KPIサマリー（達成率・顧客数等）を返す
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const salonIdParam = searchParams.get('salon_id')
    const salonId = salonIdParam || getSalonIdFromCookie()

    const supabase = getSupabaseAdmin()

    let rangeStart = start
    let rangeEnd = end
    if (yearParam && monthParam) {
      const y = parseInt(yearParam, 10)
      const m = parseInt(monthParam, 10)
      if (!isNaN(y) && !isNaN(m)) {
        rangeStart = `${y}-${String(m).padStart(2, '0')}-01`
        rangeEnd = new Date(y, m, 0).toISOString().slice(0, 10)
      }
    }

    let cashSales = 0
    let consumeSales = 0

    if (rangeStart && rangeEnd) {
      let sales: { amount?: number; sale_type?: string }[] | null = null
      const { data: salesWithType, error: salesErr } = await supabase
        .from('sales')
        .select('amount, sale_type')
        .eq('salon_id', salonId)
        .eq('status', ACTIVE_SALE_STATUS)
        .gte('sale_date', rangeStart)
        .lte('sale_date', rangeEnd)
      if (!salesErr) {
        sales = salesWithType
      } else if (String(salesErr.message ?? '').includes('status')) {
        const { data: salesLegacy, error: legacyErr } = await supabase
          .from('sales')
          .select('amount, sale_type')
          .eq('salon_id', salonId)
          .gte('sale_date', rangeStart)
          .lte('sale_date', rangeEnd)
        if (legacyErr) throw legacyErr
        sales = salesLegacy
      } else if (String(salesErr.message ?? '').includes('sale_type') || String(salesErr.message ?? '').includes('column')) {
        const { data: salesNoType } = await supabase
          .from('sales')
          .select('amount')
          .eq('salon_id', salonId)
          .eq('status', ACTIVE_SALE_STATUS)
          .gte('sale_date', rangeStart)
          .lte('sale_date', rangeEnd)
        sales = (salesNoType || []).map((s) => ({ ...s, sale_type: 'cash' }))
      } else {
        throw salesErr
      }
      for (const s of sales || []) {
        const amt = Number(s.amount ?? 0)
        if (s.sale_type === 'ticket_consume' || s.sale_type === 'subscription_consume') {
          consumeSales += amt
        } else {
          cashSales += amt
        }
      }
    }

    let tickets: { remaining_sessions?: number; unit_price?: number }[] | null = null
    let ticketsError: { message?: string } | null = null
    const { data: ticketsWithUnit, error: errWith } = await supabase
      .from('customer_tickets')
      .select('remaining_sessions, unit_price')
      .eq('salon_id', salonId)
    if (!errWith) {
      tickets = ticketsWithUnit
      ticketsError = null
    } else {
      const msg = String(errWith.message ?? '')
      if (msg.includes('unit_price') || msg.includes('column') || msg.includes('does not exist')) {
        const { data: ticketsNoUnit, error: errNo } = await supabase
          .from('customer_tickets')
          .select('remaining_sessions')
          .eq('salon_id', salonId)
        if (!errNo) tickets = ticketsNoUnit
        else ticketsError = errNo
      } else {
        ticketsError = errWith
      }
    }
    if (ticketsError) throw ticketsError

    let serviceLiability = 0
    for (const t of tickets || []) {
      const remaining = Number(t.remaining_sessions ?? 0)
      const unitPrice = t.unit_price != null ? Number(t.unit_price) : 0
      if (remaining > 0 && unitPrice > 0) {
        serviceLiability += remaining * unitPrice
      }
    }

    const totalSales = cashSales + consumeSales

    if (yearParam && monthParam && rangeStart && rangeEnd) {
      const y = parseInt(yearParam, 10)
      const m = parseInt(monthParam, 10)
      const { data: salon, error: salonError } = await supabase
        .from('salons')
        .select('monthly_target')
        .eq('id', salonId)
        .maybeSingle()
      const monthlyTarget = salonError ? 3000000 : (Number(salon?.monthly_target ?? 0) || 3000000)

      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, status, last_visit_date')
        .eq('salon_id', salonId)
      const activeCount = customersError ? 0 : (customers || []).filter((c: { status?: string }) => c.status === 'active').length
      const lostCount = customersError ? 0 : (customers || []).filter((c: { status?: string }) => c.status === 'lost').length

      const { data: salesForMonth } = await supabase
        .from('sales')
        .select('customer_id')
        .eq('salon_id', salonId)
        .eq('status', ACTIVE_SALE_STATUS)
        .gte('sale_date', rangeStart)
        .lte('sale_date', rangeEnd)
      const uniqueVisitorIds = new Set((salesForMonth || []).map((s: { customer_id?: string }) => s.customer_id).filter(Boolean))
      const uniqueVisitors = uniqueVisitorIds.size

      const { count: visitCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('status', ACTIVE_SALE_STATUS)
        .gte('sale_date', rangeStart)
        .lte('sale_date', rangeEnd)
      const avgUnitPrice = (visitCount ?? 0) > 0 ? Math.round(totalSales / (visitCount ?? 0)) : 0

      const now = new Date()
      const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m
      const lastDay = new Date(y, m, 0).getDate()
      const daysRemaining = isCurrentMonth ? Math.max(0, lastDay - now.getDate()) : 0
      const gap = Math.max(0, monthlyTarget - totalSales)
      const dailyNeeded = daysRemaining > 0 ? Math.round(gap / daysRemaining) : 0
      const achievementRate = monthlyTarget > 0 ? Math.round((totalSales / monthlyTarget) * 100) : 0

      return NextResponse.json({
        year: y,
        month: m,
        monthly_target: monthlyTarget,
        monthly_actual: totalSales,
        achievement_rate: achievementRate,
        customer_count: activeCount,
        lost_count: lostCount,
        unique_visitors: uniqueVisitors,
        avg_unit_price: avgUnitPrice,
        days_remaining: daysRemaining,
        gap,
        daily_needed: dailyNeeded,
        cashSales,
        consumeSales,
        serviceLiability,
        totalSales,
      })
    }

    return NextResponse.json({
      cashSales,
      consumeSales,
      serviceLiability,
      totalSales,
    })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('kpi/summary error:', err.message, err.stack)
    return NextResponse.json(
      { error: 'KPIサマリーの取得に失敗しました', details: err.message },
      { status: 500 }
    )
  }
}
