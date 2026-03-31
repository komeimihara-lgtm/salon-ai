import { NextRequest, NextResponse } from 'next/server'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import { getSalonSaleOperator } from '@/lib/salon-sale-operator'
import { insertSaleLog, saleRowSnapshot } from '@/lib/sale-audit'
import { overwriteSaleCustomerNamesFromDb } from '@/lib/sale-customer-display'
import { insertCustomerProductExpiriesForSales } from '@/lib/customer-product-expiry'
import {
  jsonErrorWithDetails,
  logPostgrestError,
  postgrestErrorFields,
} from '@/lib/postgrest-error-response'

const LOG_TAG = '[api/kpi/sales]'

export async function GET(req: NextRequest) {
  const fromCookieOnly = getSalonIdFromCookie()
  console.log(LOG_TAG, 'GET getSalonIdFromCookie', {
    len: fromCookieOnly.length,
    suffix: fromCookieOnly ? fromCookieOnly.slice(-8) : '',
  })

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    console.error(LOG_TAG, 'GET Supabase init failed', e)
    return jsonErrorWithDetails(500, 'サーバー設定エラー', { caught: e })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const customerId = searchParams.get('customer_id')
  const querySalon = searchParams.get('salon_id')?.trim()
  const salonId = querySalon || (await resolveSalonIdForOwnerApi(req))
  if (!salonId) {
    return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })
  }
  const includeCancelled =
    searchParams.get('include_cancelled') === '1' || searchParams.get('include_cancelled') === 'true'

  let query = supabase
    .from('sales')
    .select('*')
    .eq('salon_id', salonId)
    .order('sale_date', { ascending: false })

  if (!includeCancelled) {
    query = query.eq('status', ACTIVE_SALE_STATUS)
  }

  if (start) query = query.gte('sale_date', start)
  if (end) query = query.lte('sale_date', end)
  if (customerId) query = query.eq('customer_id', customerId)

  let { data, error } = await query
  if (error && String(error.message ?? '').includes('status')) {
    console.warn(LOG_TAG, 'GET retrying without status filter', postgrestErrorFields(error))
    let q2 = supabase
      .from('sales')
      .select('*')
      .eq('salon_id', salonId)
      .order('sale_date', { ascending: false })
    if (start) q2 = q2.gte('sale_date', start)
    if (end) q2 = q2.lte('sale_date', end)
    if (customerId) q2 = q2.eq('customer_id', customerId)
    const r2 = await q2
    data = r2.data
    error = r2.error
  }
  if (error) {
    logPostgrestError(`${LOG_TAG} GET sales query failed`, error, {
      salonId_suffix: salonId.slice(-8),
      includeCancelled,
    })
    return jsonErrorWithDetails(500, error.message, { supabase: error })
  }
  const rows = (data || []).map((r) => ({ ...(r as Record<string, unknown>) }))
  await overwriteSaleCustomerNamesFromDb(supabase, salonId, rows)
  return NextResponse.json({ sales: rows })
}

export async function POST(req: NextRequest) {
  const fromCookieOnly = getSalonIdFromCookie()
  console.log(LOG_TAG, 'POST getSalonIdFromCookie', {
    len: fromCookieOnly.length,
    suffix: fromCookieOnly ? fromCookieOnly.slice(-8) : '',
  })

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    console.error(LOG_TAG, 'POST Supabase init failed', e)
    return jsonErrorWithDetails(500, 'サーバー設定エラー', { caught: e })
  }

  try {
    const body = await req.json()
    const sales = Array.isArray(body.sales) ? body.sales : (body.sale_date != null ? [body] : [])

    if (sales.length === 0) {
      return NextResponse.json({ error: 'salesが必要です' }, { status: 400 })
    }

    const salonId = await resolveSalonIdForOwnerApi(req)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })
    }
    const op = await getSalonSaleOperator(req)
    const operatedBy = op.displayName || op.email || 'レジ登録'

    const cleanedSales = sales.map((s: Record<string, unknown>) => ({
      salon_id: s.salon_id || salonId,
      sale_date: s.sale_date,
      amount: s.amount,
      customer_id: s.customer_id || null,
      customer_name: s.customer_name || null,
      menu: s.menu || null,
      staff_name: s.staff_name || null,
      payment_method: s.payment_method || 'cash',
      memo: s.memo || null,
      sale_type: s.sale_type || 'cash',
      ticket_id: s.ticket_id || null,
      product_id: s.product_id || null,
      status: ACTIVE_SALE_STATUS,
    }))

    await overwriteSaleCustomerNamesFromDb(supabase, salonId, cleanedSales)

    const { data, error } = await supabase
      .from('sales')
      .insert(cleanedSales)
      .select()

    if (error) {
      logPostgrestError(`${LOG_TAG} POST sales insert failed`, error, { salonId_suffix: salonId.slice(-8) })
      return jsonErrorWithDetails(500, error.message, { supabase: error })
    }

    const rows = data || []
    await insertCustomerProductExpiriesForSales(
      supabase,
      rows.map((r) => ({
        id: r.id as string,
        salon_id: r.salon_id as string,
        sale_date: r.sale_date as string | null,
        sale_type: r.sale_type as string | null,
        customer_id: r.customer_id as string | null,
        product_id: (r as { product_id?: string | null }).product_id ?? null,
      }))
    )

    for (const row of rows) {
      const { error: logErr } = await insertSaleLog({
        saleId: row.id,
        salonId: row.salon_id,
        action: 'created',
        beforeData: null,
        afterData: saleRowSnapshot(row as Record<string, unknown>),
        operatedBy,
      })
      if (logErr) {
        console.error(`${LOG_TAG} POST insertSaleLog failed`, { saleId: row.id, err: logErr })
        await supabase.from('sales').delete().in(
          'id',
          rows.map((r) => r.id)
        )
        return jsonErrorWithDetails(500, '監査ログの記録に失敗しました', { caught: logErr })
      }
    }

    return NextResponse.json({ sales: rows })
  } catch (e) {
    console.error(LOG_TAG, 'POST unhandled exception', e)
    return jsonErrorWithDetails(500, e instanceof Error ? e.message : 'リクエスト処理エラー', {
      caught: e,
    })
  }
}
