import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import {
  addDaysToDateString,
  buildProductExpiryLineMessage,
  todayDateString,
} from '@/lib/customer-product-expiry'

export const dynamic = 'force-dynamic'

async function sendLinePush(accessToken: string, lineUserId: string, text: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `LINE送信失敗: ${res.status}`)
  }
}

/** 毎日 JST 9:00 想定（Vercel Cron UTC 0:00） */
export async function GET() {
  const supabase = getSupabaseAdmin()
  const today = todayDateString()
  const limit = addDaysToDateString(today, 14)

  const { data: salons, error: salonsErr } = await supabase
    .from('salons')
    .select('id, line_channel_access_token')
    .not('line_channel_access_token', 'is', null)

  if (salonsErr) {
    return NextResponse.json({ error: salonsErr.message }, { status: 500 })
  }

  const summary: Array<{ salon_id: string; sent: number; skipped: number; errors: string[] }> = []

  for (const salon of salons || []) {
    const salonId = salon.id as string
    const token = salon.line_channel_access_token as string
    const errors: string[] = []
    let sent = 0
    let skipped = 0

    const { data: rows, error: qErr } = await supabase
      .from('customer_product_expiry')
      .select(
        `
        id,
        expires_at,
        products ( name, expiry_alert_days ),
        customers ( name, line_user_id ),
        sales ( status )
      `
      )
      .eq('salon_id', salonId)
      .eq('is_notified', false)
      .lte('expires_at', limit)

    if (qErr) {
      summary.push({ salon_id: salonId, sent: 0, skipped: 0, errors: [qErr.message] })
      continue
    }

    type Rel<T> = T | T[] | null | undefined
    type Raw = {
      id: string
      expires_at: string
      products: Rel<{ name: string; expiry_alert_days?: number | null }>
      customers: Rel<{ name: string; line_user_id: string | null }>
      sales: Rel<{ status: string }>
    }

    const one = <T,>(v: T | T[] | null | undefined): T | null => {
      if (v == null) return null
      return Array.isArray(v) ? v[0] ?? null : v
    }

    for (const r of (rows || []) as unknown as Raw[]) {
      const sale = one(r.sales)
      if (sale?.status !== ACTIVE_SALE_STATUS) {
        skipped += 1
        continue
      }
      const cust = one(r.customers)
      const lineUserId = cust?.line_user_id
      if (!lineUserId) {
        skipped += 1
        continue
      }

      const prod = one(r.products)
      const customerName = cust?.name || 'お客様'
      const productName = prod?.name || '商品'
      const expiresYmd = String(r.expires_at).slice(0, 10)
      const message = buildProductExpiryLineMessage(customerName, productName, expiresYmd)

      try {
        await sendLinePush(token, lineUserId, message)
        const now = new Date().toISOString()
        const { error: upErr } = await supabase
          .from('customer_product_expiry')
          .update({ is_notified: true, line_notified_at: now })
          .eq('id', r.id)
          .eq('salon_id', salonId)
        if (upErr) {
          errors.push(`${r.id}: ${upErr.message}`)
        } else {
          sent += 1
        }
      } catch (e) {
        errors.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    summary.push({ salon_id: salonId, sent, skipped, errors })
  }

  return NextResponse.json({ ok: true, today, limit, summary })
}
