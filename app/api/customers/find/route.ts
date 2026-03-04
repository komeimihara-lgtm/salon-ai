import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name') || ''
    if (!name.trim()) {
      return NextResponse.json({ customers: [] })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .select('id, name')
      .eq('salon_id', DEMO_SALON_ID)
      .or(`name.ilike.%${name.trim()}%,name_kana.ilike.%${name.trim()}%`)
      .limit(10)
    if (error) throw error
    return NextResponse.json({ customers: data || [] })
  } catch (error) {
    console.error('顧客検索エラー:', error)
    return NextResponse.json({ customers: [] })
  }
}
