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

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('ticket_plans')
      .select('id, name, menu_name, total_sessions, price, unit_price, expiry_days, is_active, created_at')
      .eq('salon_id', DEMO_SALON_ID)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    const plans = (data || []).map((r: Record<string, unknown>) => toTicketPlan(r))
    return NextResponse.json({ plans })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, menu_name, total_sessions, price, expiry_days } = body

    if (!name || !menu_name || total_sessions == null || price == null) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const totalSessions = Number(total_sessions)
    const priceNum = Number(price)
    const unitPrice = totalSessions > 0 ? Math.round(priceNum / totalSessions) : null

    const { data, error } = await getSupabaseAdmin()
      .from('ticket_plans')
      .insert({
        salon_id: DEMO_SALON_ID,
        name,
        menu_name,
        total_sessions,
        price,
        unit_price: unitPrice,
        expiry_days: expiry_days ?? null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: toTicketPlan(data) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
