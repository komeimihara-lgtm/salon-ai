import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

function toTicketPlan(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    menuName: row.menu_name,
    totalSessions: row.total_sessions,
    price: row.price,
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

    const { data, error } = await getSupabaseAdmin()
      .from('ticket_plans')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
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
