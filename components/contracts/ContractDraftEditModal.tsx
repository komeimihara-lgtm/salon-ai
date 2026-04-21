'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  ContractPaymentAndDepositFields,
  defaultContractPaymentDepositValues,
  type ContractPaymentDepositFieldsValues,
} from '@/components/contracts/ContractPaymentAndDepositFields'

type ContractPayload = {
  id: string
  customer_id: string
  course_name: string
  treatment_content: string | null
  sessions: number | null
  start_date: string | null
  end_date: string | null
  amount: number
  deposit_amount?: number | null
  deposit_paid_at?: string | null
  remaining_paid_at?: string | null
  deposit_payment_method?: string | null
  payment_type?: string | null
  payment_method?: string | null
  payment_detail: { type: string; count: number; monthly: number; first: number; note: string } | null
  card_brand?: string | null
  loan_company?: string | null
  installment_count?: number | null
  billing_cycle?: string | null
  billing_day?: number | null
  billing_method?: string | null
  first_billing_date?: string | null
  status: string
}

const INSTRUMENT_CODES = new Set(['cash', 'card', 'loan', 'transfer', 'auto_billing'])

function sliceDate(d: string | null | undefined): string {
  if (!d) return ''
  return d.length >= 10 ? d.slice(0, 10) : d
}

function resolveInstrument(c: ContractPayload): string {
  const pm = c.payment_method || ''
  if (INSTRUMENT_CODES.has(pm)) return pm
  return 'cash'
}

function resolvePaymentType(c: ContractPayload): string {
  if (c.payment_type === 'installment' || c.payment_type === 'lump_sum') return c.payment_type
  const pm = c.payment_method || ''
  if (pm === 'installment' || pm === 'lump_sum') return pm
  return c.payment_detail ? 'installment' : 'lump_sum'
}

function contractToEditPd(c: ContractPayload): ContractPaymentDepositFieldsValues {
  const base = defaultContractPaymentDepositValues()
  const icRaw = c.installment_count ?? c.payment_detail?.count ?? 12
  const ic = Number.isFinite(Number(icRaw)) ? Math.round(Number(icRaw)) : 12
  const presetNums = [3, 6, 12, 24, 36] as const
  let installPreset: ContractPaymentDepositFieldsValues['installPreset'] = '12'
  let installOtherCount = 18
  if ((presetNums as readonly number[]).includes(ic)) {
    installPreset = String(ic) as ContractPaymentDepositFieldsValues['installPreset']
  } else if (ic >= 2) {
    installPreset = 'other'
    installOtherCount = ic
  }

  const pm = resolveInstrument(c)
  const inst: ContractPaymentDepositFieldsValues['instrumentMethod'] =
    pm === 'cash' || pm === 'card' || pm === 'loan' || pm === 'transfer' || pm === 'auto_billing'
      ? pm
      : 'cash'

  const dpm = c.deposit_payment_method || ''
  const depositPaymentMethod: ContractPaymentDepositFieldsValues['depositPaymentMethod'] =
    dpm === 'cash' || dpm === 'card' || dpm === 'loan' || dpm === 'transfer' ? dpm : ''

  const cb = c.card_brand || 'visa'
  const cardBrand: ContractPaymentDepositFieldsValues['cardBrand'] =
    cb === 'visa' ||
    cb === 'master' ||
    cb === 'jcb' ||
    cb === 'amex' ||
    cb === 'diners' ||
    cb === 'unionpay' ||
    cb === 'other'
      ? cb
      : 'visa'

  return {
    ...base,
    amount: c.amount,
    depositAmount: c.deposit_amount ?? 0,
    depositPaidAt: sliceDate(c.deposit_paid_at),
    remainingPaidAt: sliceDate(c.remaining_paid_at),
    depositPaymentMethod,
    instrumentMethod: inst,
    cardBrand,
    loanCompany: c.loan_company || '',
    paymentType: resolvePaymentType(c) === 'installment' ? 'installment' : 'lump_sum',
    installPreset,
    installOtherCount,
    installMonthly: c.payment_detail?.monthly ?? 0,
    installFirst: c.payment_detail?.first ?? 0,
    installNote: c.payment_detail?.note ?? '',
    billingDay: c.billing_day ?? 1,
    billingMethod: c.billing_method === 'bank_transfer' ? 'bank_transfer' : 'card',
    firstBillingDate: sliceDate(c.first_billing_date),
    billingCycle:
      c.billing_cycle === 'quarterly' ||
      c.billing_cycle === 'biannual' ||
      c.billing_cycle === 'annual'
        ? c.billing_cycle
        : 'monthly',
  }
}

