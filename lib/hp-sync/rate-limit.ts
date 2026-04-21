/**
 * Per-salon rate limit for scraping.
 * We never want to hammer サロンボード — minimum 5 minute interval per salon.
 * Also adds a human-like jitter helper.
 */

import { getSupabaseAdmin } from '@/lib/supabase'

const MIN_SCRAPE_INTERVAL_MS = 5 * 60 * 1000

export async function canScrapeNow(salonId: string): Promise<{ ok: boolean; waitMs: number }> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('hp_sync_rate_limits')
    .select('last_scrape_at')
    .eq('salon_id', salonId)
    .maybeSingle()

  const last = (data as { last_scrape_at?: string } | null)?.last_scrape_at
  if (!last) return { ok: true, waitMs: 0 }
  const elapsed = Date.now() - new Date(last).getTime()
  if (elapsed >= MIN_SCRAPE_INTERVAL_MS) return { ok: true, waitMs: 0 }
  return { ok: false, waitMs: MIN_SCRAPE_INTERVAL_MS - elapsed }
}

export async function markScraped(salonId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('hp_sync_rate_limits')
    .upsert({ salon_id: salonId, last_scrape_at: new Date().toISOString() })
}

/** Human-like jitter: 500ms - 2500ms. Used before scraper dispatch. */
export function humanJitter(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 2000)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Randomized user-agent. Keep a small rotating pool. */
export function pickUserAgent(): string {
  const pool = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ]
  return pool[Math.floor(Math.random() * pool.length)]
}
