import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const salonId = getSalonIdFromCookie()

export async function POST(req: Request) {
  try {
    const { to, messages } = await req.json()

    // サロンのLINEトークンを取得
    const supabase = getSupabaseAdmin()
    const { data: salon, error } = await supabase
      .from('salons')
      .select('line_channel_access_token')
      .eq('id', salonId)
      .single()

    if (error || !salon?.line_channel_access_token) {
      return NextResponse.json({ error: 'LINE連携が設定されていません' }, { status: 400 })
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salon.line_channel_access_token}`,
      },
      body: JSON.stringify({ to, messages }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'LINE送信失敗')
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'メッセージ送信に失敗しました' }, { status: 500 })
  }
}
