'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Loader2, Search } from 'lucide-react'
import Link from 'next/link'

interface CustomerOption {
  id: string
  name: string
  name_kana?: string
  phone?: string
}

interface MenuItem {
  id: string
  name: string
  duration: number
  price: number
  category?: string
}

interface PaymentDetail {
  type: string
  count: number
  monthly: number
  first: number
  note: string
}

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetCustomerId = searchParams.get('customer_id') || ''

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerId, setCustomerId] = useState(presetCustomerId)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // メニュー選択
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [selectedMenus, setSelectedMenus] = useState<string[]>([])
  const [menuCategory, setMenuCategory] = useState('')

  const [treatmentContent, setTreatmentContent] = useState('')
  const [sessions, setSessions] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState<number | ''>(0)
  const [paymentMethod, setPaymentMethod] = useState('lump_sum')

  // 分割詳細
  const [installCount, setInstallCount] = useState(12)
  const [installMonthly, setInstallMonthly] = useState<number | ''>(0)
  const [installFirst, setInstallFirst] = useState<number | ''>(0)
  const [installNote, setInstallNote] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/customers/list?limit=100')
      .then(r => r.json())
      .then(d => {
        const list = (d.customers || []) as CustomerOption[]
        list.sort((a: CustomerOption, b: CustomerOption) =>
          (a.name_kana || a.name).localeCompare(b.name_kana || b.name, 'ja')
        )
        setCustomers(list)
        if (presetCustomerId) {
          const found = list.find((c: CustomerOption) => c.id === presetCustomerId)
          if (found) setSelectedCustomerName(found.name)
        }
      })
      .catch(() => {})
  }, [presetCustomerId])

  useEffect(() => {
    fetch('/api/menus')
      .then(r => r.json())
      .then(d => setMenus(d.menus || []))
      .catch(() => {})
  }, [])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // メニュー選択時に合計金額を自動計算
  useEffect(() => {
    const total = selectedMenus.reduce((sum, name) => {
      const m = menus.find(menu => menu.name === name)
      return sum + (m?.price ?? 0)
    }, 0)
    if (total > 0) setAmount(total)
  }, [selectedMenus, menus])

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.includes(customerSearch) ||
    (c.name_kana && c.name_kana.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch))
  )

  const categories = Array.from(new Set(menus.map(m => m.category || '').filter(Boolean)))
  const filteredMenus = menuCategory
    ? menus.filter(m => (m.category || '') === menuCategory)
    : menus

  const courseName = selectedMenus.join(', ')

  const handleSubmit = async () => {
    if (!customerId || selectedMenus.length === 0 || !amount) return
    setSaving(true)
    try {
      const paymentDetail: PaymentDetail | null = paymentMethod === 'installment'
        ? { type: '分割', count: installCount, monthly: Number(installMonthly) || 0, first: Number(installFirst) || 0, note: installNote }
        : null

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
          payment_detail: paymentDetail,
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
        {/* 顧客選択 */}
        <div ref={dropdownRef} className="relative">
          <label className="text-xs text-[#4A5568] mb-1 block">顧客 *</label>
          <div
            onClick={() => setCustomerDropdownOpen(true)}
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
          >
            <span className={selectedCustomerName ? 'text-[#1A202C]' : 'text-[#A0AEC0]'}>
              {selectedCustomerName || '顧客を選択してください'}
            </span>
            <Search className="w-4 h-4 text-[#A0AEC0]" />
          </div>
          {customerDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#BAE6FD] rounded-lg shadow-xl z-20 max-h-64 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-[#BAE6FD]">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="名前・カナ・電話番号で検索..."
                  className="w-full bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0891B2]"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-48">
                {filteredCustomers.length === 0 ? (
                  <p className="px-3 py-3 text-[#4A5568] text-sm">該当する顧客がいません</p>
                ) : (
                  filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id)
                        setSelectedCustomerName(c.name)
                        setCustomerDropdownOpen(false)
                        setCustomerSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F0F9FF] flex items-center justify-between ${
                        customerId === c.id ? 'bg-[#F0F9FF] font-medium' : ''
                      }`}
                    >
                      <span className="text-[#1A202C]">{c.name}</span>
                      {c.phone && <span className="text-xs text-[#4A5568]">{c.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* メニュー選択（複数） */}
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">コース（メニュー選択） *</label>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setMenuCategory('')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  menuCategory === '' ? 'bg-rose text-white' : 'bg-gray-100 text-[#4A5568]'
                }`}
              >
                全て
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMenuCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    menuCategory === cat ? 'bg-rose text-white' : 'bg-gray-100 text-[#4A5568]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-40 overflow-y-auto border border-[#BAE6FD] rounded-lg p-2 space-y-1">
            {filteredMenus.length === 0 ? (
              <p className="text-xs text-[#4A5568] py-1">メニューがありません</p>
            ) : filteredMenus.map(m => (
              <label key={m.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#F0F9FF] ${
                selectedMenus.includes(m.name) ? 'bg-[#F0F9FF] border border-rose/30' : ''
              }`}>
                <input
                  type="checkbox"
                  checked={selectedMenus.includes(m.name)}
                  onChange={() => {
                    setSelectedMenus(prev =>
                      prev.includes(m.name) ? prev.filter(n => n !== m.name) : [...prev, m.name]
                    )
                  }}
                  className="accent-rose"
                />
                <span className="text-sm text-[#1A202C]">{m.name}</span>
                <span className="text-xs text-[#4A5568] ml-auto">¥{m.price.toLocaleString()}</span>
              </label>
            ))}
          </div>
          {selectedMenus.length > 0 && (
            <p className="text-xs text-rose mt-1 font-medium">
              {selectedMenus.length}件選択 · 合計 ¥{menus.filter(m => selectedMenus.includes(m.name)).reduce((s, m) => s + m.price, 0).toLocaleString()}
            </p>
          )}
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

        {/* 分割詳細 */}
        {paymentMethod === 'installment' && (
          <div className="bg-[#F8F5FF] border border-[#BAE6FD] rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-[#4A5568]">分割払い詳細</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">分割回数</label>
                <input
                  type="number"
                  min={2}
                  value={installCount}
                  onChange={e => setInstallCount(parseInt(e.target.value) || 2)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">月額</label>
                <input
                  type="number"
                  min={0}
                  value={installMonthly}
                  onChange={e => setInstallMonthly(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="¥10,000"
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">初回金額</label>
              <input
                type="number"
                min={0}
                value={installFirst}
                onChange={e => setInstallFirst(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="¥20,000"
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">備考</label>
              <input
                type="text"
                value={installNote}
                onChange={e => setInstallNote(e.target.value)}
                placeholder="例: 毎月27日引き落とし"
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !customerId || selectedMenus.length === 0 || !amount}
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
