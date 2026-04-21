/**
 * Deduplication for HP-sourced reservations.
 *
 * Rules (in priority order):
 *   1. Match by hp_external_id (strongest).
 *   2. Match by exact (date, start_time) + fuzzy customer name + fuzzy menu.
 *   3. Otherwise: no dup.
 */

import { getSupabaseAdmin } from '@/lib/supabase'

export interface DedupCandidate {
  salonId: string
  externalId?: string | null
  reservationDate: string // YYYY-MM-DD
  startTime: string // HH:mm or HH:mm:ss
  customerName?: string | null
  menu?: string | null
}

export interface DedupResult {
  duplicate: boolean
  reservationId: string | null
  reason: 'external_id' | 'fuzzy_match' | 'none'
}

/** Normalize Japanese text for fuzzy comparison. */
export function normalizeJa(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[・·、。,.\-－―]/g, '')
}

/** Simple similarity: 1.0 if equal, otherwise Dice coefficient on bigrams. */
export function similarity(a: string, b: string): number {
  const na = normalizeJa(a)
  const nb = normalizeJa(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    if (!set.size) set.add(s)
    return set
  }
  const A = bigrams(na)
  const B = bigrams(nb)
  let intersect = 0
  A.forEach((g) => {
    if (B.has(g)) intersect++
  })
  return (2 * intersect) / (A.size + B.size)
}

function trimTime(t: string): string {
  // Accept "HH:mm" or "HH:mm:ss" — return "HH:mm"
  return t.slice(0, 5)
}

export async function findDuplicate(c: DedupCandidate): Promise<DedupResult> {
  const supabase = getSupabaseAdmin()

  // 1. Exact match on external id (from HP directly)
  if (c.externalId) {
    const { data: byExt } = await supabase
      .from('reservations')
      .select('id')
      .eq('salon_id', c.salonId)
      .eq('hp_external_id', c.externalId)
      .limit(1)
      .maybeSingle()
    if (byExt) return { duplicate: true, reservationId: byExt.id as string, reason: 'external_id' }
  }

  // 2. Fuzzy (date + time + customer + menu)
  const startTime = trimTime(c.startTime)
  const { data: sameSlot } = await supabase
    .from('reservations')
    .select('id, customer_name, menu, start_time')
    .eq('salon_id', c.salonId)
    .eq('reservation_date', c.reservationDate)
    .limit(20)

  if (sameSlot) {
    for (const row of sameSlot) {
      const rowStart = trimTime(String(row.start_time || ''))
      if (rowStart !== startTime) continue
      const nameSim = similarity(c.customerName || '', String(row.customer_name || ''))
      const menuSim = similarity(c.menu || '', String(row.menu || ''))
      // Strong match: same time + (name >=0.8) or (name>=0.6 && menu>=0.6)
      if (nameSim >= 0.8 || (nameSim >= 0.6 && menuSim >= 0.6)) {
        return { duplicate: true, reservationId: row.id as string, reason: 'fuzzy_match' }
      }
    }
  }

  return { duplicate: false, reservationId: null, reason: 'none' }
}
