/**
 * 顧客のクーポン保有（Supabase API）
 * クーポン定義は lib/menus.ts の getCoupons
 */

import { todayJstString } from '@/lib/jst-date'

export interface CustomerCoupon {
  id: string
  customerId: string
  couponId: string
  couponName: string
  discountType: 'percent' | 'amount'
  discountValue: number
  targetMenu?: string
  obtainedAt: string
  usedAt?: string
  expiryDate?: string
}

function mapRowToCoupon(r: Record<string, unknown>): CustomerCoupon {
  return {
    id: String(r.id),
    customerId: String(r.customerId ?? r.customer_id),
    couponId: String(r.couponId ?? r.coupon_id ?? ''),
    couponName: String(r.couponName ?? r.coupon_name ?? ''),
    discountType: (r.discountType ?? r.discount_type) as 'percent' | 'amount',
    discountValue: Number(r.discountValue ?? r.discount_value ?? 0),
    targetMenu: r.targetMenu ?? r.target_menu ? String(r.targetMenu ?? r.target_menu) : undefined,
    obtainedAt: String(r.obtainedAt ?? r.obtained_at ?? ''),
    usedAt: r.usedAt ?? r.used_at ? String(r.usedAt ?? r.used_at) : undefined,
    expiryDate: r.expiryDate ?? r.expiry_date ? String(r.expiryDate ?? r.expiry_date) : undefined,
  }
}

export async function fetchCustomerCoupons(customerId?: string): Promise<CustomerCoupon[]> {
  const url = customerId
    ? `/api/customer-coupons?customer_id=${encodeURIComponent(customerId)}`
    : '/api/customer-coupons'
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.coupons || []
  return rows.map((r: Record<string, unknown>) => mapRowToCoupon(r))
}

export async function addCustomerCouponApi(
  customerId: string,
  coupon: { id: string; name: string; discountType: 'percent' | 'amount'; discountValue: number; targetMenu?: string; expiryDate?: string }
): Promise<CustomerCoupon> {
  const obtainedAt = todayJstString()
  const res = await fetch('/api/customer-coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      coupon_id: coupon.id,
      coupon_name: coupon.name,
      discount_type: coupon.discountType,
      discount_value: coupon.discountValue,
      target_menu: coupon.targetMenu || null,
      obtained_at: obtainedAt,
      expiry_date: coupon.expiryDate || null,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  return mapRowToCoupon(json.coupon)
}

export async function useCustomerCoupon(couponId: string): Promise<boolean> {
  const today = todayJstString()
  const res = await fetch(`/api/customer-coupons/${couponId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ used_at: today }),
  })
  return res.ok
}
