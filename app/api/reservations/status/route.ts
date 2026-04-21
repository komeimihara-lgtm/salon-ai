import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function POST(req: NextRequest) {
  try {
    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'id と status は必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()

    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が取得できません' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: '対象の予約が見つかりません', id, salonId }, { status: 404 })
    }

    return NextResponse.json({ reservation: data[0] })
  } catch (error) {
    console.error('予約ステータス更新エラー:', error)
    return NextResponse.json({ error: '予約ステータスの更新に失敗しました' }, { status: 500 })
  }
}
