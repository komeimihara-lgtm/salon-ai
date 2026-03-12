import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient()
  const { id } = await params
  const { type, quantity, memo } = await req.json()

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock')
    .eq('id', id)
    .single()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const newStock =
    type === 'in' ? product.stock + quantity :
    type === 'out' ? Math.max(0, product.stock - quantity) :
    quantity

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase
    .from('product_stock_logs')
    .insert({ salon_id: salonId, product_id: id, type, quantity, memo })

  return NextResponse.json({ ok: true, stock: newStock })
}
