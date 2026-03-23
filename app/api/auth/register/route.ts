import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { escapeForIlikeExact, normalizeOwnerEmail } from '@/lib/normalize-owner-email'

/** UI の lite/pro/max → DB の salons.plan CHECK (standard, pro, premium) */
function mapPlanToDb(plan: string | undefined): string {
  const p = (plan || 'pro').toLowerCase()
  if (p === 'lite') return 'standard'
  if (p === 'max') return 'premium'
  if (p === 'pro') return 'pro'
  if (p === 'standard' || p === 'premium') return p
  return 'pro'
}

const cookieOpts = {
  path: '/' as const,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export async function POST(req: Request) {
  try {
    const { salonName, ownerName, email: rawEmail, plan } = await req.json()

    if (!salonName || !ownerName || !rawEmail) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const email = normalizeOwnerEmail(String(rawEmail))
    const supabase = getSupabaseAdmin()

    // 既存サロンチェック（重複防止）
    let { data: existing } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_email', email)
      .limit(1)
      .maybeSingle()
    if (!existing?.id) {
      const { data: legacy } = await supabase
        .from('salons')
        .select('id')
        .ilike('owner_email', escapeForIlikeExact(email))
        .limit(1)
        .maybeSingle()
      existing = legacy
    }

    if (existing) {
      // 既に存在する場合はそのIDを返す
      const response = NextResponse.json({ salon_id: existing.id })
      response.cookies.set('salon_id', existing.id, cookieOpts)
      return response
    }

    // salons テーブルに新規レコード作成（admin clientでRLSバイパス）
    const { data: salonData, error: salonError } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        owner_name: ownerName,
        owner_email: email,
        plan: mapPlanToDb(plan),
        status: 'active',
        beds: ['A'],
      })
      .select('id')
      .single()

    if (salonError) {
      console.error('サロン作成エラー:', salonError.message, salonError.code, salonError.details)
      return NextResponse.json({ error: 'サロン登録に失敗しました: ' + salonError.message }, { status: 500 })
    }

    // cookieにsalon_idをセット
    const response = NextResponse.json({ salon_id: salonData.id })
    response.cookies.set('salon_id', salonData.id, cookieOpts)

    return response
  } catch (error) {
    console.error('登録API エラー:', error)
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }
}
