import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const salonId = searchParams.get('salon_id')

  let query = supabase
    .from('sales')
    .select('*')
    .order('sale_date', { ascending: false })

  if (start) query = query.gte('sale_date', start)
  if (end) query = query.lte('sale_date', end)
  if (salonId) query = query.eq('salon_id', salonId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sales: data || [] })
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
    }))

    const { data, error } = await supabase
      .from('sales')
      .insert(cleanedSales)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }
    return NextResponse.json({ sales: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
