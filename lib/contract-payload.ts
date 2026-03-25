/** POST/PATCH 用: リクエスト body → contracts 行（remaining_amount は生成列のため含めない） */

const INSTRUMENTS = new Set(['cash', 'card', 'loan', 'transfer', 'auto_billing'])
const DEPOSIT_METHODS = new Set(['cash', 'card', 'loan', 'transfer'])

export type BuildContractRowContext = {
  salonId: string
  customerId: string
  mode: 'insert' | 'update'
  /** update 時: body に status が無い場合の既定 */
  existingStatus?: string | null
}

export type BuildContractRowResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; message: string }

export function buildContractRowFromBody(
  body: Record<string, unknown>,
  ctx: BuildContractRowContext,
): BuildContractRowResult {
  const {
    course_name,
    treatment_content,
    sessions,
    start_date,
    end_date,
    amount: amountRaw,
    payment_type,
    payment_method: paymentMethodRaw,
    payment_detail,
    card_brand,
    loan_company,
    installment_count,
    billing_cycle,
    billing_day,
    billing_method,
    first_billing_date,
    deposit_amount: depRaw,
    deposit_paid_at,
    remaining_paid_at,
    deposit_payment_method: depPmRaw,
  } = body

  if (!ctx.customerId || typeof ctx.customerId !== 'string') {
    return { ok: false, message: '顧客が指定されていません' }
  }
  if (!course_name || typeof course_name !== 'string' || !course_name.trim()) {
    return { ok: false, message: 'コース名が必要です' }
  }
  if (amountRaw == null || Number.isNaN(Number(amountRaw))) {
    return { ok: false, message: '契約金額が不正です' }
  }

  const amount = Math.round(Number(amountRaw))
  if (amount < 0) {
    return { ok: false, message: '契約金額が不正です' }
  }

  const depNum = depRaw != null && depRaw !== '' ? Number(depRaw) : 0
  const deposit_amount =
    Number.isFinite(depNum) ? Math.max(0, Math.min(Math.round(depNum), amount)) : 0

  const rawPm = paymentMethodRaw != null ? String(paymentMethodRaw) : ''
  let ptype: 'lump_sum' | 'installment' =
    String(payment_type) === 'installment' ? 'installment' : 'lump_sum'
  if (payment_type == null && (rawPm === 'lump_sum' || rawPm === 'installment')) {
    ptype = rawPm as 'lump_sum' | 'installment'
  }

  const instrument = INSTRUMENTS.has(rawPm) ? rawPm : 'cash'

  let instCount: number | null = null
  if (ptype === 'installment') {
    const fromBody = installment_count != null ? Number(installment_count) : NaN
    const fromDetail =
      payment_detail && typeof payment_detail === 'object' && payment_detail !== null
        ? Number((payment_detail as { count?: unknown }).count)
        : NaN
    const n = Number.isFinite(fromBody) && fromBody >= 2 ? fromBody : fromDetail
    instCount = Number.isFinite(n) && n >= 2 ? Math.round(n) : null
  }

  const autoBilling = instrument === 'auto_billing'

  const depPmStr = depPmRaw != null ? String(depPmRaw) : ''
  const deposit_payment_method =
    deposit_amount > 0 && DEPOSIT_METHODS.has(depPmStr) ? depPmStr : null

  const row: Record<string, unknown> = {
    salon_id: ctx.salonId,
    customer_id: ctx.customerId,
    course_name: String(course_name).trim(),
    treatment_content: treatment_content ? String(treatment_content) : null,
    sessions: sessions != null && sessions !== '' ? Math.round(Number(sessions)) : null,
    start_date: start_date ? String(start_date).slice(0, 10) : null,
    end_date: end_date ? String(end_date).slice(0, 10) : null,
    amount,
    deposit_amount,
    deposit_paid_at: deposit_paid_at ? String(deposit_paid_at).slice(0, 10) : null,
    remaining_paid_at: remaining_paid_at ? String(remaining_paid_at).slice(0, 10) : null,
    deposit_payment_method,
    payment_type: ptype,
    payment_method: instrument,
    payment_detail: payment_detail || null,
    card_brand: instrument === 'card' && card_brand ? String(card_brand) : null,
    loan_company: instrument === 'loan' && loan_company ? String(loan_company).trim() : null,
    installment_count: instCount,
    auto_billing: autoBilling,
    billing_cycle: autoBilling && billing_cycle ? String(billing_cycle) : null,
    billing_day:
      autoBilling && billing_day != null && Number.isFinite(Number(billing_day))
        ? Math.min(28, Math.max(1, Math.round(Number(billing_day))))
        : null,
    billing_method: autoBilling && billing_method ? String(billing_method) : null,
    first_billing_date:
      autoBilling && first_billing_date ? String(first_billing_date).slice(0, 10) : null,
  }

  if (ctx.mode === 'insert') {
    row.status = body.status != null ? String(body.status) : 'draft'
  } else {
    row.status =
      body.status != null ? String(body.status) : ctx.existingStatus ?? 'draft'
  }

  return { ok: true, row }
}
