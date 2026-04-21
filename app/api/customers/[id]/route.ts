import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'

const PATCH_KEYS = [
  'name',
  'name_kana',
  'phone',
  'email',
  'address',
  'birthday',
  'gender',
  'memo',
  'first_visit_date',
  'last_visit_date',
  'visit_count',
  'status',
  'line_user_id',
  'line_status',
] as const

const GENDERS = new Set(['female', 'male', 'other', 'unknown'])

function pickCustomerUpdates(body: Record<string, unknown>): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  for (const key of PATCH_KEYS) {
    if (!(key in body)) continue
    const v = body[key]
    if (key === 'visit_count') {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10)
      if (!Number.isFinite(n) || n < 0) continue
      updates[key] = n
      continue
    }
    if (key === 'gender') {
      const s = typeof v === 'string' ? v : ''
      if (GENDERS.has(s)) updates[key] = s
      continue
    }
    if (v === null) {
      updates[key] = null
      continue
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      updates[key] = v
    }
  }
  return updates
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('salon_id', salonId)
      .single()
    if (error || !data) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('顧客取得エラー:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>
    const updates = pickCustomerUpdates(body)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '更新できる項目がありません' }, { status: 400 })
    }
    const { data, error } = await getSupabaseAdmin()
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ customer: data })
  } catch (error) {
    console.error('顧客更新エラー:', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    const { id } = await params
    const { error } = await getSupabaseAdmin()
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('salon_id', salonId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('顧客削除エラー:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
