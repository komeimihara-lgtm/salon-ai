import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { salonName, ownerName, email, plan } = await req.json()

    if (!salonName || !ownerName || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 既存サロンチェック（重複防止）
    const { data: existing } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_email', email)
      .limit(1)
      .maybeSingle()

    if (existing) {
      // 既に存在する場合はそのIDを返す
      const response = NextResponse.json({ salon_id: existing.id })
      response.cookies.set('salon_id', existing.id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
      return response
    }

    // salons テーブルに新規レコード作成（admin clientでRLSバイパス）
    const { data: salonData, error: salonError } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        owner_name: ownerName,
        owner_email: email,
        plan: plan || 'pro',
        status: 'active',
        beds: '["A"]',
      })
      .select('id')
      .single()

    if (salonError) {
      console.error('サロン作成エラー:', salonError)
      return NextResponse.json({ error: 'サロン登録に失敗しました: ' + salonError.message }, { status: 500 })
    }

    // cookieにsalon_idをセット
    const response = NextResponse.json({ salon_id: salonData.id })
    response.cookies.set('salon_id', salonData.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('登録API エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
