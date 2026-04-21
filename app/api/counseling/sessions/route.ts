import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')
    if (!customerId) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()
    const { data, error } = await supabase
      .from('counseling_sessions')
      .select('*')
      .eq('salon_id', salonId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ sessions: data || [] })
  } catch (error) {
    console.error('Counseling sessions GET error:', error)
    return NextResponse.json({ sessions: [] })
  }
}

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
      course_name,
      messages,
    } = body

    const supabase = getSupabaseAdmin()
    const salonId = getSalonIdFromCookie()

    // customer_idがなければcustomer_nameで顧客を検索
    let resolvedCustomerId = customer_id || null
    if (!resolvedCustomerId && customer_name) {
      const { data: found } = await supabase
        .from('customers')
        .select('id')
        .eq('salon_id', salonId)
        .eq('name', customer_name)
        .limit(1)
        .single()
      if (found) resolvedCustomerId = found.id
    }

    // カウンセリングセッション保存
    const chatData = messages || chat_history || []
    const userMessages = chatData
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { content: string }) => m.content)
    const concernsText = typeof concerns === 'string'
      ? concerns
      : Array.isArray(concerns)
        ? concerns.join('、')
        : userMessages.slice(0, 3).join('、')

    const { data, error } = await supabase
      .from('counseling_sessions')
      .insert({
        salon_id: salonId,
        customer_id: resolvedCustomerId,
        customer_name: customer_name || 'お客様',
        mode: mode || 'salon',
        concerns: Array.isArray(concerns) ? concerns : concernsText ? [concernsText] : [],
        skin_type: skin_type || null,
        allergies: allergies || null,
        cautions: cautions || null,
        selected_menu: selected_menu || course_name || null,
        aria_comment: aria_comment || null,
        chat_history: chatData,
      })
      .select()
      .single()

    if (error) {
      console.error('Counseling session save error:', error)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }

    // 顧客が見つかった場合、memoにカウンセリングサマリーを追記
    if (resolvedCustomerId) {
      const date = new Date().toLocaleDateString('ja-JP')
      const summary = [
        `【カウンセリング ${date}】`,
        course_name ? `コース: ${course_name}` : null,
        concernsText ? `お悩み: ${concernsText}` : null,
      ].filter(Boolean).join('\n')

      const { data: customer } = await supabase
        .from('customers')
        .select('memo')
        .eq('id', resolvedCustomerId)
        .single()

      const existingMemo = customer?.memo || ''
      const newMemo = existingMemo
        ? `${existingMemo}\n\n${summary}`
        : summary

      await supabase
        .from('customers')
        .update({ memo: newMemo })
        .eq('id', resolvedCustomerId)
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('Counseling sessions API Error:', error)
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
  }
}
