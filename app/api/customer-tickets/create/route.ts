import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/** 顧客登録時のシンプルな回数券追加 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customer_id, remaining_count } = body
    if (!customer_id || !remaining_count || remaining_count <= 0) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const salonId = getSalonIdFromCookie()
    const { data, error } = await getSupabaseAdmin()
      .from('customer_tickets')
      .insert({
        salon_id: salonId,
        customer_id,
        ticket_plan_id: null,
        plan_name: '手動登録',
        menu_name: '',
        total_sessions: remaining_count,
        remaining_sessions: remaining_count,
        purchased_at: new Date().toISOString().slice(0, 10),
        status: 'active',
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (e) {
    console.error('回数券簡易登録エラー:', e)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
