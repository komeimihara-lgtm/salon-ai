import { NextRequest, NextResponse } from 'next/server'
import { getSalonIdFromCookie } from '@/lib/get-salon-id'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_SALE_STATUS } from '@/lib/sales-active-filter'
import { buildProductExpiryLineMessage } from '@/lib/customer-product-expiry'

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const salonId = getSalonIdFromCookie()
  if (!salonId) {
    return NextResponse.json({ error: 'サロン未選択です' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const { data: row, error: fetchErr } = await supabase
    .from('customer_product_expiry')
    .select(
      `
      id,
      salon_id,
      expires_at,
      is_notified,
      products ( name ),
      customers ( name, line_user_id ),
      sales ( status )
    `
    )
    .eq('id', id)
    .eq('salon_id', salonId)
    .maybeSingle()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'レコードが見つかりません' }, { status: 404 })
  }

  const salesStatus = (row as { sales?: { status?: string } | null }).sales?.status
  if (salesStatus !== ACTIVE_SALE_STATUS) {
    return NextResponse.json({ error: '対象の売上が有効ではありません' }, { status: 400 })
  }

  const lineUserId = (row as { customers?: { line_user_id?: string | null } | null }).customers?.line_user_id
  if (!lineUserId) {
    return NextResponse.json({ error: '顧客がLINE連携されていません' }, { status: 400 })
  }

  const { data: salon, error: salonErr } = await supabase
    .from('salons')
    .select('line_channel_access_token')
    .eq('id', salonId)
    .maybeSingle()

  if (salonErr || !salon?.line_channel_access_token) {
    return NextResponse.json({ error: 'LINE連携が設定されていません' }, { status: 400 })
  }

  const customerName = (row as { customers?: { name?: string } | null }).customers?.name || 'お客様'
  const productName = (row as { products?: { name?: string } | null }).products?.name || '商品'
  const expiresAt = String((row as { expires_at: string }).expires_at).slice(0, 10)
  const message = buildProductExpiryLineMessage(customerName, productName, expiresAt)

  try {
    await sendLinePush(salon.line_channel_access_token as string, lineUserId, message)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'LINE送信に失敗しました' }, { status: 502 })
  }

  const now = new Date().toISOString()
  const { error: upErr } = await supabase
    .from('customer_product_expiry')
    .update({ is_notified: true, line_notified_at: now })
    .eq('id', id)
    .eq('salon_id', salonId)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, line_notified_at: now })
}
