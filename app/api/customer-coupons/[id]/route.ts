import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { used_at } = body

    const updates: Record<string, unknown> = {}
    if (used_at !== undefined) updates.used_at = used_at

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_coupons')
      .update(updates)
      .eq('id', params.id)
      .eq('salon_id', getSalonIdFromCookie())
      .select()
      .single()

    if (error) throw error

    const r = data as Record<string, unknown>
    return NextResponse.json({
      coupon: {
        id: r.id,
        customerId: r.customer_id,
        couponId: r.coupon_id,
        couponName: r.coupon_name,
        discountType: r.discount_type,
        discountValue: r.discount_value,
        targetMenu: r.target_menu,
        obtainedAt: r.obtained_at,
        usedAt: r.used_at,
        expiryDate: r.expiry_date,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
