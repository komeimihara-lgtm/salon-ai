import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import { requireSalonOwner } from '@/lib/attendance-api-helpers'

type Summary = {
  new_customer_sales: number
  repeat_sales: number
  course_sales: number
  subscription_sales: number
  product_sales: number
  consume_sales: number
  cash_sales: number
  total_sales: number
}

function emptySummary(): Summary {
  return {
    new_customer_sales: 0,
    repeat_sales: 0,
    course_sales: 0,
    subscription_sales: 0,
    product_sales: 0,
    consume_sales: 0,
    cash_sales: 0,
    total_sales: 0,
  }
}

function normalizeStaffName(s: string | null | undefined) {
  return (s || '').trim()
}

function addSaleToSummary(summary: Summary, sale: { amount?: unknown; sale_type?: string | null; customer_id?: string | null }, visitCount: number | undefined) {
  const amt = Number(sale.amount ?? 0)
  if (!Number.isFinite(amt)) return

  summary.total_sales += amt
  const st = (sale.sale_type as string) || 'cash'

  if (st === 'ticket_consume') {
    summary.course_sales += amt
    summary.consume_sales += amt
  } else if (st === 'subscription_consume') {
    summary.subscription_sales += amt
    summary.consume_sales += amt
  } else if (st === 'product') {
    summary.product_sales += amt
  }

  if (st !== 'ticket_consume' && st !== 'subscription_consume') {
    summary.cash_sales += amt
  }

  if (sale.customer_id) {
    if (visitCount === 1) summary.new_customer_sales += amt
    else if (visitCount != null && visitCount >= 2) summary.repeat_sales += amt
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireSalonOwner()
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const staffId = searchParams.get('staff_id')

  if (!start || !end) {
    return NextResponse.json({ error: 'start と end（YYYY-MM-DD）を指定してください' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: staffRows, error: staffErr } = await admin
    .from('staff')
    .select('id, name')
    .eq('salon_id', gate.salonId)
    .order('name')

  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 })

  const staffList = (staffRows || []) as { id: string; name: string }[]
  const targetStaff = staffId ? staffList.find((s) => s.id === staffId) : null
  if (staffId && !targetStaff) {
    return NextResponse.json({ error: '指定のスタッフが見つかりません' }, { status: 404 })
  }

  let sales: {
    amount?: unknown
    sale_type?: string | null
    customer_id?: string | null
    staff_name?: string | null
  }[] = []

  const { data: salesData, error: salesErr } = await admin
    .from('sales')
    .select('amount, sale_type, customer_id, staff_name')
    .eq('salon_id', gate.salonId)
    .eq('status', ACTIVE_SALE_STATUS)
    .gte('sale_date', start)
    .lte('sale_date', end)

  if (salesErr) {
    if (String(salesErr.message ?? '').includes('status')) {
      const { data: legacy, error: le } = await admin
        .from('sales')
        .select('amount, sale_type, customer_id, staff_name')
        .eq('salon_id', gate.salonId)
        .gte('sale_date', start)
        .lte('sale_date', end)
      if (le) return NextResponse.json({ error: le.message }, { status: 500 })
      sales = legacy || []
    } else {
      return NextResponse.json({ error: salesErr.message }, { status: 500 })
    }
  } else {
    sales = salesData || []
  }

  const customerIds = Array.from(
    new Set(sales.map((s) => s.customer_id).filter((id): id is string => !!id))
  )
  const visitMap = new Map<string, number>()
  if (customerIds.length > 0) {
    const { data: customers, error: cErr } = await admin.from('customers').select('id, visit_count').in('id', customerIds)
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    for (const c of customers || []) {
      visitMap.set((c as { id: string }).id, Number((c as { visit_count?: number }).visit_count ?? 0))
    }
  }

  if (targetStaff) {
    const name = normalizeStaffName(targetStaff.name)
    const summary = emptySummary()
    for (const sale of sales) {
      if (normalizeStaffName(sale.staff_name) !== name) continue
      const vc = sale.customer_id ? visitMap.get(sale.customer_id) : undefined
      addSaleToSummary(summary, sale, vc)
    }
    return NextResponse.json({
      range: { start, end },
      staff_id: targetStaff.id,
      staff_name: targetStaff.name,
      summary,
    })
  }

  const combined = emptySummary()
  const byStaff = staffList.map((st) => {
    const name = normalizeStaffName(st.name)
    const summary = emptySummary()
    for (const sale of sales) {
      if (normalizeStaffName(sale.staff_name) !== name) continue
      const vc = sale.customer_id ? visitMap.get(sale.customer_id) : undefined
      addSaleToSummary(summary, sale, vc)
    }
    for (const k of Object.keys(combined) as (keyof Summary)[]) {
      combined[k] += summary[k]
    }
    return {
      staff_id: st.id,
      staff_name: st.name,
      summary,
    }
  })

  return NextResponse.json({
    range: { start, end },
    combined,
    byStaff,
  })
}
