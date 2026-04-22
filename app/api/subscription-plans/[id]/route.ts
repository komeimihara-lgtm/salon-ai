import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

function toSubscriptionPlan(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    menuName: row.menu_name,
    price: Number(row.price ?? 0),
    sessionsPerMonth: Number(row.sessions_per_month ?? 0),
    billingDay: Number(row.billing_day ?? 1),
    category: String(row.category ?? ''),
    durationMinutes: Number(row.duration_minutes ?? 60),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await req.json()
    const salonId = getSalonIdFromCookie()

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = String(body.name)
    if (body.menu_name !== undefined) updates.menu_name = String(body.menu_name)
    if (body.price !== undefined) {
      const p = Number(body.price)
      if (Number.isFinite(p) && p >= 0) updates.price = p
    }
    if (body.sessions_per_month !== undefined) {
      const s = Number(body.sessions_per_month)
      if (Number.isFinite(s) && s >= 0) updates.sessions_per_month = s
    }
    if (body.billing_day !== undefined) {
      updates.billing_day = Math.min(28, Math.max(1, Number(body.billing_day) || 1))
    }
    if (body.category !== undefined) updates.category = String(body.category)
    if (body.duration_minutes !== undefined) {
      updates.duration_minutes = Math.max(1, Number(body.duration_minutes) || 60)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    let { data, error } = await getSupabaseAdmin()
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()

    // duration_minutes 列が未適用のDBでも動くようフォールバック
    if (error && String(error.message ?? '').includes('duration_minutes')) {
      const { duration_minutes: _dm, ...noDuration } = updates
      void _dm
      const retry = await getSupabaseAdmin()
        .from('subscription_plans')
        .update(noDuration)
        .eq('id', id)
        .eq('salon_id', salonId)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error
    return NextResponse.json({ plan: toSubscriptionPlan(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const { error } = await getSupabaseAdmin()
      .from('subscription_plans')
      .delete()
      .eq('id', id)
      .eq('salon_id', getSalonIdFromCookie())

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
