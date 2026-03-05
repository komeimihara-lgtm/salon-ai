import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

function toTicketPlan(row: Record<string, unknown>) {
  const price = Number(row.price ?? 0)
  const totalSessions = Number(row.total_sessions ?? 0)
  return {
    id: row.id,
    name: row.name,
    menuName: row.menu_name,
    totalSessions,
    price,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : (totalSessions > 0 ? Math.round(price / totalSessions) : 0),
    expiryDays: row.expiry_days,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, menu_name, total_sessions, price, expiry_days, is_active } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (menu_name !== undefined) updates.menu_name = menu_name
    if (total_sessions !== undefined) updates.total_sessions = total_sessions
    if (price !== undefined) updates.price = price
    if (expiry_days !== undefined) updates.expiry_days = expiry_days
    if (is_active !== undefined) updates.is_active = is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    // price または total_sessions が変更された場合、unit_price を再計算
    if (price !== undefined || total_sessions !== undefined) {
      const { data: current } = await getSupabaseAdmin()
        .from('ticket_plans')
        .select('price, total_sessions')
        .eq('id', id)
        .eq('salon_id', DEMO_SALON_ID)
        .single()
      const p = price !== undefined ? Number(price) : Number((current as { price?: number })?.price ?? 0)
      const t = total_sessions !== undefined ? Number(total_sessions) : Number((current as { total_sessions?: number })?.total_sessions ?? 0)
      updates.unit_price = t > 0 ? Math.round(p / t) : null
    }

    const { data, error } = await getSupabaseAdmin()
      .from('ticket_plans')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .select('id, name, menu_name, total_sessions, price, unit_price, expiry_days, is_active, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ plan: toTicketPlan(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await getSupabaseAdmin()
      .from('ticket_plans')
      .update({ is_active: false })
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
