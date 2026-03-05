import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json()
    const { sales } = body

    if (!sales || !Array.isArray(sales)) {
      return NextResponse.json({ error: 'salesが必要です' }, { status: 400 })
    }

    const cleanedSales = sales.map((s: Record<string, unknown>) => ({
      salon_id: process.env.NEXT_PUBLIC_SALON_ID || 'default',
      sale_date: s.sale_date,
      amount: s.amount,
      customer_id: s.customer_id || null,
      customer_name: s.customer_name || null,
      menu: s.menu || null,
      staff_name: s.staff_name || null,
      payment_method: s.payment_method || 'cash',
      memo: s.memo || null,
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
