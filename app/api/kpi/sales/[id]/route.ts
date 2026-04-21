import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseAdmin()
  const raw = await req.json()
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const {
    status: _s,
    cancelled_at: _c1,
    cancelled_by: _c2,
    cancel_reason: _c3,
    original_sale_id: _o,
    ...safe
  } = body as Record<string, unknown>
  const { data, error } = await supabase
    .from('sales')
    .update(safe)
    .eq('id', params.id)
    .eq('status', ACTIVE_SALE_STATUS)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '有効な売上が見つかりません' }, { status: 404 })
  return NextResponse.json({ sale: data })
}

/** 物理削除は廃止。取消は POST /api/sales/[id]/cancel を利用してください。 */
export async function DELETE() {
  return NextResponse.json(
    { error: '削除APIは利用できません。売上の取消は /api/sales/[id]/cancel を使用してください。' },
    { status: 405 }
  )
}
