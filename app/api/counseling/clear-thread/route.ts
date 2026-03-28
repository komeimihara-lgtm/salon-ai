import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

/**
 * 新規カウンセリング開始時に、その顧客の counseling_messages を削除する。
 * （画面の会話はクライアント state。DB と行番号ずれを防ぎ、appendCounselingTurn の初回ウェルカム挿入を効かせる）
 */
export async function POST(req: NextRequest) {
  try {
    const salonId = getSalonIdFromApiRequest(req)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
    }

    const body = (await req.json()) as { customer_id?: string }
    const customerId = body.customer_id?.trim()
    if (!customerId) {
      return NextResponse.json({ error: 'customer_id が必要です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: cust, error: custErr } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('salon_id', salonId)
      .maybeSingle()

    if (custErr || !cust) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }

    const { error: delErr } = await supabase.from('counseling_messages').delete().eq('customer_id', customerId)
    if (delErr) {
      console.error('[counseling/clear-thread]', delErr)
      return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[counseling/clear-thread]', e)
    return NextResponse.json({ error: 'リクエストの処理に失敗しました' }, { status: 500 })
  }
}
