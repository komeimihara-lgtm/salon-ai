import { NextRequest, NextResponse } from 'next/server'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import { addDaysToDateString, daysUntilExpiry, todayDateString } from '@/lib/customer-product-expiry'

export const dynamic = 'force-dynamic'

/**
 * 期限まで14日以内（sales 有効のみ）
 * 既定: 未通知のみ。ダッシュボード用に ?include_notified=1 で通知済みも含む
 */
export async function GET(req: NextRequest) {
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ error: 'サロン未選択です' }, { status: 401 })
  }

  const includeNotified = new URL(req.url).searchParams.get('include_notified') === '1'

  const today = todayDateString()
  const limit = addDaysToDateString(today, 14)

  const supabase = getSupabaseAdmin()
  let q = supabase
    .from('customer_product_expiry')
    .select(
      `
      id,
      sold_at,
      expires_at,
      is_notified,
      line_notified_at,
      products ( name, expiry_alert_days ),
      customers ( name, line_user_id ),
      sales ( status )
    `
    )
    .eq('salon_id', salonId)
    .lte('expires_at', limit)
    .order('expires_at', { ascending: true })

  if (!includeNotified) {
    q = q.eq('is_notified', false)
  }

  const { data: rows, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Rel<T> = T | T[] | null
  type Raw = {
    id: string
    sold_at: string
    expires_at: string
    is_notified: boolean
    line_notified_at: string | null
    products: Rel<{ name: string; expiry_alert_days?: number | null }>
    customers: Rel<{ name: string; line_user_id: string | null }>
    sales: Rel<{ status: string }>
  }

  const one = <T,>(v: T | T[] | null | undefined): T | null => {
    if (v == null) return null
    return Array.isArray(v) ? v[0] ?? null : v
  }

  const alerts = (rows || [])
    .filter((r: Raw) => one(r.sales)?.status === ACTIVE_SALE_STATUS)
    .map((r: Raw) => {
      const cust = one(r.customers)
      const prod = one(r.products)
      const customerName = cust?.name || '—'
      const productName = prod?.name || '—'
      const daysLeft = daysUntilExpiry(r.expires_at, today)
      return {
        id: r.id,
        customer_name: customerName,
        product_name: productName,
        sold_at: r.sold_at,
        expires_at: r.expires_at,
        days_left: daysLeft,
        line_user_id: cust?.line_user_id ?? null,
        is_notified: r.is_notified,
        line_notified_at: r.line_notified_at,
      }
    })
    .sort((a, b) => {
      if (a.is_notified !== b.is_notified) return a.is_notified ? 1 : -1
      return a.days_left - b.days_left
    })

  return NextResponse.json({ alerts, today })
}
