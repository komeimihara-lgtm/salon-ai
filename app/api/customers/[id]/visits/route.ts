import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('visits')
      .select('*')
      .eq('customer_id', params.id)
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
      .insert({ ...body, customer_id: params.id })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ visit: data })
  } catch (error) {
    console.error('施術履歴登録エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
