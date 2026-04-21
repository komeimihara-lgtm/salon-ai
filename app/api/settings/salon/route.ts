import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest, getSalonIdFromCookie } from '@/lib/get-salon-id'
import { jsonErrorWithDetails, logPostgrestError } from '@/lib/postgrest-error-response'

function logSettingsSalon(context: string, payload: Record<string, unknown>) {
  console.log('[settings/salon]', context, payload)
}

export async function GET(req: NextRequest) {
  const fromCookieOnly = getSalonIdFromCookie()
  const salonId = getSalonIdFromApiRequest(req)
  logSettingsSalon('GET', {
    getSalonIdFromCookie_len: fromCookieOnly.length,
    getSalonIdFromCookie_suffix: fromCookieOnly ? fromCookieOnly.slice(-8) : '',
    resolvedSalonId_len: salonId.length,
    resolvedSalonId_suffix: salonId ? salonId.slice(-8) : '',
    hasCookieHeader: Boolean(req.headers.get('cookie')),
  })
  if (!salonId) {
    logSettingsSalon('GET rejected', { reason: 'missing salon_id' })
    return NextResponse.json({ error: 'salon_id が取得できません（Cookie を確認してください）' }, { status: 401 })
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    console.error('[settings/salon] GET Supabase init failed', e)
    return jsonErrorWithDetails(500, 'サーバー設定エラー', { caught: e })
  }

  const { data: salon, error } = await supabase
    .from('salons')
    .select(
      'id, name, owner_name, plan, phone, address, postal_code, email, beds, closed_days, business_hours, targets, external_urls',
    )
    .eq('id', salonId)
    .maybeSingle()

  if (error) {
    logPostgrestError('[settings/salon] GET salons query failed', error)
    return jsonErrorWithDetails(500, error.message, { supabase: error })
  }
  if (!salon) {
    console.warn('[settings/salon] GET no row', { salonIdSuffix: salonId.slice(-8) })
    return NextResponse.json({ error: 'サロンが見つかりません' }, { status: 404 })
  }
  const beds: string[] = Array.isArray(salon?.beds) ? salon.beds : ['A', 'B']
  const closed_days: number[] = Array.isArray(salon?.closed_days) ? salon.closed_days : []
  return NextResponse.json({
    name: salon?.name || '',
    owner_name: salon?.owner_name || '',
    plan: salon?.plan || '',
    phone: salon?.phone || '',
    address: salon?.address || '',
    postal_code: salon?.postal_code || '',
    email: salon?.email || '',
    beds,
    closed_days,
    business_hours: salon?.business_hours || null,
    targets: salon?.targets || null,
    external_urls: salon?.external_urls || {},
  })
}

export async function PATCH(req: NextRequest) {
  const fromCookieOnly = getSalonIdFromCookie()
  const salonId = getSalonIdFromApiRequest(req)
  logSettingsSalon('PATCH', {
    getSalonIdFromCookie_len: fromCookieOnly.length,
    getSalonIdFromCookie_suffix: fromCookieOnly ? fromCookieOnly.slice(-8) : '',
    resolvedSalonId_len: salonId.length,
    resolvedSalonId_suffix: salonId ? salonId.slice(-8) : '',
  })
  if (!salonId) {
    logSettingsSalon('PATCH rejected', { reason: 'missing salon_id' })
    return NextResponse.json({ error: 'salon_id が取得できません（Cookie を確認してください）' }, { status: 401 })
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try {
    supabase = getSupabaseAdmin()
  } catch (e) {
    console.error('[settings/salon] PATCH Supabase init failed', e)
    return jsonErrorWithDetails(500, 'サーバー設定エラー', { caught: e })
  }
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (Array.isArray(body.beds)) update.beds = body.beds
  if (Array.isArray(body.closed_days)) update.closed_days = body.closed_days
  if (typeof body.name === 'string') update.name = body.name
  if (typeof body.owner_name === 'string') update.owner_name = body.owner_name
  if (typeof body.phone === 'string') update.phone = body.phone
  if (typeof body.address === 'string') update.address = body.address
  if (typeof body.postal_code === 'string') update.postal_code = body.postal_code
  if (typeof body.email === 'string') update.email = body.email
  if (body.business_hours && typeof body.business_hours === 'object') update.business_hours = body.business_hours
  if (body.targets && typeof body.targets === 'object') update.targets = body.targets
  if (body.external_urls && typeof body.external_urls === 'object') update.external_urls = body.external_urls
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }
  const { data: updatedRows, error } = await supabase
    .from('salons')
    .update(update)
    .eq('id', salonId)
    .select('id')
  if (error) {
    logPostgrestError('[settings/salon] PATCH salons update failed', error)
    return jsonErrorWithDetails(500, error.message, { supabase: error })
  }
  if (!updatedRows?.length) {
    console.warn('[settings/salon] PATCH no row updated', { salonIdSuffix: salonId.slice(-8) })
    return NextResponse.json({ error: 'サロンが見つかりません' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
