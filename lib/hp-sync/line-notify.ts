/**
 * Send a LINE push message to the salon owner when a new reservation
 * arrives from HP sync, or when sync fails.
 *
 * Uses the existing salons.line_channel_access_token + owner LINE user id.
 * If the salon hasn't configured an owner LINE user id we skip silently.
 */

import { getSupabaseAdmin } from '@/lib/supabase'

export interface HpNotifyPayload {
  salonId: string
  customerName?: string | null
  reservationDate?: string | null
  startTime?: string | null
  menu?: string | null
  source?: 'email' | 'scrape' | 'manual'
}

async function pushMessage(
  accessToken: string,
  toUserId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: toUserId,
        messages: [{ type: 'text', text }],
      }),
    })
    return res.ok
  } catch (e) {
    console.error('[hp-sync/line-notify] push failed', e)
    return false
  }
}

async function getNotifyContext(salonId: string) {
  const { data } = await getSupabaseAdmin()
    .from('salons')
    .select('line_channel_access_token, owner_line_user_id')
    .eq('id', salonId)
    .maybeSingle()

  const token = (data as { line_channel_access_token?: string } | null)?.line_channel_access_token
  const ownerId = (data as { owner_line_user_id?: string } | null)?.owner_line_user_id
  return { token: token || '', ownerId: ownerId || '' }
}

export async function notifyNewReservation(p: HpNotifyPayload): Promise<void> {
  const { token, ownerId } = await getNotifyContext(p.salonId)
  if (!token || !ownerId) return

  const text =
    `📅 HPから新規予約が入りました！\n` +
    `👤 顧客名：${p.customerName || '不明'}様\n` +
    `🕐 日時：${p.reservationDate || '不明'} ${p.startTime || ''}\n` +
    `💆 メニュー：${p.menu || '不明'}\n\n` +
    `SOLAで確認してください。`

  await pushMessage(token, ownerId, text)
}

export async function notifySyncError(salonId: string, message: string): Promise<void> {
  const { token, ownerId } = await getNotifyContext(salonId)
  if (!token || !ownerId) return
  await pushMessage(
    token,
    ownerId,
    `⚠️ HP連携でエラーが発生しました\n${message}\n\n設定画面から再度ログイン情報をご確認ください。`
  )
}
