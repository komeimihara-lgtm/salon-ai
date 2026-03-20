import { getSupabaseAdmin } from '@/lib/supabase'

export type SaleLogAction = 'created' | 'cancelled' | 'modified'

const SALE_SNAPSHOT_KEYS = [
  'id',
  'salon_id',
  'sale_date',
  'amount',
  'customer_id',
  'customer_name',
  'menu',
  'staff_name',
  'payment_method',
  'memo',
  'sale_type',
  'ticket_id',
  'status',
  'cancelled_at',
  'cancelled_by',
  'cancel_reason',
  'original_sale_id',
] as const

/** sale_logs / API 用に行をプレーンオブジェクト化 */
export function saleRowSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const k of SALE_SNAPSHOT_KEYS) {
    if (k in row && row[k] !== undefined) o[k] = row[k]
  }
  return o
}

export async function insertSaleLog(params: {
  saleId: string
  salonId: string
  action: SaleLogAction
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  operatedBy: string
}): Promise<{ error: Error | null }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('sale_logs').insert({
    sale_id: params.saleId,
    salon_id: params.salonId,
    action: params.action,
    before_data: params.beforeData,
    after_data: params.afterData,
    operated_by: params.operatedBy,
  })
  return { error: error ? new Error(error.message) : null }
}
