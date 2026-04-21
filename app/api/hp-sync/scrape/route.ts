import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { decryptSecret } from '@/lib/hp-sync/crypto'
import { callScraperService } from '@/lib/hp-sync/scraper-client'
import { importReservation, scrapedToImport } from '@/lib/hp-sync/import'
import { logHpSync, touchLastSyncedAt } from '@/lib/hp-sync/sync-logger'
import { notifyNewReservation, notifySyncError } from '@/lib/hp-sync/line-notify'
import { canScrapeNow, markScraped, humanJitter } from '@/lib/hp-sync/rate-limit'

/**
 * POST /api/hp-sync/scrape
 *
 * Two invocation modes:
 *   1. User-triggered (from Settings page): salonId resolved from cookie.
 *   2. Internal trigger (after email webhook): body.salonId + header
 *      X-Internal-Trigger == HP_INTERNAL_TRIGGER_SECRET.
 *
 * The actual Playwright work runs on an external service —
 * see lib/hp-sync/scraper-client.ts and /scraper-service/.
 */

export const maxDuration = 60

async function resolveSalonId(req: NextRequest, body: Record<string, unknown>): Promise<string | null> {
  const internalSecret = process.env.HP_INTERNAL_TRIGGER_SECRET
  const header = req.headers.get('x-internal-trigger')
  if (internalSecret && header === internalSecret && typeof body.salonId === 'string') {
    return body.salonId
  }
  // Prefer the owner-session resolver; fall back to cookie-only.
  const fromOwner = await resolveSalonIdForOwnerApi(req).catch(() => '')
  if (fromOwner) return fromOwner
  const fromReq = getSalonIdFromApiRequest(req)
  return fromReq || null
}

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine
  }

  const salonId = await resolveSalonId(req, body)
  if (!salonId) return NextResponse.json({ error: 'salon_id missing' }, { status: 400 })

  // Rate limit (5 min minimum between scrapes per salon)
  const gate = await canScrapeNow(salonId)
  if (!gate.ok) {
    await logHpSync({
      salonId,
      source: 'scrape',
      status: 'skipped',
      message: `レート制限のためスキップ（あと${Math.ceil(gate.waitMs / 1000)}秒）`,
    })
    return NextResponse.json({ ok: true, skipped: true, waitMs: gate.waitMs })
  }

  // Load credentials
  const supabase = getSupabaseAdmin()
  const { data: salon } = await supabase
    .from('salons')
    .select('hp_email, hp_password, hp_sync_enabled')
    .eq('id', salonId)
    .maybeSingle()

  if (!salon) return NextResponse.json({ error: 'salon not found' }, { status: 404 })
  if (!salon.hp_sync_enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' })
  }
  const hpEmail = (salon.hp_email as string | null) || ''
  const encPw = (salon.hp_password as string | null) || ''
  const hpPassword = decryptSecret(encPw)
  if (!hpEmail || !hpPassword) {
    await logHpSync({
      salonId,
      source: 'scrape',
      status: 'error',
      message: 'HPログイン情報が設定されていません',
    })
    return NextResponse.json({ ok: false, error: 'credentials missing' }, { status: 400 })
  }

  await markScraped(salonId)
  await humanJitter()

  // Delegate to external scraper
  const scrape = await callScraperService({
    salonId,
    email: hpEmail,
    password: hpPassword,
    daysAhead: 7,
  })

  if (!scrape.ok) {
    await logHpSync({
      salonId,
      source: 'scrape',
      status: 'error',
      message: scrape.error || 'scrape failed',
      details: { loginFailed: !!scrape.loginFailed },
    })
    if (scrape.loginFailed) {
      // Auto-disable sync on login failure (規約/セキュリティ観点)
      await supabase.from('salons').update({ hp_sync_enabled: false }).eq('id', salonId)
      await notifySyncError(salonId, 'HPへのログインに失敗しました。連携を一時停止しました。')
    } else {
      await notifySyncError(salonId, `スクレイピング失敗: ${scrape.error || '不明なエラー'}`)
    }
    return NextResponse.json({ ok: false, error: scrape.error })
  }

  let inserted = 0
  let updated = 0
  let duplicate = 0
  let cancelled = 0
  let errored = 0

  for (const r of scrape.reservations) {
    const result = await importReservation(scrapedToImport(r, salonId))
    if (result.status === 'inserted') {
      inserted++
      await logHpSync({
        salonId,
        source: 'scrape',
        status: 'success',
        message: result.message,
        reservationId: result.reservationId,
        details: { customerName: r.customerName, externalId: r.externalId },
      })
      await notifyNewReservation({
        salonId,
        customerName: r.customerName,
        reservationDate: r.reservationDate,
        startTime: r.startTime,
        menu: r.menu,
        source: 'scrape',
      })
    } else if (result.status === 'updated') {
      updated++
    } else if (result.status === 'cancelled') {
      cancelled++
    } else if (result.status === 'duplicate') {
      duplicate++
    } else if (result.status === 'error') {
      errored++
    }
  }

  await logHpSync({
    salonId,
    source: 'scrape',
    status: errored > 0 ? 'error' : 'success',
    message: `取得${scrape.reservations.length}件（新規${inserted} / 更新${updated} / キャンセル${cancelled} / 重複${duplicate} / エラー${errored}）`,
    details: { inserted, updated, cancelled, duplicate, errored },
  })
  await touchLastSyncedAt(salonId)

  console.log('[hp-sync/scrape] finished', {
    salonId,
    total: scrape.reservations.length,
    inserted,
    updated,
    cancelled,
    duplicate,
    errored,
    ms: Date.now() - started,
  })
  return NextResponse.json({
    ok: true,
    total: scrape.reservations.length,
    inserted,
    updated,
    cancelled,
    duplicate,
    errored,
  })
  } catch (err) {
    console.error('[hp-sync/scrape] fatal error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
