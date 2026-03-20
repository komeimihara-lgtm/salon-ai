import { getSalonIdFromCookie, resolveSalonTenantId } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const salonId = resolveSalonTenantId(searchParams)
  if (!salonId) {
    return NextResponse.json({ error: 'salon_id が必要です（ログインするか、LIFF用 salon_id クエリを付与）' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menus: data || [] })
}

export async function POST(req: NextRequest) {
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const body = await req.json()

  // 一括インポート対応
  if (Array.isArray(body)) {
    const records = body.map((m, i) => ({
      salon_id: salonId,
      name: m.name,
      duration: m.duration || 60,
      price: m.price || 0,
      category: m.category || '',
      sort_order: i,
    }))
    const { data, error } = await supabase
      .from('menus')
      .insert(records)
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ menus: data })
  }

  const { name, duration, price, category } = body
  const { data, error } = await supabase
    .from('menus')
    .insert({ salon_id: salonId, name, duration: duration || 60, price: price || 0, category: category || '' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menu: data })
}
