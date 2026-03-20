import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

const PAYMENT_METHODS = ['cash', 'card', 'online', 'loan'] as const

function toCustomerSubscription(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    planId: row.plan_id,
    planName: row.plan_name,
    menuName: row.menu_name,
    price: row.price,
    sessionsPerMonth: row.sessions_per_month,
    startedAt: row.started_at,
    nextBillingDate: row.next_billing_date,
    sessionsUsedInPeriod: row.sessions_used_in_period,
    status: row.status,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')

    const salonId = getSalonIdFromCookie()
    let query = getSupabaseAdmin()
      .from('customer_subscriptions')
      .select('*')
      .eq('salon_id', salonId)
      .order('started_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []).map((r: Record<string, unknown>) => toCustomerSubscription(r))
    return NextResponse.json({ subscriptions: rows })
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
      customer_name,
      plan_id,
      plan_name,
      menu_name,
      price,
      sessions_per_month,
      started_at,
      next_billing_date,
      payment_method,
      record_sale,
      campaign_id,
    } = body

    const salonId = getSalonIdFromCookie()
    if (!customer_id || !plan_id || !plan_name || !menu_name || price == null || sessions_per_month == null || !started_at || !next_billing_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const insertData: Record<string, unknown> = {
      salon_id: salonId,
      customer_id,
      customer_name: customer_name || '',
      plan_id: String(plan_id),
      plan_name,
      menu_name,
      price: Number(price),
      sessions_per_month: Number(sessions_per_month),
      started_at,
      next_billing_date,
      sessions_used_in_period: 0,
      status: 'active',
    }
    if (campaign_id) insertData.campaign_id = campaign_id

    const { data, error } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[customer-subscriptions] POST Supabase error:', error.message, error.details, error.hint)
      throw error
    }

    // 売上計上（record_sale が true の場合）
    if (record_sale !== false && Number(price) > 0) {
      const saleType = PAYMENT_METHODS.includes(payment_method as (typeof PAYMENT_METHODS)[number]) ? payment_method : 'card'
      await getSupabaseAdmin()
        .from('sales')
        .insert({
          salon_id: salonId,
          sale_date: started_at,
          amount: Number(price),
          customer_id,
          customer_name: customer_name || null,
          memo: `${plan_name} 加入`,
          sale_type: saleType,
          status: 'active',
        })
    }

    return NextResponse.json({ subscription: toCustomerSubscription(data as Record<string, unknown>) })
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    const supabaseErr = e as { message?: string; details?: string; hint?: string }
    const details = [supabaseErr.message, supabaseErr.details, supabaseErr.hint].filter(Boolean).join(' ') || err.message
    console.error('[customer-subscriptions] POST 詳細エラー:', err, details)
    return NextResponse.json(
      { error: 'customer_subscriptionの登録に失敗しました', details },
      { status: 500 }
    )
  }
}
