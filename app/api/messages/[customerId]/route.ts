import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params
    const supabase = getSupabaseAdmin()

    // メッセージ履歴を取得
    const { data: messages, error } = await supabase
      .from('line_messages')
      .select('id, direction, message, auto_type, sent_at')
      .eq('salon_id', salonId)
      .eq('customer_id', customerId)
      .order('sent_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 未読を既読にする
    await supabase
      .from('line_messages')
      .update({ is_read: true })
      .eq('salon_id', salonId)
      .eq('customer_id', customerId)
      .eq('direction', 'inbound')
      .eq('is_read', false)

    return NextResponse.json({ messages: messages || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'メッセージ取得失敗' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params
    const { message } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'メッセージが空です' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 顧客のline_user_idを取得
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, line_user_id')
      .eq('id', customerId)
      .eq('salon_id', salonId)
      .single()

    if (customerError || !customer?.line_user_id) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }

    // サロンのLINEアクセストークンを取得
    const { data: salon } = await supabase
      .from('salons')
      .select('line_channel_access_token')
      .eq('id', salonId)
      .single()

    if (!salon?.line_channel_access_token) {
      return NextResponse.json({ error: 'LINEアクセストークン未設定' }, { status: 400 })
    }

    // LINE Push Message送信
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${salon.line_channel_access_token}`,
      },
      body: JSON.stringify({
        to: customer.line_user_id,
        messages: [{ type: 'text', text: message.trim() }],
      }),
    })

    if (!lineRes.ok) {
      const errBody = await lineRes.text()
      console.error('LINE Push失敗:', errBody)
      return NextResponse.json({ error: 'LINE送信失敗' }, { status: 500 })
    }

    // DBに保存
    const { data: saved, error: saveError } = await supabase
      .from('line_messages')
      .insert({
        salon_id: salonId,
        customer_id: customerId,
        line_user_id: customer.line_user_id,
        direction: 'outbound',
        message: message.trim(),
        auto_type: null,
        is_read: true,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) {
      console.error('メッセージ保存失敗:', saveError)
      return NextResponse.json({ error: 'メッセージ保存失敗' }, { status: 500 })
    }

    return NextResponse.json({ message: saved })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'メッセージ送信失敗' }, { status: 500 })
  }
}
