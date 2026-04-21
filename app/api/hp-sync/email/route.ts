import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseReservationEmail } from '@/lib/hp-sync/parser'
import { importReservation, parsedToImport } from '@/lib/hp-sync/import'
import { logHpSync, touchLastSyncedAt } from '@/lib/hp-sync/sync-logger'
import { notifyNewReservation } from '@/lib/hp-sync/line-notify'

/**
 * Resend inbound email webhook.
 *
 * Expected body (Resend inbound email schema):
 *   {
 *     "type": "email.received",
 *     "data": {
 *       "from": { "address": "...@beauty.hotpepper.jp" },
 *       "to":   [{ "address": "sync-<salonId>@sola-ai.jp" }],
 *       "subject": "...",
 *       "text": "...",
 *       "html": "..."
 *     }
 *   }
 *
 * The routing address (to[0]) is the source of truth for salonId.
 * Auth is enforced via RESEND_WEBHOOK_SECRET header (X-Webhook-Secret).
 *
 * After parsing & importing, we fire-and-forget the scrape endpoint so
 * the two systems can reconcile the same reservation.
 */

export const maxDuration = 60

function unauthorized(msg = 'unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const header = req.headers.get('x-webhook-secret') || req.headers.get('authorization') || ''
    if (!header.includes(secret)) {
      console.warn('[hp-sync/email] unauthorized webhook call')
      return unauthorized()
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // Extract the routing address (supports Resend inbound + generic shapes)
  const data = (body.data as Record<string, unknown> | undefined) ?? body
  const toArr = (data.to as Array<{ address?: string }> | string | undefined) ?? undefined
  const toAddress =
    (Array.isArray(toArr) ? toArr[0]?.address : typeof toArr === 'string' ? toArr : '') || ''
  const emailText = String(data.text || data.html || data.body || '')

  if (!toAddress || !emailText) {
    return NextResponse.json({ error: 'missing to or body' }, { status: 400 })
  }

  // Look up salon by sync email
  const supabase = getSupabaseAdmin()
  const { data: salon } = await supabase
    .from('salons')
    .select('id, hp_sync_enabled')
    .eq('hp_sync_email', toAddress.toLowerCase())
    .maybeSingle()

  if (!salon) {
    return NextResponse.json({ error: 'no salon for that address' }, { status: 404 })
  }
  const salonId = salon.id as string
  if (!salon.hp_sync_enabled) {
    await logHpSync({
      salonId,
      source: 'email',
      status: 'skipped',
      message: 'HP連携がOFFのためスキップ',
    })
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Parse via Claude
  const parsed = await parseReservationEmail(emailText)
  if (parsed.confidence < 0.3 || !parsed.reservationDate) {
    await logHpSync({
      salonId,
      source: 'email',
      status: 'error',
      message: 'メール本文から予約を抽出できませんでした',
      details: { confidence: parsed.confidence },
    })
    return NextResponse.json({ ok: false, reason: 'low_confidence' })
  }

  const result = await importReservation(parsedToImport(parsed, salonId))

  await logHpSync({
    salonId,
    source: 'email',
    status:
      result.status === 'inserted' || result.status === 'updated' || result.status === 'cancelled'
        ? 'success'
        : result.status === 'duplicate'
          ? 'duplicate'
          : result.status === 'skipped'
            ? 'skipped'
            : 'error',
    message: result.message,
    reservationId: result.reservationId,
    details: {
      eventType: parsed.eventType,
      externalId: parsed.externalId,
      customerName: parsed.customerName,
    },
  })
  await touchLastSyncedAt(salonId)

  if (result.status === 'inserted') {
    await notifyNewReservation({
      salonId,
      customerName: parsed.customerName,
      reservationDate: parsed.reservationDate,
      startTime: parsed.startTime,
      menu: parsed.menu,
      source: 'email',
    })
  }

  // Fire-and-forget a scrape pass so both sources reconcile.
  // We don't await it — the email response must stay fast.
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  if (base) {
    fetch(`${base}/api/hp-sync/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Trigger': process.env.HP_INTERNAL_TRIGGER_SECRET || '',
      },
      body: JSON.stringify({ salonId, triggeredBy: 'email' }),
    }).catch(() => {})
  }

  console.log('[hp-sync/email] processed', {
    salonId,
    status: result.status,
    ms: Date.now() - started,
  })
  return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[hp-sync/email] fatal error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
