import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, memo } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'IDとステータスは必須です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('reservations')
      .update({
        status,
        ...(memo !== undefined && { memo }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ reservation: data })
  } catch (error) {
    console.error('予約更新エラー:', error)
    return NextResponse.json({ error: '予約の更新に失敗しました' }, { status: 500 })
  }
}
