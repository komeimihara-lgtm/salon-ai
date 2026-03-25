'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Printer, CheckCircle } from 'lucide-react'
import {
  CONTRACT_AUTO_BILLING_METHOD_LABEL,
  CONTRACT_BILLING_CYCLE_LABEL,
  CONTRACT_CARD_BRAND_LABEL,
  CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL,
  CONTRACT_PAYMENT_INSTRUMENT_LABEL,
  contractPaymentTypeLabel,
} from '@/lib/contracts-payment'
import {
  ContractPaymentAndDepositFields,
  defaultContractPaymentDepositValues,
  type ContractPaymentDepositFieldsValues,
} from '@/components/contracts/ContractPaymentAndDepositFields'
import { computeContractRemainingAmount } from '@/lib/contract-payload'

interface ContractData {
  id: string
  customer_id: string
  /** 契約作成時に保存したクーリングオフ（電磁的記録）受付メール */
  cooling_off_email?: string | null
  course_name: string
  treatment_content: string | null
  sessions: number | null
  start_date: string | null
  end_date: string | null
  amount: number
  deposit_amount?: number | null
  remaining_amount?: number | null
  deposit_paid_at?: string | null
  remaining_paid_at?: string | null
  deposit_payment_method?: string | null
  payment_type?: string | null
  payment_method?: string | null
  payment_detail: { type: string; count: number; monthly: number; first: number; note: string } | null
  card_brand?: string | null
  loan_company?: string | null
  installment_count?: number | null
  auto_billing?: boolean | null
  billing_cycle?: string | null
  billing_day?: number | null
  billing_method?: string | null
  first_billing_date?: string | null
  status: string
  signature_image: string | null
  signed_at: string | null
  signer_ip: string | null
  created_at: string
  customers: {
    name: string
    name_kana?: string
    phone?: string
    email?: string
    address?: string
  } | null
}

interface SalonInfo {
  name?: string
  phone?: string
  address?: string
  email?: string | null
  postal_code?: string | null
}

const INSTRUMENT_CODES = new Set(['cash', 'card', 'loan', 'transfer', 'auto_billing'])

function resolveInstrument(c: ContractData): string {
  const pm = c.payment_method || ''
  if (INSTRUMENT_CODES.has(pm)) return pm
  return 'cash'
}

function resolvePaymentType(c: ContractData): string {
  if (c.payment_type === 'installment' || c.payment_type === 'lump_sum') return c.payment_type
  const pm = c.payment_method || ''
  if (pm === 'installment' || pm === 'lump_sum') return pm
  return c.payment_detail ? 'installment' : 'lump_sum'
}

function sliceDate(d: string | null | undefined): string {
  if (!d) return ''
  return d.length >= 10 ? d.slice(0, 10) : d
}

function contractToEditPd(c: ContractData): ContractPaymentDepositFieldsValues {
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
    billingMethod:
      c.billing_method === 'bank_transfer' ? 'bank_transfer' : 'card',
    firstBillingDate: sliceDate(c.first_billing_date),
    billingCycle:
      c.billing_cycle === 'quarterly' ||
      c.billing_cycle === 'biannual' ||
      c.billing_cycle === 'annual'
        ? c.billing_cycle
        : 'monthly',
  }
}