type Props = {
  contractId: string | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function ContractDraftEditModal({ contractId, open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customerLabel, setCustomerLabel] = useState('')
  const [courseName, setCourseName] = useState('')
  const [treatment, setTreatment] = useState('')
  const [sessions, setSessions] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pd, setPd] = useState<ContractPaymentDepositFieldsValues>(defaultContractPaymentDepositValues())

  useEffect(() => {
    if (!open || !contractId) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/contracts/${encodeURIComponent(contractId)}`, { credentials: 'include' })
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || '取得に失敗しました')
        const c = j.contract as ContractPayload
        if (!c || c.status !== 'draft') {
          throw new Error('下書きの契約書のみ編集できます')
        }
        if (cancelled) return
        const name = j.contract?.customers?.name
        setCustomerLabel(typeof name === 'string' ? `${name} 様` : '')
        setCourseName(c.course_name || '')
        setTreatment(c.treatment_content || '')
        setSessions(c.sessions ?? '')
        setStartDate(sliceDate(c.start_date))
        setEndDate(sliceDate(c.end_date))
        setPd(contractToEditPd(c))
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : '取得に失敗しました')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, contractId])

  const handleSave = async () => {
    if (!contractId) return
    const amountNum = Number(pd.amount)
    if (!courseName.trim() || Number.isNaN(amountNum) || amountNum < 0) {
      setError('コース名と契約金額を確認してください')
      return
    }
    const installmentCountNum =
      pd.installPreset === 'other'
        ? Math.max(2, pd.installOtherCount || 2)
        : parseInt(pd.installPreset, 10)
    const paymentDetail =
      pd.paymentType === 'installment'
        ? {
            type: '分割',
            count: installmentCountNum,
            monthly: Number(pd.installMonthly) || 0,
            first: Number(pd.installFirst) || 0,
            note: pd.installNote,
          }
        : null

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          course_name: courseName.trim(),
          treatment_content: treatment || null,
          sessions: sessions === '' ? null : sessions,
          start_date: startDate || null,
          end_date: endDate || null,
          amount: amountNum,
          deposit_amount: pd.depositAmount === '' ? 0 : Number(pd.depositAmount),
          deposit_paid_at: pd.depositPaidAt || null,
          remaining_paid_at: pd.remainingPaidAt || null,
          deposit_payment_method: pd.depositPaymentMethod || null,
          payment_type: pd.paymentType,
          payment_method: pd.instrumentMethod,
          payment_detail: paymentDetail,
          card_brand: pd.instrumentMethod === 'card' ? pd.cardBrand : null,
          loan_company: pd.instrumentMethod === 'loan' ? pd.loanCompany.trim() || null : null,
          installment_count: pd.paymentType === 'installment' ? installmentCountNum : null,
          billing_cycle: pd.instrumentMethod === 'auto_billing' ? pd.billingCycle : null,
          billing_day: pd.instrumentMethod === 'auto_billing' ? pd.billingDay : null,
          billing_method: pd.instrumentMethod === 'auto_billing' ? pd.billingMethod : null,
          first_billing_date: pd.instrumentMethod === 'auto_billing' ? pd.firstBillingDate || null : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存に失敗しました')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-bold text-text-main">契約書を編集（下書き）</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-text-sub"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
            </div>
          ) : (
            <>
              {customerLabel && (
                <p className="text-sm font-medium text-text-main">顧客: {customerLabel}</p>
              )}
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">コース名 *</label>
                <input
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">施術内容</label>
                <textarea
                  value={treatment}
                  onChange={e => setTreatment(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">施術回数（コース回数）</label>
                <input
                  type="number"
                  min={1}
                  value={sessions}
                  onChange={e => setSessions(e.target.value ? parseInt(e.target.value, 10) : '')}
                  placeholder="分割払いの回数とは別"
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">開始日</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">終了日</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <ContractPaymentAndDepositFields
                values={pd}
                onPatch={patch => setPd(prev => ({ ...prev, ...patch }))}
              />
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-text-sub"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="flex-1 py-2.5 rounded-xl bg-rose text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
