import { NextRequest, NextResponse } from 'next/server'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { getSupabaseAdmin } from '@/lib/supabase'
import { decryptSecret } from '@/lib/hp-sync/crypto'
import { callScraperService } from '@/lib/hp-sync/scraper-client'
import { importReservation, scrapedToImport } from '@/lib/hp-sync/import'
import { logHpSync, touchLastSyncedAt } from '@/lib/hp-sync/sync-logger'
import { notifyNewReservation, notifySyncError } from '@/lib/hp-sync/line-notify'
import { markScraped, humanJitter } from '@/lib/hp-sync/rate-limit'

/**
 * POST /api/hp-sync/manual
 *   "今すぐ同期" button in the Settings page.
 *   Bypasses the 5-minute rate limit (user-initiated), but still
 *   updates markScraped so a follow-up auto-scrape is paused.
 */

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const started = Date.now()
  try {
  const salonId = await resolveSalonIdForOwnerApi(req)
  if (!salonId) return NextResponse.json({ error: 'salon_id missing' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: salon } = await supabase
    .from('salons')
    .select('hp_email, hp_password, hp_sync_enabled')
    .eq('id', salonId)
    .maybeSingle()

  if (!salon) return NextResponse.json({ error: 'salon not found' }, { status: 404 })
  if (!salon.hp_sync_enabled) {
    return NextResponse.json({ error: 'HP連携がOFFです' }, { status: 400 })
  }

  const hpEmail = (salon.hp_email as string | null) || ''
  const hpPassword = decryptSecret((salon.hp_password as string | null) || '')
  if (!hpEmail || !hpPassword) {
    return NextResponse.json({ error: 'HPログイン情報が未設定です' }, { status: 400 })
  }

  await markScraped(salonId)
  await humanJitter()

  const scrape = await callScraperService({
    salonId,
    email: hpEmail,
    password: hpPassword,
    daysAhead: 7,
  })

  if (!scrape.ok) {
    await logHpSync({
      salonId,
      source: 'manual',
      status: 'error',
      message: scrape.error || '同期に失敗しました',
      details: { loginFailed: !!scrape.loginFailed },
    })
    if (scrape.loginFailed) {
      await supabase.from('salons').update({ hp_sync_enabled: false }).eq('id', salonId)
      await notifySyncError(salonId, 'HPへのログインに失敗しました。連携を一時停止しました。')
    }
    return NextResponse.json({ ok: false, error: scrape.error }, { status: 500 })
  }

  let inserted = 0
  let updated = 0
  let duplicate = 0
  let cancelled = 0
  let errored = 0

  for (const r of scrape.reservations) {
    const res = await importReservation(scrapedToImport(r, salonId))
    if (res.status === 'inserted') {
      inserted++
      await notifyNewReservation({
        salonId,
        customerName: r.customerName,
        reservationDate: r.reservationDate,
        startTime: r.startTime,
        menu: r.menu,
        source: 'manual',
      })
    } else if (res.status === 'updated') updated++
    else if (res.status === 'cancelled') cancelled++
    else if (res.status === 'duplicate') duplicate++
    else if (res.status === 'error') errored++
  }

  await logHpSync({
    salonId,
    source: 'manual',
    status: errored > 0 ? 'error' : 'success',
    message: `手動同期: 取得${scrape.reservations.length}件（新規${inserted} / 更新${updated} / キャンセル${cancelled} / 重複${duplicate} / エラー${errored}）`,
    details: { inserted, updated, cancelled, duplicate, errored },
  })
  await touchLastSyncedAt(salonId)

  console.log('[hp-sync/manual] finished', {
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
    console.error('[hp-sync/manual] fatal error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
