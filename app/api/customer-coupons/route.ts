import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

function toCustomerCoupon(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    customerId: row.customer_id,
    couponId: row.coupon_id,
    couponName: row.coupon_name,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    targetMenu: row.target_menu,
    obtainedAt: row.obtained_at,
    usedAt: row.used_at,
    expiryDate: row.expiry_date,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')

    let query = getSupabaseAdmin()
      .from('customer_coupons')
      .select('*')
      .eq('salon_id', getSalonIdFromCookie())
      .order('obtained_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []).map((r: Record<string, unknown>) => toCustomerCoupon(r))
    return NextResponse.json({ coupons: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_id,
      coupon_id,
      coupon_name,
      discount_type,
      discount_value,
      target_menu,
      obtained_at,
      expiry_date,
    } = body

    if (!customer_id || !coupon_id || !coupon_name || !discount_type || discount_value == null || !obtained_at) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_coupons')
      .insert({
        salon_id: getSalonIdFromCookie(),
        customer_id,
        coupon_id,
        coupon_name,
        discount_type,
        discount_value,
        target_menu: target_menu || null,
        obtained_at,
        used_at: null,
        expiry_date: expiry_date || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ coupon: toCustomerCoupon(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
