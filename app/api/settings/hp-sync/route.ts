import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveSalonIdForOwnerApi } from '@/lib/resolve-salon-id-api'
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/hp-sync/crypto'

/**
 * GET  /api/settings/hp-sync
 *   Returns the HP sync settings for the current salon.
 *   The password is never returned in cleartext — only a masked form.
 *
 * PATCH /api/settings/hp-sync
 *   Body: { hp_email?, hp_password?, hp_sync_enabled? }
 *   Saves credentials (encrypted). Empty string hp_password clears it.
 */

export async function GET(req: NextRequest) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id missing' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('salons')
      .select('hp_email, hp_password, hp_sync_enabled, hp_last_synced_at, hp_sync_email, id')
      .eq('id', salonId)
      .maybeSingle()

    if (error) throw error

    const row = (data || {}) as Record<string, unknown>
    const encPw = (row.hp_password as string | null) || ''
    const clearPw = encPw ? decryptSecret(encPw) : ''

    const syncEmail =
      (row.hp_sync_email as string | null) ||
      `sync-${salonId}@${process.env.HP_SYNC_EMAIL_DOMAIN || 'sola-ai.jp'}`

    return NextResponse.json({
      hp_email: (row.hp_email as string | null) || '',
      hp_password_masked: clearPw ? maskSecret(clearPw) : '',
      hp_password_set: !!clearPw,
      hp_sync_enabled: !!row.hp_sync_enabled,
      hp_last_synced_at: (row.hp_last_synced_at as string | null) || null,
      hp_sync_email: syncEmail,
    })
  } catch (e) {
    console.error('GET /api/settings/hp-sync error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const salonId = await resolveSalonIdForOwnerApi(req)
    if (!salonId) return NextResponse.json({ error: 'salon_id missing' }, { status: 400 })

    const body = await req.json()
    const update: Record<string, unknown> = {}

    if (typeof body.hp_email === 'string') {
      update.hp_email = body.hp_email.trim() || null
    }

    // Password rules:
    //   - undefined → don't touch
    //   - ""        → clear
    //   - string    → encrypt & store
    if (body.hp_password !== undefined) {
      if (typeof body.hp_password !== 'string') {
        return NextResponse.json({ error: 'hp_password must be string' }, { status: 400 })
      }
      update.hp_password = body.hp_password === '' ? null : encryptSecret(body.hp_password)
    }

    if (typeof body.hp_sync_enabled === 'boolean') {
      update.hp_sync_enabled = body.hp_sync_enabled
    }

    // Ensure the salon has a routable sync email assigned
    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase
      .from('salons')
      .select('hp_sync_email')
      .eq('id', salonId)
      .maybeSingle()
    const currentSyncEmail = (existing as { hp_sync_email?: string } | null)?.hp_sync_email
    if (!currentSyncEmail) {
      update.hp_sync_email = `sync-${salonId}@${process.env.HP_SYNC_EMAIL_DOMAIN || 'sola-ai.jp'}`
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
    }

    const { error } = await supabase.from('salons').update(update).eq('id', salonId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PATCH /api/settings/hp-sync error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
