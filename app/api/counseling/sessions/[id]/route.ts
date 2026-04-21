import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import type { CounselingKartePayload } from '@/lib/counseling-karte-types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const body = (await req.json()) as {
      karte_data?: CounselingKartePayload | Record<string, unknown>
      chat_history?: unknown
      skin_type?: string | null
      allergies?: string | null
      cautions?: string | null
      selected_menu?: string | null
      aria_comment?: string | null
      visit_date?: string | null
    }

    const updates: Record<string, unknown> = {}
    if (body.karte_data != null) updates.karte_data = body.karte_data
    if (body.chat_history != null) updates.chat_history = body.chat_history
    if ('skin_type' in body) updates.skin_type = body.skin_type
    if ('allergies' in body) updates.allergies = body.allergies
    if ('cautions' in body) updates.cautions = body.cautions
    if ('selected_menu' in body) updates.selected_menu = body.selected_menu
    if ('aria_comment' in body) updates.aria_comment = body.aria_comment
    if (body.visit_date != null) updates.visit_date = body.visit_date

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新項目がありません' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('counseling_sessions')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  } catch (e) {
    console.error('[counseling/sessions/id PATCH]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
