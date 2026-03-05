import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getSalonId } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { type, quantity, memo } = body

    if (!type || !['in', 'out', 'adjust'].includes(type) || quantity == null) {
      return NextResponse.json({ error: 'type と quantity が必要です' }, { status: 400 })
    }

    const qty = Number(quantity)
    if (qty < 0 || !Number.isInteger(qty)) {
      return NextResponse.json({ error: 'quantity は0以上の整数で指定してください' }, { status: 400 })
    }

    const salonId = getSalonId()
    const { data: product, error: fetchErr } = await getSupabaseAdmin()
      .from('products')
      .select('stock')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single()

    if (fetchErr || !product) {
      return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 })
    }

    const current = Number(product.stock ?? 0)
    let newStock: number
    if (type === 'in') newStock = current + qty
    else if (type === 'out') newStock = Math.max(0, current - qty)
    else newStock = qty

    const { error: updateErr } = await getSupabaseAdmin()
      .from('products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('salon_id', salonId)

    if (updateErr) throw updateErr
    return NextResponse.json({ ok: true, stock: newStock })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
