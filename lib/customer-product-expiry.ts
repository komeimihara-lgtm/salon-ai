import type { SupabaseClient } from '@supabase/supabase-js'

export function addDaysToDateString(saleDate: string, days: number): string {
  const d = new Date(`${saleDate.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** JST 基準の今日 YYYY-MM-DD */
export function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export function daysUntilExpiry(expiresAt: string, fromDate: string): number {
  const a = new Date(`${expiresAt.slice(0, 10)}T12:00:00`).getTime()
  const b = new Date(`${fromDate.slice(0, 10)}T12:00:00`).getTime()
  return Math.ceil((a - b) / (24 * 60 * 60 * 1000))
}

export function buildProductExpiryLineMessage(
  customerName: string,
  productName: string,
  expiresAtYmd: string
): string {
  const label = new Date(`${expiresAtYmd}T12:00:00`).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
  return `${customerName}様、先日ご購入いただいた${productName}の消費期限が\n${label}に近づいています。\nご不明な点はお気軽にご相談ください😊`
}

type SaleRow = {
  id: string
  salon_id: string
  sale_date?: string | null
  sale_type?: string | null
  customer_id?: string | null
  product_id?: string | null
}

/**
 * レジ登録直後の売上行について、物販かつ期限日数が設定されている商品なら customer_product_expiry を作成
 */
export async function insertCustomerProductExpiriesForSales(
  supabase: SupabaseClient,
  salesRows: SaleRow[]
): Promise<void> {
  for (const row of salesRows) {
    if (row.sale_type !== 'product' || !row.customer_id || !row.product_id) continue
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('expiry_days')
      .eq('id', row.product_id)
      .maybeSingle()
    if (pErr || product == null) continue
    const expDays = product.expiry_days as number | null | undefined
    if (expDays == null || Number(expDays) <= 0) continue
    const soldAt = String(row.sale_date ?? '').slice(0, 10)
    if (!soldAt) continue
    const expiresAt = addDaysToDateString(soldAt, Number(expDays))
    const { error: insErr } = await supabase.from('customer_product_expiry').insert({
      salon_id: row.salon_id,
      customer_id: row.customer_id,
      product_id: row.product_id,
      sale_id: row.id,
      sold_at: soldAt,
      expires_at: expiresAt,
      is_notified: false,
    })
    if (insErr && !String(insErr.message ?? '').includes('duplicate') && !String(insErr.code ?? '').includes('23505')) {
      console.error('customer_product_expiry insert:', insErr.message)
    }
  }
}
