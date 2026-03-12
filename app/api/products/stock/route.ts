import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const salonId = getSalonIdFromCookie()
  const supabase = createClient()
  const { product_id, type, quantity, memo } = await req.json()

  const { error: logError } = await supabase
    .from('product_stock_logs')
    .insert({ salon_id: salonId, product_id, type, quantity, memo })
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', product_id)
    .single()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const newStock =
    type === 'in' ? product.stock + quantity :
    type === 'out' ? Math.max(0, product.stock - quantity) :
    quantity

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', product_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, stock: newStock })
}
