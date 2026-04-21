/** DB値 → 表示用ラベル（契約書） */

export const CONTRACT_PAYMENT_INSTRUMENT_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'クレジットカード',
  loan: 'ローン',
  transfer: '銀行振込',
  auto_billing: '自動引き落とし（サブスク）',
}

export const CONTRACT_CARD_BRAND_LABEL: Record<string, string> = {
  visa: 'VISA',
  master: 'Mastercard',
  jcb: 'JCB',
  amex: 'AMEX',
  diners: 'Diners Club',
  unionpay: '銀聯（UnionPay）',
  other: 'その他',
}

export const CONTRACT_BILLING_CYCLE_LABEL: Record<string, string> = {
  monthly: '毎月',
  quarterly: '毎3ヶ月',
  biannual: '毎6ヶ月',
  annual: '毎年',
}

export const CONTRACT_AUTO_BILLING_METHOD_LABEL: Record<string, string> = {
  card: 'クレジットカード自動決済',
  bank_transfer: '口座振替',
}

/** 頭金の支払い方法（契約全体の payment_method とは別） */
export const CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'クレジットカード',
  loan: 'ローン',
  transfer: '銀行振込',
}

export function contractPaymentTypeLabel(paymentType: string | null | undefined) {
  if (paymentType === 'installment') return '分割払い'
  return '一括払い'
}
