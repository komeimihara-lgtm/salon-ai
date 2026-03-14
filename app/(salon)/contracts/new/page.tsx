'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface CustomerOption {
  id: string
  name: string
  phone?: string
}

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetCustomerId = searchParams.get('customer_id') || ''

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerId, setCustomerId] = useState(presetCustomerId)
  const [courseName, setCourseName] = useState('')
  const [treatmentContent, setTreatmentContent] = useState('')
  const [sessions, setSessions] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState<number | ''>(0)
  const [paymentMethod, setPaymentMethod] = useState('lump_sum')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/customers/list')
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!customerId || !courseName || !amount) return
    setSaving(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          course_name: courseName,
          treatment_content: treatmentContent || null,
          sessions: sessions || null,
          start_date: startDate || null,
          end_date: endDate || null,
          amount: Number(amount),
          payment_method: paymentMethod,
        }),
      })
      const data = await res.json()
      if (res.ok && data.contract) {
        router.push(`/contracts/${data.contract.id}`)
      } else {
        alert(data.error || '作成に失敗しました')
      }
    } catch {
      alert('作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/contracts" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-text-main">新規契約書作成</h1>
      </div>

      <div className="bg-white rounded-2xl p-5 card-shadow space-y-4">
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">顧客 *</label>
          <select
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">選択してください</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` (${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">コース名 *</label>
          <input
            type="text"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            placeholder="例: 全身脱毛コース"
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">施術内容</label>
          <textarea
            value={treatmentContent}
            onChange={e => setTreatmentContent(e.target.value)}
            rows={3}
            placeholder="施術内容の詳細を入力..."
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">回数</label>
          <input
            type="number"
            min={1}
            value={sessions}
            onChange={e => setSessions(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="例: 12"
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

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">契約金額 *</label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={e => setAmount(e.target.value ? parseInt(e.target.value) : '')}
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">支払方法</label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="lump_sum">一括払い</option>
            <option value="installment">分割払い</option>
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || !customerId || !courseName || !amount}
          className="w-full py-3 rounded-xl bg-rose text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 作成中...
            </>
          ) : (
            '契約書を作成'
          )}
        </button>
      </div>
    </div>
  )
}

export default function NewContractPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-rose animate-spin" />
      </div>
    }>
      <NewContractForm />
    </Suspense>
  )
}
