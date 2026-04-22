/**
 * 売上の支払方法（payment_method）と売上種別（sale_type）で共有するリテラル型。
 *
 * - DB: sales.sale_type は CHECK 制約で以下のいずれかに限定されている
 *       （supabase/migrations/20260422_payment_methods_transit_qr.sql）
 * - DB: sales.payment_method には CHECK 制約なし（UIの選択値は PAYMENT_METHODS に揃える）
 *
 * 新しい支払方法を追加するときは:
 *   1) この PAYMENT_METHODS に追加
 *   2) sales.sale_type の CHECK 制約を ALTER するマイグレーションを追加
 *   3) app/(salon)/sales/page.tsx の PAYMENTS / SALE_TYPE_LABELS / 修正モーダル
 *      の <option> を更新
 */

export const PAYMENT_METHODS = ['cash', 'card', 'transit_ic', 'qr_code', 'online', 'loan'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  transit_ic: '交通系IC',
  qr_code: 'QR決済',
  online: 'オンライン決済',
  loan: 'ローン',
}

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v)
}
