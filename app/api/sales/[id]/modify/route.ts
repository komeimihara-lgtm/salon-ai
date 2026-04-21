import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonSaleOperator, canModifySale } from '@/lib/salon-sale-operator'
import { insertSaleLog, saleRowSnapshot } from '@/lib/sale-audit'
import { overwriteSaleCustomerNamesFromDb } from '@/lib/sale-customer-display'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const oldId = params.id
  const op = await getSalonSaleOperator(req)
  if (!op.salonId) {
    return NextResponse.json({ error: 'salon_id がありません' }, { status: 400 })
  }
  if (!op.email) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canModifySale(op.role)) {
    return NextResponse.json({ error: 'オーナーのみ修正できます' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const supabase = getSupabaseAdmin()
  const { data: sale, error: fetchErr } = await supabase.from('sales').select('*').eq('id', oldId).maybeSingle()
  if (fetchErr || !sale) {
    return NextResponse.json({ error: '売上が見つかりません' }, { status: 404 })
  }
  if (sale.salon_id !== op.salonId) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  if (sale.status !== 'active') {
    return NextResponse.json({ error: '修正できない状態です' }, { status: 400 })
  }

  const operatedBy = op.displayName || op.email || 'unknown'
  const snap = sale as Record<string, unknown>

  const amount = body.amount != null ? Number(body.amount) : Number(snap.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: '金額が不正です' }, { status: 400 })
  }

  const newRow = {
    salon_id: snap.salon_id,
    sale_date: typeof body.sale_date === 'string' ? body.sale_date : snap.sale_date,
    amount,
    customer_id: body.customer_id !== undefined ? body.customer_id : snap.customer_id,
    customer_name: body.customer_name !== undefined ? body.customer_name : snap.customer_name,
    menu: body.menu !== undefined ? body.menu : snap.menu,
    staff_name: body.staff_name !== undefined ? body.staff_name : snap.staff_name,
    payment_method: body.payment_method !== undefined ? body.payment_method : snap.payment_method ?? 'cash',
    memo: body.memo !== undefined ? body.memo : snap.memo,
    sale_type: body.sale_type !== undefined ? body.sale_type : snap.sale_type ?? 'cash',
    ticket_id: body.ticket_id !== undefined ? body.ticket_id : snap.ticket_id ?? null,
    product_id: body.product_id !== undefined ? body.product_id : snap.product_id ?? null,
    status: 'active' as const,
    original_sale_id: oldId,
  }

  await overwriteSaleCustomerNamesFromDb(supabase, op.salonId, [newRow as Record<string, unknown>])

  const modifyNote =
    typeof body.modify_reason === 'string' && body.modify_reason.trim()
      ? body.modify_reason.trim()
      : '売上修正（差し替え）'

  const { data: created, error: insErr } = await supabase.from('sales').insert(newRow).select().single()
  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message || '新規売上の作成に失敗しました' }, { status: 500 })
  }

  const now = new Date().toISOString()
  const { data: oldUpdated, error: upErr } = await supabase
    .from('sales')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by: operatedBy,
      cancel_reason: modifyNote,
    })
    .eq('id', oldId)
    .eq('status', 'active')
    .select()
    .maybeSingle()

  if (upErr || !oldUpdated) {
    await supabase.from('sales').delete().eq('id', (created as { id: string }).id)
    return NextResponse.json({ error: upErr?.message || '元売上の取消に失敗しました' }, { status: 500 })
  }

  const beforeOld = saleRowSnapshot(snap)
  const log1 = await insertSaleLog({
    saleId: oldId,
    salonId: op.salonId,
    action: 'modified',
    beforeData: beforeOld,
    afterData: saleRowSnapshot(oldUpdated as Record<string, unknown>),
    operatedBy,
  })
  const log2 = await insertSaleLog({
    saleId: (created as { id: string }).id,
    salonId: op.salonId,
    action: 'created',
    beforeData: null,
    afterData: saleRowSnapshot(created as Record<string, unknown>),
    operatedBy,
  })

  if (log1.error || log2.error) {
    await supabase.from('sales').delete().eq('id', (created as { id: string }).id)
    await supabase
      .from('sales')
      .update({
        status: 'active',
        cancelled_at: null,
        cancelled_by: null,
        cancel_reason: null,
      })
      .eq('id', oldId)
    return NextResponse.json({ error: '監査ログの記録に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ sale: created, previous_sale_id: oldId })
}
