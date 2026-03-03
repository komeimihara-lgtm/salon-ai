import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    let query = getSupabaseAdmin()
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', DEMO_SALON_ID)
      .order('last_visit_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,phone.ilike.%${search}%`)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ customers: data, total: count, page, limit })
  } catch (error) {
    console.error('顧客一覧取得エラー:', error)
    return NextResponse.json({ error: '顧客データの取得に失敗しました' }, { status: 500 })
  }
}
