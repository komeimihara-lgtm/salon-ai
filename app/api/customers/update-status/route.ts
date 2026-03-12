import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const supabase = getSupabaseAdmin()
  const salonId = getSalonIdFromCookie()

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, last_visit_date, visit_count, status')
    .eq('salon_id', salonId)
    .neq('status', 'temporary')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date()

  for (const customer of customers || []) {
    // 累計売上を取得
    const { data: salesData } = await supabase
      .from('sales')
      .select('amount')
      .eq('customer_id', customer.id)

    const totalSales = (salesData || []).reduce((sum: number, s: { amount: number }) => sum + s.amount, 0)
    const visitCount = customer.visit_count || 0

    const lastVisit = customer.last_visit_date ? new Date(customer.last_visit_date) : null
    const daysSince = lastVisit
      ? Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    // ステータス判定（優先順位順）
    let status = 'active'

    if (daysSince >= 60 && daysSince < 120) {
      status = 'at_risk' // 失客予備軍
    }
    if (visitCount >= 3 && daysSince >= 120) {
      status = 'dormant' // 休眠客
    }
    if (visitCount <= 2 && daysSince >= 120) {
      status = 'lost' // 失客（新規リピートなし）
    }
    if (visitCount >= 3 && daysSince >= 300) {
      status = 'lost' // 失客（休眠から180日以上）
    }
    if (visitCount >= 10 || totalSales >= 100000) {
      status = 'vip' // VIP（失客より優先）
      if (daysSince >= 300) status = 'lost' // ただしVIPでも300日以上未来店は失客
    }

    await supabase
      .from('customers')
      .update({ status })
      .eq('id', customer.id)
  }

  return NextResponse.json({ updated: customers?.length || 0 })
}
