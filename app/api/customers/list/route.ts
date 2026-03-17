import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)
    const offset = (page - 1) * limit

    const salonId = getSalonIdFromCookie()

    // sort_kanaカラムがあればそれを使い、なければnameでソート
    let query = getSupabaseAdmin()
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', salonId)
      .order('sort_kana', { ascending: true })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,phone.ilike.%${search}%`)
    }
    if (status) {
      query = query.eq('status', status)
    }

    let { data, error, count } = await query

    // sort_kanaカラムが存在しない場合はnameでフォールバック
    if (error && error.message?.includes('sort_kana')) {
      let fallback = getSupabaseAdmin()
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('salon_id', salonId)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1)

      if (search) {
        fallback = fallback.or(`name.ilike.%${search}%,name_kana.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      if (status) {
        fallback = fallback.eq('status', status)
      }

      const result = await fallback
      data = result.data
      error = result.error
      count = result.count
    }

    if (error) throw error

    return NextResponse.json({ customers: data, total: count, page, limit })
  } catch (error) {
    console.error('顧客一覧取得エラー:', error)
    return NextResponse.json({ error: '顧客データの取得に失敗しました' }, { status: 500 })
  }
}
