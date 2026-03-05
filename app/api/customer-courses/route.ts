import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

function toCustomerCourse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    coursePackId: row.course_pack_id,
    courseName: row.course_name,
    menuName: row.menu_name,
    totalSessions: row.total_sessions,
    remainingSessions: row.remaining_sessions,
    purchasedAt: row.purchased_at,
    expiryDate: row.expiry_date,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')

    let query = getSupabaseAdmin()
      .from('customer_courses')
      .select('id, customer_id, customer_name, course_pack_id, course_name, menu_name, total_sessions, remaining_sessions, purchased_at, expiry_date')
      .eq('salon_id', DEMO_SALON_ID)
      .order('purchased_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw error

    const rows = (data || []).map((r: Record<string, unknown>) => toCustomerCourse(r))
    return NextResponse.json({ courses: rows })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_id,
      customer_name,
      course_pack_id,
      course_name,
      menu_name,
      total_sessions,
      remaining_sessions,
      purchased_at,
      expiry_date,
    } = body

    if (!customer_id || !course_pack_id || !course_name || !menu_name || total_sessions == null || remaining_sessions == null || !purchased_at || !expiry_date) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('customer_courses')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id,
        customer_name: customer_name || '',
        course_pack_id,
        course_name,
        menu_name,
        total_sessions,
        remaining_sessions,
        purchased_at,
        expiry_date,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ course: toCustomerCourse({ ...data, customer_name: customer_name || '' }) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
