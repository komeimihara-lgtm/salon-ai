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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const salonId = getSalonId()

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.category !== undefined) updates.category = body.category
    if (body.price !== undefined) updates.price = Number(body.price)
    if (body.cost !== undefined) updates.cost = Number(body.cost)
    if (body.stock !== undefined) updates.stock = Number(body.stock)
    if (body.low_stock_threshold !== undefined) updates.low_stock_threshold = Number(body.low_stock_threshold)
    if (body.barcode !== undefined) updates.barcode = body.barcode
    if (body.memo !== undefined) updates.memo = body.memo
    updates.updated_at = new Date().toISOString()

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: toProduct(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const salonId = getSalonId()

    const { error } = await getSupabaseAdmin()
      .from('products')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
