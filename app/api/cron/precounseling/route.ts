import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function sendLinePushMessage(accessToken: string, lineUserId: string, message: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `LINE送信失敗: ${res.status}`)
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data: salons, error: salonsErr } = await supabase
    .from('salons')
    .select('id, line_channel_access_token')
    .not('line_channel_access_token', 'is', null)

  if (salonsErr) {
    return NextResponse.json({ error: salonsErr.message }, { status: 500 })
  }

  const target = new Date()
  target.setDate(target.getDate() + 3)
  const targetStr = target.toISOString().slice(0, 10)

  const summary: Array<{ salon_id: string; sent: number; total: number; errors: string[] }> = []

  for (const salon of salons || []) {
    const salonId = salon.id
    const token = salon.line_channel_access_token
    if (!token) continue

    const { data: reservations, error: resErr } = await supabase
      .from('reservations')
      .select('id, customer_name, reservation_date, start_time, end_time, menu, staff_name, customer_id, customers(line_user_id)')
      .eq('salon_id', salonId)
      .eq('reservation_date', targetStr)
      .eq('status', 'confirmed')

    if (resErr) {
      summary.push({ salon_id: salonId, sent: 0, total: 0, errors: [resErr.message] })
      continue
    }

    let sentCount = 0
    const errors: string[] = []

    for (const r of reservations || []) {
      const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers
      const lineUserId = customer?.line_user_id
      if (!lineUserId) continue

      const message = `【ご来店前のご確認】
${r.customer_name}様、こんにちは😊

${r.reservation_date}のご予約まで
あと3日となりました✨

ご来店前に以下をお聞かせください：
・現在のお肌・体調で気になることはありますか？
・前回からの変化はありましたか？

お気軽にこのLINEにご返信ください🌸`

      try {
        await sendLinePushMessage(token, lineUserId, message)
        sentCount++
      } catch (e) {
        errors.push(`${r.customer_name}: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    }

    summary.push({ salon_id: salonId, sent: sentCount, total: (reservations || []).length, errors })
  }

  return NextResponse.json({
    ok: true,
    date: targetStr,
    salons_processed: summary.length,
    summary,
  })
}
