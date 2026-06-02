/**
 * 個別口コミの更新（PATCH）/ 削除（DELETE）
 * - サロンオーナー側からの返信文保存・既読化など
 * - 顧客側からの edited_review / is_posted 更新（ID 知っていれば可）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

const ALLOWED_FIELDS = [
  'edited_review',
  'is_posted',
  'reply_text',
  'is_read',
] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json()

    const updates: Record<string, unknown> = {}
    for (const k of ALLOWED_FIELDS) {
      if (body[k] !== undefined) updates[k] = body[k]
    }

    // posted_at / replied_at を自動補完
    if (body.is_posted === true && !body.posted_at) {
      updates.posted_at = new Date().toISOString()
    }
    if (typeof body.reply_text === 'string' && body.reply_text.trim().length > 0) {
      updates.replied_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新する項目がありません' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    // サロンオーナー側からの呼び出しなら salon_id 一致条件を入れる
    // 顧客側（無認証）からは body.salon_id が必要（IDだけでは編集できないように）
    const salonIdFromCookie = getSalonIdFromCookie()
    let q = supabase.from('reviews').update(updates).eq('id', id)
    if (salonIdFromCookie) {
      q = q.eq('salon_id', salonIdFromCookie)
    } else if (body.salon_id) {
      q = q.eq('salon_id', body.salon_id)
    } else {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
    }

    const { data, error } = await q.select().single()
    if (error) throw error
    return NextResponse.json({ review: data })
  } catch (e) {
    console.error('[reviews] PATCH', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const salonId = getSalonIdFromCookie()
    if (!salonId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { id } = params
    const { error } = await getSupabaseAdmin()
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[reviews] DELETE', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
