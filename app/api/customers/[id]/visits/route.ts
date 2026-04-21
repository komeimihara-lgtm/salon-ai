import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

async function recalcCustomerStats(customerId: string, salonId: string) {
  const supabase = getSupabaseAdmin()
  const { data: allVisits } = await supabase
    .from('visits')
    .select('visit_date, amount')
    .eq('customer_id', customerId)
    .eq('salon_id', salonId)
    .order('visit_date', { ascending: false })

  const visits = allVisits || []
  const visit_count = visits.length
  const total_spent = visits.reduce((sum, v) => sum + (v.amount || 0), 0)
  const avg_unit_price = visit_count > 0 ? Math.round(total_spent / visit_count) : 0
  const last_visit_date = visits.length > 0 ? visits[0].visit_date : null

  await supabase
    .from('customers')
    .update({ visit_count, total_spent, avg_unit_price, last_visit_date })
    .eq('id', customerId)
    .eq('salon_id', salonId)
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('visits')
      .select('*')
      .eq('customer_id', params.id)
      .eq('salon_id', getSalonIdFromCookie())
      .order('visit_date', { ascending: false })
    if (error) throw error
    return NextResponse.json({ visits: data || [] })
  } catch (error) {
    console.error('施術履歴取得エラー:', error)
    return NextResponse.json({ visits: [] })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salonId = getSalonIdFromCookie()
    const body = await req.json()
    const { data, error } = await getSupabaseAdmin()
      .from('visits')
      .insert({ ...body, customer_id: params.id, salon_id: salonId })
      .select()
      .single()
    if (error) throw error
    await recalcCustomerStats(params.id, salonId)
    return NextResponse.json({ visit: data })
  } catch (error) {
    console.error('施術履歴登録エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salonId = getSalonIdFromCookie()
    const body = await req.json()
    const { visitId, ...updates } = body
    if (!visitId) {
      return NextResponse.json({ error: 'visitId is required' }, { status: 400 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('visits')
      .update(updates)
      .eq('id', visitId)
      .eq('customer_id', params.id)
      .eq('salon_id', salonId)
      .select()
      .single()
    if (error) throw error
    await recalcCustomerStats(params.id, salonId)
    return NextResponse.json({ visit: data })
  } catch (error) {
    console.error('施術履歴更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const salonId = getSalonIdFromCookie()
    const { searchParams } = new URL(req.url)
    const visitId = searchParams.get('visitId')
    if (!visitId) {
      return NextResponse.json({ error: 'visitId is required' }, { status: 400 })
    }
    const { error } = await getSupabaseAdmin()
      .from('visits')
      .delete()
      .eq('id', visitId)
      .eq('customer_id', params.id)
      .eq('salon_id', salonId)
    if (error) throw error
    await recalcCustomerStats(params.id, salonId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('施術履歴削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