function normalizeRouteContractId(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw
  if (!s) return ''
  try {
    return decodeURIComponent(String(s).trim())
  } catch {
    return String(s).trim()
  }
}

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = normalizeRouteContractId(params.id as string | string[] | undefined)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [salon, setSalon] = useState<SalonInfo>({})
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [editSaving, setEditSaving] = useState(false)
  const [editCourseName, setEditCourseName] = useState('')
  const [editTreatment, setEditTreatment] = useState('')
  const [editSessions, setEditSessions] = useState<number | ''>('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editPd, setEditPd] = useState<ContractPaymentDepositFieldsValues>(defaultContractPaymentDepositValues)

  const [paidDatesSaving, setPaidDatesSaving] = useState(false)
  const [editDepositPaidAt, setEditDepositPaidAt] = useState('')
  const [editRemainingPaidAt, setEditRemainingPaidAt] = useState('')

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchContract = useCallback(async () => {
    if (!id) {
      setContract(null)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(id)}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok) {
        setContract(data.contract)
        setSalon(data.salon || {})
      } else {
        setContract(null)
      }
    } catch {
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContract()
  }, [fetchContract])

  useEffect(() => {
    if (!contract) return
    setEditDepositPaidAt(sliceDate(contract.deposit_paid_at))
    setEditRemainingPaidAt(sliceDate(contract.remaining_paid_at))
    if (contract.status !== 'draft') return
    setEditCourseName(contract.course_name)
    setEditTreatment(contract.treatment_content || '')
    setEditSessions(contract.sessions ?? '')
    setEditStartDate(sliceDate(contract.start_date))
    setEditEndDate(sliceDate(contract.end_date))
    setEditPd(contractToEditPd(contract))
  }, [contract])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || contract?.status === 'signed') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#1A202C'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [contract?.status, loading])

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    isDrawingRef.current = true
    lastPointRef.current = getPos(e)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !lastPointRef.current) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPointRef.current = pos
  }

  const endDraw = () => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const isCanvasEmpty = () => {
    const canvas = canvasRef.current
    if (!canvas) return true
    const ctx = canvas.getContext('2d')
    if (!ctx) return true
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false
    }
    return true
  }

  const handleSign = async () => {
    if (!contract || isCanvasEmpty()) {
      alert('署名を記入してください')
      return
    }

    setSigning(true)
    try {
      const canvas = canvasRef.current!
      const signatureImage = canvas.toDataURL('image/png')
      const signedAt = new Date().toISOString()

      // Get IP (best-effort)
      let signerIp = ''
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json()
        signerIp = ipData.ip || ''
      } catch { /* ignore */ }

      const res = await fetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          signature_image: signatureImage,
          signed_at: signedAt,
          signer_ip: signerIp,
          status: 'signed',
        }),
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      // PDF generation
      try {
        const contractEl = document.getElementById('contract-template')
        if (contractEl) {
          const html2canvas = (await import('html2canvas')).default
          const { jsPDF } = await import('jspdf')
          const canvasImg = await html2canvas(contractEl, { scale: 2, useCORS: true })
          const imgData = canvasImg.toDataURL('image/png')
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pdfW = pdf.internal.pageSize.getWidth()
          const pdfH = (canvasImg.height * pdfW) / canvasImg.width
          pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
          pdf.save(`contract_${contract.id.slice(0, 8)}.pdf`)
        }
      } catch (pdfErr) {
        console.error('PDF生成エラー:', pdfErr)
      }

      // LINE送信（line_user_idがある場合）
      try {
        const customerRes = await fetch(`/api/customers/${contract.customer_id}`)
        const customerData = await customerRes.json()
        if (customerData.customer?.line_user_id) {
          await fetch('/api/line/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              line_user_id: customerData.customer.line_user_id,
              message: `【契約書署名完了】\n${contract.course_name}の契約書に署名が完了しました。\n金額: ¥${contract.amount.toLocaleString()}\n署名日時: ${new Date(signedAt).toLocaleString('ja-JP')}`,
            }),
          })
        }
      } catch { /* LINE送信失敗は無視 */ }

      await fetchContract()
      showToast('署名が完了しました')
    } catch {
      alert('署名の保存に失敗しました')
    } finally {
      setSigning(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!contract || contract.status !== 'draft') return
    const amountNum = Number(editPd.amount)
    if (!editCourseName.trim() || Number.isNaN(amountNum) || amountNum < 0) {
      alert('コース名と契約金額を確認してください')
      return
    }
    const installmentCountNum =
      editPd.installPreset === 'other'
        ? Math.max(2, editPd.installOtherCount || 2)
        : parseInt(editPd.installPreset, 10)
    const paymentDetail =
      editPd.paymentType === 'installment'
        ? {
            type: '分割',
            count: installmentCountNum,
            monthly: Number(editPd.installMonthly) || 0,
            first: Number(editPd.installFirst) || 0,
            note: editPd.installNote,
          }
        : null

    setEditSaving(true)
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          course_name: editCourseName.trim(),
          treatment_content: editTreatment || null,
          sessions: editSessions === '' ? null : editSessions,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          amount: amountNum,
          deposit_amount: editPd.depositAmount === '' ? 0 : Number(editPd.depositAmount),
          deposit_paid_at: editPd.depositPaidAt || null,
          remaining_paid_at: editPd.remainingPaidAt || null,
          deposit_payment_method: editPd.depositPaymentMethod || null,
          payment_type: editPd.paymentType,
          payment_method: editPd.instrumentMethod,
          payment_detail: paymentDetail,
          card_brand: editPd.instrumentMethod === 'card' ? editPd.cardBrand : null,
          loan_company: editPd.instrumentMethod === 'loan' ? editPd.loanCompany.trim() || null : null,
          installment_count: editPd.paymentType === 'installment' ? installmentCountNum : null,
          billing_cycle: editPd.instrumentMethod === 'auto_billing' ? editPd.billingCycle : null,
          billing_day: editPd.instrumentMethod === 'auto_billing' ? editPd.billingDay : null,
          billing_method: editPd.instrumentMethod === 'auto_billing' ? editPd.billingMethod : null,
          first_billing_date: editPd.instrumentMethod === 'auto_billing' ? editPd.firstBillingDate || null : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存に失敗しました')
      await fetchContract()
      showToast('保存しました')
    } catch {
      alert('保存に失敗しました')
    } finally {
      setEditSaving(false)
    }
  }

  const handleSavePaidDates = async () => {
    if (!contract || contract.status === 'draft') return
    setPaidDatesSaving(true)
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contract.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deposit_paid_at: editDepositPaidAt || null,
          remaining_paid_at: editRemainingPaidAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存に失敗しました')
      await fetchContract()
      showToast('入金日を保存しました')
    } catch {
      alert('保存に失敗しました')
    } finally {
      setPaidDatesSaving(false)
    }
  }

  const handlePrint = () => window.print()

  const handleDownloadPdf = async () => {
    const contractEl = document.getElementById('contract-template')
    if (!contractEl) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvasImg = await html2canvas(contractEl, { scale: 2, useCORS: true })
      const imgData = canvasImg.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvasImg.height * pdfW) / canvasImg.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      pdf.save(`contract_${contract?.id.slice(0, 8)}.pdf`)
    } catch (err) {
      console.error('PDF生成エラー:', err)
      alert('PDF生成に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-rose animate-spin" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="text-center py-16">
        <p className="text-text-sub mb-4">契約書が見つかりません</p>
        <Link href="/contracts" className="text-rose font-medium hover:underline">一覧に戻る</Link>
      </div>
    )
  }

  const cust = contract.customers
  const isSigned = contract.status === 'signed'

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link href="/contracts" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          {isSigned && (
            <>
              <button
                onClick={handleDownloadPdf}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                PDF保存
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" /> 印刷
              </button>
            </>
          )}
        </div>
      </div>

      {isSigned && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl print:hidden">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700">
            署名済み（{contract.signed_at ? new Date(contract.signed_at).toLocaleString('ja-JP') : ''}）
          </p>
        </div>
      )}

      {!isSigned && (
        <div className="print:hidden mb-6 bg-white rounded-2xl p-5 card-shadow space-y-4">
          <h2 className="text-sm font-bold text-text-main">契約内容の編集（下書き）</h2>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">コース名 *</label>
            <input
              value={editCourseName}
              onChange={e => setEditCourseName(e.target.value)}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">施術内容</label>
            <textarea
              value={editTreatment}
              onChange={e => setEditTreatment(e.target.value)}
              rows={3}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">施術回数（コース回数）</label>
            <input
              type="number"
              min={1}
              value={editSessions}
              onChange={e => setEditSessions(e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder="分割払いの回数とは別"
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">開始日</label>
              <input
                type="date"
                value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">終了日</label>
              <input
                type="date"
                value={editEndDate}
                onChange={e => setEditEndDate(e.target.value)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <ContractPaymentAndDepositFields
            values={editPd}
            onPatch={patch => setEditPd(prev => ({ ...prev, ...patch }))}
          />
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={editSaving}
            className="w-full py-3 rounded-xl bg-rose text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {editSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 保存中...
              </>
            ) : (
              '変更を保存'
            )}
          </button>
        </div>
      )}

      {isSigned && (
        <div className="print:hidden mb-6 bg-white rounded-2xl p-5 card-shadow space-y-3">
          <h2 className="text-sm font-bold text-text-main">入金日の記録</h2>
          <p className="text-xs text-text-sub">署名後も頭金・残金の入金日だけは更新できます。</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">頭金入金日</label>
              <input
                type="date"
                value={editDepositPaidAt}
                onChange={e => setEditDepositPaidAt(e.target.value)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">残金入金日</label>
              <input
                type="date"
                value={editRemainingPaidAt}
                onChange={e => setEditRemainingPaidAt(e.target.value)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSavePaidDates}
            disabled={paidDatesSaving}
            className="w-full py-2.5 rounded-xl border border-rose text-rose font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {paidDatesSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 保存中...
              </>
            ) : (
              '入金日を保存'
            )}
          </button>
        </div>
      )}

      {/* 契約書テンプレート */}
      <div id="contract-template" className="bg-white rounded-2xl p-6 sm:p-8 card-shadow print:shadow-none print:rounded-none">
        <h2 className="text-xl font-bold text-center text-text-main mb-6 border-b-2 border-text-main pb-2">
          エステティックサービス契約書
        </h2>

        {/* 事業者情報 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">事業者情報</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>サロン名: {salon.name || '—'}</p>
            <p>
              住所:
              {salon.postal_code?.trim()
                ? ` 〒${salon.postal_code.trim()}`
                : ''}{' '}
              {salon.address || '—'}
            </p>
            <p>電話番号: {salon.phone || '—'}</p>
            {salon.email?.trim() ? <p>メール: {salon.email.trim()}</p> : null}
          </div>
        </div>

        {/* 契約者情報 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">契約者情報</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>氏名: {cust?.name || '—'}</p>
            <p>住所: {cust?.address || '—'}</p>
            <p>電話番号: {cust?.phone || '—'}</p>
          </div>
        </div>

        {/* 契約内容 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">契約内容</h3>
          <div className="text-sm text-text-sub space-y-0.5">
            <p>契約日: {new Date(contract.created_at).toLocaleDateString('ja-JP')}</p>
            <p>コース名: {contract.course_name}</p>
            {contract.treatment_content && <p>施術内容: {contract.treatment_content}</p>}
            {contract.sessions && <p>回数: {contract.sessions}回</p>}
            <p>
              期間: {contract.start_date || '—'} 〜 {contract.end_date || '—'}
            </p>
            <p>契約金額: ¥{contract.amount.toLocaleString()}（税込）</p>
            <p>頭金: ¥{(contract.deposit_amount ?? 0).toLocaleString()}</p>
            <p>
              残金: ¥
              {computeContractRemainingAmount(contract.amount, contract.deposit_amount).toLocaleString()}
            </p>
            {(contract.deposit_amount ?? 0) > 0 && contract.deposit_payment_method && (
              <p>
                頭金の支払い方法:{' '}
                {CONTRACT_DEPOSIT_PAYMENT_METHOD_LABEL[contract.deposit_payment_method] ||
                  contract.deposit_payment_method}
              </p>
            )}
            {contract.deposit_paid_at && (
              <p>
                頭金入金日:{' '}
                {new Date(contract.deposit_paid_at + 'T12:00:00').toLocaleDateString('ja-JP')}
              </p>
            )}
            {contract.remaining_paid_at && (
              <p>
                残金入金日:{' '}
                {new Date(contract.remaining_paid_at + 'T12:00:00').toLocaleDateString('ja-JP')}
              </p>
            )}
            <p>
              支払い方法:{' '}
              {CONTRACT_PAYMENT_INSTRUMENT_LABEL[resolveInstrument(contract)] ||
                resolveInstrument(contract)}
            </p>
            {resolveInstrument(contract) === 'card' && contract.card_brand && (
              <p>
                カード種別:{' '}
                {CONTRACT_CARD_BRAND_LABEL[contract.card_brand] || contract.card_brand}
              </p>
            )}
            {resolveInstrument(contract) === 'loan' && contract.loan_company && (
              <p>ローン会社: {contract.loan_company}</p>
            )}
            {resolveInstrument(contract) === 'auto_billing' && (
              <>
                {contract.billing_day != null && <p>引き落とし日: 毎月{contract.billing_day}日</p>}
                {contract.billing_method && (
                  <p>
                    引き落とし方法:{' '}
                    {CONTRACT_AUTO_BILLING_METHOD_LABEL[contract.billing_method] ||
                      contract.billing_method}
                  </p>
                )}
                {contract.first_billing_date && (
                  <p>
                    初回決済日:{' '}
                    {new Date(contract.first_billing_date + 'T12:00:00').toLocaleDateString('ja-JP')}
                  </p>
                )}
                {contract.billing_cycle && (
                  <p>
                    決済サイクル:{' '}
                    {CONTRACT_BILLING_CYCLE_LABEL[contract.billing_cycle] || contract.billing_cycle}
                  </p>
                )}
                {contract.auto_billing && (
                  <p className="text-xs text-gray-500">※ 自動課金は契約記録のみ（決済処理は別途）</p>
                )}
              </>
            )}
            <p>残金の支払い: {contractPaymentTypeLabel(resolvePaymentType(contract))}</p>
            {resolvePaymentType(contract) === 'installment' && contract.payment_detail && (
              <>
                <p>
                  分割回数: {contract.installment_count ?? contract.payment_detail.count}回
                </p>
                {contract.payment_detail.first > 0 && (
                  <p>初回金額: ¥{contract.payment_detail.first.toLocaleString()}</p>
                )}
                {contract.payment_detail.monthly > 0 && (
                  <p>
                    月額: ¥{contract.payment_detail.monthly.toLocaleString()}
                    {contract.payment_detail.note ? `（${contract.payment_detail.note}）` : ''}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* クーリングオフ */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            クーリングオフについて
          </h3>
          <div className="text-xs text-text-sub leading-relaxed bg-[#F8F5FF] p-3 rounded-lg space-y-2">
            <p>
              契約書面を受け取った日から8日以内であれば、書面または電磁的記録（電子メール等）により契約の申込みを撤回または解除することができます。
            </p>
            <p className="font-medium text-text-main pt-1">【クーリングオフ受付先】</p>
            <p>
              ・書面：
              {salon.postal_code?.trim() ? `〒${salon.postal_code.trim()} ` : '〒＿＿＿─＿＿＿＿ '}
              {salon.address?.trim() || '（サロン住所未登録）'}
            </p>
            <p>
              ・電子メール：
              {(
                contract.cooling_off_email?.trim() ||
                salon.email?.trim() ||
                '（未登録）'
              )}
            </p>
            <p>
              電子メールでクーリングオフを行う場合は、件名に「クーリングオフ通知」と記載し、契約年月日・契約者名・契約金額・通知日を本文に記載してください。送信メールは必ず保存しておいてください。
            </p>
          </div>
        </div>

        {/* 中途解約・返金 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            中途解約・返金について
          </h3>
          <div className="text-xs text-text-sub leading-relaxed bg-[#F8F5FF] p-3 rounded-lg">
            <p>クーリングオフ期間経過後も、契約期間中は中途解約が可能です。中途解約時の精算は以下のとおりです。</p>
            <p className="mt-2 font-medium text-text-main">【役務提供開始前】</p>
            <p>解約手数料: 2万円または契約残額の10%のいずれか低い額</p>
            <p className="mt-2 font-medium text-text-main">【役務提供開始後】</p>
            <p>解約手数料: 5万円または契約残額の20%のいずれか低い額</p>
            <p className="mt-1">返金額 = 契約金額 - 既提供役務の対価 - 解約手数料</p>
          </div>
        </div>

        {/* 損害賠償上限 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            損害賠償上限額
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            施術に起因する損害が発生した場合、事業者の賠償責任は契約金額を上限とします。ただし、事業者の故意または重過失による場合はこの限りではありません。
          </p>
        </div>

        {/* 禁忌事項・免責 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            禁忌事項・免責事項
          </h3>
          <div className="text-xs text-text-sub leading-relaxed">
            <p>以下に該当する場合、施術をお断りまたは中止する場合があります。この場合、施術中止に伴う損害について事業者は責任を負いません。</p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>妊娠中またはその可能性がある場合</li>
              <li>施術部位に炎症・傷・皮膚疾患がある場合</li>
              <li>医師から施術を止められている場合</li>
              <li>事前カウンセリングで虚偽の申告をした場合</li>
              <li>飲酒状態での来店</li>
            </ul>
          </div>
        </div>

        {/* 個人情報 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            個人情報の取扱い
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            お客様の個人情報は、施術の提供・予約管理・アフターフォロー等の目的に限り使用します。法令に基づく場合を除き、お客様の同意なく第三者に提供することはありません。
          </p>
        </div>

        {/* 効果の個人差 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-text-main mb-2 border-b border-gray-300 pb-1">
            効果の個人差に関する説明
          </h3>
          <p className="text-xs text-text-sub leading-relaxed">
            施術の効果には個人差があり、すべてのお客様に同一の結果を保証するものではありません。効果の現れ方は体質・生活習慣・施術部位等により異なります。
          </p>
        </div>

        {/* 署名エリア */}
        <div className="border-t-2 border-text-main pt-4">
          <p className="text-sm text-text-main mb-1 font-medium">
            上記内容に同意し、契約を締結します。
          </p>
          <p className="text-xs text-text-sub mb-3">
            契約日: {new Date(contract.created_at).toLocaleDateString('ja-JP')}
          </p>

          {isSigned && contract.signature_image ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-text-sub">署名:</p>
              <img
                src={contract.signature_image}
                alt="署名"
                className="border border-gray-200 rounded-lg max-w-[300px] h-auto"
              />
              <p className="text-xs text-text-sub">
                署名日時: {contract.signed_at ? new Date(contract.signed_at).toLocaleString('ja-JP') : '—'}
              </p>
            </div>
          ) : (
            <div className="print:hidden">
              <p className="text-xs text-text-sub mb-2">下の枠内に署名してください:</p>
              <canvas
                ref={canvasRef}
                className="w-full h-[150px] border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none bg-white"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={clearCanvas}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50"
                >
                  クリア
                </button>
                <button
                  onClick={handleSign}
                  disabled={signing}
                  className="flex-1 py-2 rounded-xl bg-rose text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> 署名中...
                    </>
                  ) : (
                    '同意して署名する'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-6 py-4 rounded-2xl shadow-lg bg-emerald-600 text-white font-medium print:hidden">
          {toast}
        </div>
      )}
    </div>
  )
}
