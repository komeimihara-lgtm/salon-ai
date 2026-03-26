import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'
import { extractKarteFromMessages } from '@/lib/counseling-karte-extract'
import type { CounselingKartePayload } from '@/lib/counseling-karte-types'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function summarizeConcerns(k: CounselingKartePayload): string {
  const parts = [
    k.phase2.menu_category,
    k.phase2.symptom,
    k.phase3.expectation,
  ].filter(Boolean)
  return parts.join(' / ') || ''
}

/** customers.counseling_memo に履歴要素を追記（配列想定） */
async function appendCustomerCounselingMemo(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  customerId: string,
  entry: Record<string, unknown>,
) {
  const { data: row, error: selErr } = await supabase
    .from('customers')
    .select('counseling_memo')
    .eq('id', customerId)
    .maybeSingle()
  if (selErr) {
    console.warn('[save-karte] counseling_memo fetch', selErr)
    return
  }
  let memo: unknown[] = []
  const raw = row?.counseling_memo
  if (Array.isArray(raw)) memo = [...raw]
  else if (raw && typeof raw === 'object') memo = [raw]

  memo.push(entry)
  const { error: upErr } = await supabase.from('customers').update({ counseling_memo: memo }).eq('id', customerId)
  if (upErr) console.warn('[save-karte] counseling_memo update', upErr)
}

export async function POST(req: NextRequest) {
  try {
    const salonId = getSalonIdFromApiRequest(req)
    if (!salonId) {
      return NextResponse.json({ error: 'salon_id が必要です' }, { status: 401 })
    }

    const body = (await req.json()) as {
      customer_id?: string | null
      customer_name?: string
      course_name?: string | null
      visit_date?: string | null
      messages?: ChatMessage[]
      session_id?: string | null
      skin_type?: string | null
      allergies?: string | null
      cautions?: string | null
      selected_menu?: string | null
      aria_comment?: string | null
      karte_data?: CounselingKartePayload | null
    }

    const messages = Array.isArray(body.messages) ? body.messages : []
    if (messages.length === 0) {
      return NextResponse.json({ error: 'messages が必要です' }, { status: 400 })
    }

    const visitDate =
      (body.visit_date && /^\d{4}-\d{2}-\d{2}$/.test(body.visit_date) && body.visit_date) ||
      new Date().toISOString().slice(0, 10)

    const karte =
      body.karte_data && typeof body.karte_data === 'object'
        ? { ...body.karte_data, date: visitDate }
        : extractKarteFromMessages(messages, visitDate)

    const supabase = getSupabaseAdmin()

    let resolvedCustomerId = body.customer_id || null
    const cname = body.customer_name || 'お客様'
    if (!resolvedCustomerId && cname) {
      const { data: found } = await supabase
        .from('customers')
        .select('id')
        .eq('salon_id', salonId)
        .eq('name', cname)
        .limit(1)
        .maybeSingle()
      if (found?.id) resolvedCustomerId = found.id
    }

    const chatData = messages
    const concernsText = summarizeConcerns(karte)

    // 既存セッション更新（STEP6 などで肌診断後に追記）
    if (body.session_id) {
      const { data: existing, error: exErr } = await supabase
        .from('counseling_sessions')
        .select('id, salon_id, customer_id')
        .eq('id', body.session_id)
        .eq('salon_id', salonId)
        .maybeSingle()
      if (exErr || !existing) {
        return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
      }
      const rowUpdate: Record<string, unknown> = {
        karte_data: karte,
        chat_history: chatData,
        customer_id: resolvedCustomerId ?? existing.customer_id,
        customer_name: cname,
        concerns: concernsText ? [concernsText] : [],
        visit_date: visitDate,
      }
      if (body.skin_type !== undefined) rowUpdate.skin_type = body.skin_type
      if (body.allergies !== undefined) rowUpdate.allergies = body.allergies
      if (body.cautions !== undefined) rowUpdate.cautions = body.cautions
      if (body.selected_menu !== undefined || body.course_name !== undefined) {
        rowUpdate.selected_menu = body.selected_menu ?? body.course_name
      }
      if (body.aria_comment !== undefined) rowUpdate.aria_comment = body.aria_comment

      const { data: updated, error: upErr } = await supabase
        .from('counseling_sessions')
        .update(rowUpdate)
        .eq('id', body.session_id)
        .select()
        .single()
      if (upErr) {
        console.error('[save-karte] update', upErr)
        return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
      }
      return NextResponse.json({ session: updated, karte_data: karte })
    }

    const { data, error } = await supabase
      .from('counseling_sessions')
      .insert({
        salon_id: salonId,
        customer_id: resolvedCustomerId,
        customer_name: cname,
        mode: 'salon',
        concerns: concernsText ? [concernsText] : [],
        skin_type: body.skin_type || null,
        allergies: body.allergies || null,
        cautions: body.cautions || null,
        selected_menu: body.selected_menu || body.course_name || null,
        aria_comment: body.aria_comment || null,
        chat_history: chatData,
        karte_data: karte,
        visit_date: visitDate,
      })
      .select()
      .single()

    if (error) {
      console.error('[save-karte] insert', error)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }

    if (resolvedCustomerId && data?.id) {
      await appendCustomerCounselingMemo(supabase, resolvedCustomerId, {
        session_id: data.id,
        date: visitDate,
        karte_data: karte,
      })
    }

    return NextResponse.json({ session: data, karte_data: karte })
  } catch (e) {
    console.error('[save-karte]', e)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
