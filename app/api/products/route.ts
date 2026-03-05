import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

function toProduct(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    low_stock_threshold: row.low_stock_threshold,
    barcode: row.barcode,
    memo: row.memo,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const salonId = searchParams.get('salon_id') || getSalonId()

    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .select('*')
      .eq('salon_id', salonId)
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ products: (data || []).map(toProduct) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, price, cost, stock, low_stock_threshold, barcode, memo } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '商品名は必須です' }, { status: 400 })
    }

    const salonId = getSalonId()
    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .insert({
        salon_id: salonId,
        name: String(name).trim(),
        category: category ?? '物販',
        price: Number(price ?? 0),
        cost: Number(cost ?? 0),
        stock: Number(stock ?? 0),
        low_stock_threshold: Number(low_stock_threshold ?? 5),
        barcode: barcode != null ? String(barcode) : null,
        memo: memo != null ? String(memo) : null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: toProduct(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
