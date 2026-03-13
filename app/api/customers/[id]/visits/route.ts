import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

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
    const body = await req.json()
    const { data, error } = await getSupabaseAdmin()
      .from('visits')
      .insert({ ...body, customer_id: params.id, salon_id: getSalonIdFromCookie() })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ visit: data })
  } catch (error) {
    console.error('施術履歴登録エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
