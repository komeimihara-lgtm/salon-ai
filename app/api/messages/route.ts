import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const salonId = getSalonIdFromCookie()
    const supabase = getSupabaseAdmin()

    // LINE連携済みの顧客を取得
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, line_user_id')
      .eq('salon_id', salonId)
      .neq('line_user_id', '')
      .not('line_user_id', 'is', null)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!customers || customers.length === 0) {
      return NextResponse.json({ customers: [] })
    }

    // 各顧客の未読数・最終メッセージを取得
    const customerIds = customers.map(c => c.id)

    // 未読数を集計
    const { data: unreadCounts } = await supabase
      .from('line_messages')
      .select('customer_id')
      .eq('salon_id', salonId)
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .in('customer_id', customerIds)

    const unreadMap: Record<string, number> = {}
    for (const row of unreadCounts || []) {
      if (row.customer_id) {
        unreadMap[row.customer_id] = (unreadMap[row.customer_id] || 0) + 1
      }
    }

    // 最終メッセージを取得（各顧客の最新1件）
    const { data: lastMessages } = await supabase
      .from('line_messages')
      .select('customer_id, message, sent_at')
      .eq('salon_id', salonId)
      .in('customer_id', customerIds)
      .order('sent_at', { ascending: false })

    const lastMsgMap: Record<string, { message: string; sent_at: string }> = {}
    for (const msg of lastMessages || []) {
      if (msg.customer_id && !lastMsgMap[msg.customer_id]) {
        lastMsgMap[msg.customer_id] = { message: msg.message, sent_at: msg.sent_at }
      }
    }

    const result = customers.map(c => ({
      id: c.id,
      name: c.name,
      line_user_id: c.line_user_id,
      unread_count: unreadMap[c.id] || 0,
      last_message: lastMsgMap[c.id]?.message || null,
      last_message_at: lastMsgMap[c.id]?.sent_at || null,
    }))

    // 未読があるものを先に、その後最終メッセージ日時順
    result.sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1
      if (a.unread_count === 0 && b.unread_count > 0) return 1
      if (a.last_message_at && b.last_message_at) {
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      }
      if (a.last_message_at) return -1
      if (b.last_message_at) return 1
      return 0
    })

    return NextResponse.json({ customers: result })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'メッセージ一覧取得失敗' }, { status: 500 })
  }
}
