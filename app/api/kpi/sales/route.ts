import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import { getSalonSaleOperator } from '@/lib/salon-sale-operator'
import { insertSaleLog, saleRowSnapshot } from '@/lib/sale-audit'
import { overwriteSaleCustomerNamesFromDb } from '@/lib/sale-customer-display'
import { insertCustomerProductExpiriesForSales } from '@/lib/customer-product-expiry'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const customerId = searchParams.get('customer_id')
  const salonId = searchParams.get('salon_id') || getSalonIdFromCookie()
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []).map((r) => ({ ...(r as Record<string, unknown>) }))
  await overwriteSaleCustomerNamesFromDb(supabase, salonId, rows)
  return NextResponse.json({ sales: rows })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  try {
    const body = await req.json()
    const sales = Array.isArray(body.sales) ? body.sales : (body.sale_date != null ? [body] : [])

    if (sales.length === 0) {
      return NextResponse.json({ error: 'salesが必要です' }, { status: 400 })
    }

    const salonId = getSalonIdFromCookie()
    const op = await getSalonSaleOperator()
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
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
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
        await supabase.from('sales').delete().in(
          'id',
          rows.map((r) => r.id)
        )
        return NextResponse.json({ error: '監査ログの記録に失敗しました' }, { status: 500 })
      }
    }

    return NextResponse.json({ sales: rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
