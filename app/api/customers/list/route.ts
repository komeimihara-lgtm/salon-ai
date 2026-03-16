import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 顧客ステータスの自動判定を実行（非同期・失敗時は無視）
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await fetch(`${appUrl}/api/customers/update-status`, { method: 'POST' }).catch(() => {})

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)
    const offset = (page - 1) * limit

    let query = getSupabaseAdmin()
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('salon_id', getSalonIdFromCookie())
      .order('name', { ascending: true })
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
