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
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const salonIdParam = searchParams.get('salon_id')
    const resolvedSalonId = salonIdParam || getSalonIdFromCookie()
    let query = getSupabaseAdmin()
      .from('subscription_plans')
      .select('id, name, menu_name, price, sessions_per_month, billing_day, category, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (salonIdParam) {
      query = query.eq('salon_id', salonIdParam)
    } else {
      query = query.eq('salon_id', resolvedSalonId)
    }
    const { data, error } = await query
    if (error) throw error
    const plans = (data || []).map((r: Record<string, unknown>) => toSubscriptionPlan(r))
    return NextResponse.json({ plans })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, menu_name, price, sessions_per_month, billing_day, category } = body

    if (!name || !menu_name || price == null || sessions_per_month == null) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('subscription_plans')
      .insert({
        salon_id: getSalonIdFromCookie(),
        name,
        menu_name,
        price: Number(price),
        sessions_per_month: Number(sessions_per_month),
        billing_day: Math.min(28, Math.max(1, Number(billing_day) || 1)),
        category: category ?? '',
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: toSubscriptionPlan(data as Record<string, unknown>) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
