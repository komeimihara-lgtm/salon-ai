/**
 * 口コミ管理 API
 *  GET  ?salon_id=...      口コミ一覧
 *  POST                     口コミ（アンケート回答 + 生成・投稿状態）を保存/更新
 *
 * GET はサロンオーナー（cookie の salon_id）から呼ばれる前提だが、
 * クエリで salon_id を明示すればその指定を優先（マルチテナント対応）。
 * POST は顧客からのアンケート回答に使うため body の salon_id を信用する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonTenantId, getSalonIdFromCookie } from '@/lib/get-salon-id'
import { parseSalonIdQueryValue } from '@/lib/salon-id-format'

const SATISFACTION = ['とても満足', '満足', '普通', '不満'] as const
const REVISIT = ['ぜひまた来たい', '検討中', 'わからない'] as const

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const salonId = resolveSalonTenantId(searchParams) || getSalonIdFromCookie()
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    return NextResponse.json({ reviews: data || [] })
  } catch (e) {
    console.error('[reviews] GET', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // POST は顧客からの回答想定。body 内の salon_id を信用する（要 UUID 検証）
    const salonId = parseSalonIdQueryValue(body.salon_id)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です（有効なUUID）' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()

    const insert: Record<string, unknown> = {
      salon_id: salonId,
      customer_id: body.customer_id || null,
      visit_id: body.visit_id || null,
      satisfaction: SATISFACTION.includes(body.satisfaction) ? body.satisfaction : asString(body.satisfaction),
      good_points: asStringArray(body.good_points),
      staff_comment: asString(body.staff_comment),
      revisit_intention: REVISIT.includes(body.revisit_intention) ? body.revisit_intention : asString(body.revisit_intention),
      generated_review: asString(body.generated_review),
      edited_review: asString(body.edited_review),
      is_posted: !!body.is_posted,
      posted_at: body.is_posted ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase.from('reviews').insert(insert).select().single()
    if (error) throw error

    return NextResponse.json({ review: data })
  } catch (e) {
    console.error('[reviews] POST', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
