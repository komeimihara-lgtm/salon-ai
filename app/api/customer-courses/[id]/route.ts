import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { remaining_sessions } = body

    const updates: Record<string, unknown> = {}
    if (remaining_sessions !== undefined) updates.remaining_sessions = remaining_sessions

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_courses')
      .update(updates)
      .eq('id', params.id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
      .single()

    if (error) throw error

    const r = data as Record<string, unknown>
    return NextResponse.json({
      course: {
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customer_name,
        coursePackId: r.course_pack_id,
        courseName: r.course_name,
        menuName: r.menu_name,
        totalSessions: r.total_sessions,
        remainingSessions: r.remaining_sessions,
        purchasedAt: r.purchased_at,
        expiryDate: r.expiry_date,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
