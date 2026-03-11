import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('staff')
      .update(body)
      .eq('id', id)
      .eq('salon_id', salonId)
      .select('id, name, color')
      .single()
    if (error) throw error
    return NextResponse.json({ staff: { id: data.id, name: data.name, color: data.color } })
  } catch (e) {
    console.error('スタッフ更新エラー:', e)
    return NextResponse.json({ error: 'スタッフの更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', id)
      .eq('salon_id', salonId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('スタッフ削除エラー:', e)
    return NextResponse.json({ error: 'スタッフの削除に失敗しました' }, { status: 500 })
  }
}
