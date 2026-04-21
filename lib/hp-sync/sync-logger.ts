/**
 * Thin wrapper for writing rows to hp_sync_logs.
 * Every success/error/skip during HP sync should emit one log row so
 * the Settings UI can show a recent history.
 */

import { getSupabaseAdmin } from '@/lib/supabase'

export type HpSyncSource = 'email' | 'scrape' | 'manual'
export type HpSyncStatus = 'success' | 'error' | 'skipped' | 'duplicate'

export interface LogInput {
  salonId: string
  source: HpSyncSource
  status: HpSyncStatus
  message?: string
  reservationId?: string | null
  details?: Record<string, unknown>
}

export async function logHpSync(input: LogInput): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from('hp_sync_logs')
      .insert({
        salon_id: input.salonId,
        source: input.source,
        status: input.status,
        message: input.message ?? null,
        reservation_id: input.reservationId ?? null,
        details: input.details ?? null,
      })
  } catch (e) {
    console.error('[hp-sync/sync-logger] insert failed', e)
  }
}

export async function touchLastSyncedAt(salonId: string): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from('salons')
      .update({ hp_last_synced_at: new Date().toISOString() })
      .eq('id', salonId)
  } catch (e) {
    console.error('[hp-sync/sync-logger] touchLastSyncedAt failed', e)
  }
}
