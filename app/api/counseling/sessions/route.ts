import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_id,
      customer_name,
      mode,
      concerns,
      skin_type,
      allergies,
      cautions,
      selected_menu,
      aria_comment,
      chat_history,
    } = body

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('counseling_sessions')
      .insert({
        salon_id: DEMO_SALON_ID,
        customer_id: customer_id || null,
        customer_name: customer_name || 'お客様',
        mode: mode || 'online',
        concerns: concerns || [],
        skin_type: skin_type || null,
        allergies: allergies || null,
        cautions: cautions || null,
        selected_menu: selected_menu || null,
        aria_comment: aria_comment || null,
        chat_history: chat_history || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Counseling session save error:', error)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('Counseling sessions API Error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
