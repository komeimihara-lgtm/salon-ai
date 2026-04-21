import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

/** 顧客の回数券追加（手動登録・既存コース登録対応） */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customer_id, remaining_count, plan_name, menu_name, expiry_date, is_existing } = body
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
        plan_name: plan_name || '手動登録',
        menu_name: menu_name || '',
        total_sessions: remaining_count,
        remaining_sessions: remaining_count,
        purchased_at: new Date().toISOString().slice(0, 10),
        expiry_date: expiry_date || null,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) throw error

    // 既存コース登録の場合は売上計上しない（is_existing=true）
    // 通常の購入の場合もここでは売上計上しない（別途購入フローで計上済み）

    return NextResponse.json({ ok: true, id: data?.id, is_existing: !!is_existing })
  } catch (e) {
    console.error('回数券登録エラー:', e)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
