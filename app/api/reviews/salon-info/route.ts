/**
 * 顧客向け /review ページが使う、サロンの公開情報を返す軽量エンドポイント。
 *  - salon_id クエリ必須（無認証）
 *  - 返すのは name と google_place_id だけ（個人情報なし）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseSalonIdQueryValue } from '@/lib/salon-id-format'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const salonId = parseSalonIdQueryValue(searchParams.get('salon_id'))
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です（有効なUUID）' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    let { data, error } = await supabase
      .from('salons')
      .select('id, name, google_place_id')
      .eq('id', salonId)
      .maybeSingle()

    // 列未適用 DB ではフォールバック
    if (error && String(error.message ?? '').includes('google_place_id')) {
      const retry = await supabase
        .from('salons')
        .select('id, name')
        .eq('id', salonId)
        .maybeSingle()
      data = retry.data as typeof data
      error = retry.error
    }

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'サロンが見つかりません' }, { status: 404 })
    return NextResponse.json({
      salon: {
        id: data.id,
        name: data.name,
        google_place_id: (data as { google_place_id?: string | null }).google_place_id ?? null,
      },
    })
  } catch (e) {
    console.error('[reviews/salon-info] GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
