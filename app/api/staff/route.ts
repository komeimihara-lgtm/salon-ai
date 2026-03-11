import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, color, is_active')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) throw error
    const staff = (data || []).map(s => ({ id: s.id, name: s.name, color: s.color || '#C4728A' }))
    return NextResponse.json({ staff })
  } catch (e) {
    console.error('スタッフ取得エラー:', e)
    return NextResponse.json({ error: 'スタッフの取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, color } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('staff')
      .insert({ salon_id: salonId, name: name.trim(), color: color || '#C4728A' })
      .select('id, name, color')
      .single()
    if (error) throw error
    return NextResponse.json({ staff: { id: data.id, name: data.name, color: data.color } })
  } catch (e) {
    console.error('スタッフ登録エラー:', e)
    return NextResponse.json({ error: 'スタッフの登録に失敗しました' }, { status: 500 })
  }
}
