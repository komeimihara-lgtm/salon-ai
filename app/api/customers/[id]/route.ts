import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .select('*')
      .eq('id', params.id)
      .eq('salon_id', DEMO_SALON_ID)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('顧客取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .update(body)
      .eq('id', params.id)
      .eq('salon_id', DEMO_SALON_ID)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('顧客更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
