import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { overwriteSaleCustomerNamesFromDb } from '@/lib/sale-customer-display'

import { PAYMENT_METHODS } from '@/lib/payment-methods'

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
    durationMinutes: row.duration_minutes,
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
      duration_minutes,
      started_at,
      next_billing_date,
      payment_method,
      staff_name,
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
      duration_minutes: Math.max(1, Number(duration_minutes) || 60),
      started_at,
      next_billing_date,
      sessions_used_in_period: 0,
      status: 'active',
    }
    if (campaign_id) insertData.campaign_id = campaign_id

    let { data, error } = await getSupabaseAdmin()
      .from('customer_subscriptions')
      .insert(insertData)
      .select()
      .single()

    // customer_subscriptions.duration_minutes 列が未適用のDBでも動くよう
    // エラー時は duration_minutes を除外して再実行
    if (error && String(error.message ?? '').includes('duration_minutes')) {
      console.warn('[customer-subscriptions] duration_minutes column missing, retrying without it')
      const { duration_minutes: _dm, ...insertDataNoDuration } = insertData
      void _dm
      const retry = await getSupabaseAdmin()
        .from('customer_subscriptions')
        .insert(insertDataNoDuration)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error('[customer-subscriptions] POST Supabase error:', error.message, error.details, error.hint)
      throw error
    }

    // 売上計上（record_sale が true の場合）
    if (record_sale !== false && Number(price) > 0) {
      const pm = PAYMENT_METHODS.includes(payment_method as (typeof PAYMENT_METHODS)[number]) ? payment_method : 'card'
      const saleNameRow = [{ customer_id, customer_name: customer_name || null }]
      await overwriteSaleCustomerNamesFromDb(getSupabaseAdmin(), salonId, saleNameRow)
      const resolvedCustomerName = (saleNameRow[0].customer_name as string | null) ?? customer_name ?? null
      const { error: saleErr } = await getSupabaseAdmin()
        .from('sales')
        .insert({
          salon_id: salonId,
          sale_date: started_at,
          amount: Number(price),
          customer_id,
          customer_name: resolvedCustomerName,
          menu: plan_name,
          staff_name: staff_name ?? null,
          memo: `${plan_name} 加入`,
          payment_method: pm,
          sale_type: pm, // payment_method と同じ(来店ベース売上として集計)
          status: 'active',
        })
      if (saleErr) {
        console.error('[customer-subscriptions] POST sales insert failed', saleErr)
      }
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
