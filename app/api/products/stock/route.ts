import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

async function resolveSalonId(req: NextRequest): Promise<string> {
  const fromOwner = await resolveSalonIdForOwnerApi(req).catch(() => '')
  return fromOwner || getSalonIdFromApiRequest(req) || ''
}

export async function POST(req: NextRequest) {
  try {
    const salonId = await resolveSalonId(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })

    const { product_id, type, quantity, memo } = await req.json()
    if (!product_id || !type) {
      return NextResponse.json({ error: 'product_id / type は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1) 在庫ログ (監査) — 失敗しても在庫更新は続行
    const { error: logError } = await supabase
      .from('product_stock_logs')
      .insert({ salon_id: salonId, product_id, type, quantity, memo: memo ?? null })
    if (logError) {
      console.error('[api/products/stock] log insert failed (non-fatal)', logError)
    }

    // 2) 現在在庫
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .eq('salon_id', salonId)
      .single()
    if (fetchError || !product) {
      console.error('[api/products/stock] product fetch failed', fetchError)
      return NextResponse.json({ error: '商品が見つかりません', details: fetchError }, { status: 404 })
    }

    // 3) 在庫計算 + 更新
    const currentStock = Number(product.stock ?? 0)
    const qty = Number(quantity ?? 0)
    const newStock =
      type === 'in' ? currentStock + qty :
      type === 'out' ? Math.max(0, currentStock - qty) :
      qty // 'adjust'

    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', product_id)
      .eq('salon_id', salonId)
    if (updateError) {
      console.error('[api/products/stock] update failed', updateError)
      return NextResponse.json({ error: updateError.message, details: updateError }, { status: 500 })
    }

    return NextResponse.json({ ok: true, stock: newStock })
  } catch (e) {
    console.error('[api/products/stock] error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
