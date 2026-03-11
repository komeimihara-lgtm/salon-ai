import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  const body = await req.json()
  const {
    line_user_id,
    display_name,
    menu_name,
    duration,
    price,
    date,
    start_time,
    end_time,
    staff_name,
    memo,
  } = body

  // 顧客をLINE IDで検索
  let customer = null
  if (line_user_id) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('line_user_id', line_user_id)
      .eq('salon_id', salonId)
      .single()
    customer = data
  }

  // 顧客が未登録の場合は仮登録
  if (!customer && display_name) {
    const { data } = await supabase
      .from('customers')
      .insert({
        salon_id: salonId,
        name: display_name,
        line_user_id: line_user_id || '',
        line_status: 'followed',
        status: 'temporary',
      })
      .select()
      .single()
    customer = data
  }

  // 予約を登録
  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      salon_id: salonId,
      customer_id: customer?.id || null,
      customer_name: customer?.name || display_name || '未登録',
      customer_phone: customer?.phone || '',
      reservation_date: date,
      start_time,
      end_time,
      menu: menu_name,
      staff_name,
      price: price || 0,
      duration_minutes: duration || 60,
      memo: memo || '',
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // LINE確認メッセージ送信
  if (line_user_id && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    try {
      const dateObj = new Date(date + 'T00:00:00')
      const weekdays = ['日', '月', '火', '水', '木', '金', '土']
      const dateLabel = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日（${weekdays[dateObj.getDay()]}）`

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: line_user_id,
          messages: [{
            type: 'text',
            text: `✅ ご予約が確定しました！\n\n📋 ${menu_name}\n📅 ${dateLabel}\n⏰ ${start_time}〜${end_time}\n👤 担当：${staff_name}\n💴 料金：¥${(price ?? 0).toLocaleString()}\n\n${memo ? `📝 ${memo}\n\n` : ''}ご来店をお待ちしております✨\n\n「予約確認」と送っていただくといつでもご予約内容を確認できます😊`
          }]
        })
      })
    } catch (e) {
      console.error('LINE push failed:', e)
    }
  }

  return NextResponse.json({ reservation })
}
