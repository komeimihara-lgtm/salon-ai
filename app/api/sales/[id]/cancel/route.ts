import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonSaleOperator, canCancelSale } from '@/lib/salon-sale-operator'
import { insertSaleLog, saleRowSnapshot } from '@/lib/sale-audit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const op = await getSalonSaleOperator(req)
  if (!op.salonId) {
    return NextResponse.json({ error: 'salon_id がありません' }, { status: 400 })
  }
  if (!op.email) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canCancelSale(op.role)) {
    return NextResponse.json({ error: '取消の権限がありません' }, { status: 403 })
  }

  let body: { cancel_reason?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body */
  }
  const cancelReason = typeof body.cancel_reason === 'string' ? body.cancel_reason.trim() : ''
  if (!cancelReason) {
    return NextResponse.json({ error: '取消理由を入力してください' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: sale, error: fetchErr } = await supabase.from('sales').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !sale) {
    return NextResponse.json({ error: '売上が見つかりません' }, { status: 404 })
  }
  if (sale.salon_id !== op.salonId) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  if (sale.status !== 'active') {
    return NextResponse.json({ error: '取消できない状態です' }, { status: 400 })
  }

  const before = saleRowSnapshot(sale as Record<string, unknown>)
  const operatedBy = op.displayName || op.email || 'unknown'
  const now = new Date().toISOString()

  const { data: updated, error: upErr } = await supabase
    .from('sales')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by: operatedBy,
      cancel_reason: cancelReason,
    })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (upErr || !updated) {
    return NextResponse.json({ error: upErr?.message || '更新に失敗しました' }, { status: 500 })
  }

  const { error: logErr } = await insertSaleLog({
    saleId: id,
    salonId: op.salonId,
    action: 'cancelled',
    beforeData: before,
    afterData: saleRowSnapshot(updated as Record<string, unknown>),
    operatedBy,
  })

  if (logErr) {
    await supabase
      .from('sales')
      .update({
        status: 'active',
        cancelled_at: null,
        cancelled_by: null,
        cancel_reason: null,
      })
      .eq('id', id)
    return NextResponse.json({ error: '監査ログの記録に失敗しました' }, { status: 500 })
  }

  await supabase.from('customer_product_expiry').delete().eq('sale_id', id)

  return NextResponse.json({ sale: updated })
}
