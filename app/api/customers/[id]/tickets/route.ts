import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonTenantId } from '@/lib/get-salon-id'

/** 顧客の有効な回数券・サブスク一覧を返す */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(req.url)
    const salonId = resolveSalonTenantId(searchParams)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
    }
    const customerId = params.id

    // 有効な回数券
    const { data: tickets } = await getSupabaseAdmin()
      .from('customer_tickets')
      .select('id, plan_name, menu_name, remaining_sessions, total_sessions, unit_price, expiry_date')
      .eq('salon_id', salonId)
      .eq('customer_id', customerId)
      .gt('remaining_sessions', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })

    // 有効なサブスク
    const { data: subscriptions } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .select('id, plan_name, menu_name, sessions_per_month, sessions_used_in_period, price')
      .eq('salon_id', salonId)
      .eq('customer_id', customerId)
      .eq('status', 'active')

    return NextResponse.json({
      tickets: (tickets || []).map(t => ({
        id: t.id,
        plan_name: t.plan_name,
        menu_name: t.menu_name,
        remaining_count: t.remaining_sessions,
        total_sessions: t.total_sessions,
        unit_price: t.unit_price,
        expiry_date: t.expiry_date,
        ticket_type: 'ticket',
      })),
      subscriptions: (subscriptions || []).map(s => ({
        id: s.id,
        plan_name: s.plan_name,
        menu_name: s.menu_name,
        sessions_per_month: s.sessions_per_month,
        sessions_used: s.sessions_used_in_period || 0,
        price: s.price,
        ticket_type: 'subscription',
      })),
    })
  } catch (e) {
    console.error('顧客コース取得エラー:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
