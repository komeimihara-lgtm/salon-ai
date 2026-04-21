import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 売上行の表示用顧客名。JOIN された customers.name を最優先し、
 * 無い場合のみ sales.customer_name（スナップショット）を使う。
 */
export function pickSaleCustomerDisplayName(row: Record<string, unknown>): string {
  const cust = row.customers as { name?: string } | { name?: string }[] | null | undefined
  if (cust && !Array.isArray(cust) && typeof cust === 'object' && cust.name != null) {
    const n = String(cust.name).trim()
    if (n) return n
  }
  if (Array.isArray(cust) && cust[0] && typeof cust[0] === 'object' && cust[0].name != null) {
    const n = String(cust[0].name).trim()
    if (n) return n
  }
  const cn = row.customer_name
  if (typeof cn === 'string' && cn.trim()) return cn.trim()
  return '—'
}

/**
 * customer_id がある行について、customers テーブルの現行 name で customer_name を上書きする（配列を直接ミュート）。
 * 一覧APIの返却・および INSERT 直前の正規化に使う。
 */
export async function overwriteSaleCustomerNamesFromDb(
  supabase: SupabaseClient,
  salonId: string,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const ids = Array.from(
    new Set(
      rows
        .map((r) => r.customer_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )
  if (ids.length === 0) return

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('salon_id', salonId)
    .in('id', ids)

  if (error || !data?.length) return

  const map = new Map(
    (data as { id: string; name?: string | null }[]).map((c) => [c.id, (c.name ?? '').trim()])
  )
  for (const row of rows) {
    const cid = row.customer_id
    if (typeof cid !== 'string') continue
    const n = map.get(cid)
    if (n) row.customer_name = n
  }
}
