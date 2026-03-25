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

type ContractLineKind = 'menu' | 'ticket' | 'subscription'

/** 契約のコース名に使う行（メニュー / ticket_plans / subscription_plans） */
interface ContractLine {
  key: string
  kind: ContractLineKind
  /** course_name 用の表示（例: 【メニュー】フェイシャル60分） */
  courseLabel: string
  price: number
  category: string
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

  // コース選択（通常メニュー + 回数券プラン + サブスクプラン）
  const [contractLines, setContractLines] = useState<ContractLine[]>([])
  const [selectedLineKeys, setSelectedLineKeys] = useState<string[]>([])
  const [menuCategory, setMenuCategory] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | ContractLineKind>('all')

  const [treatmentContent, setTreatmentContent] = useState('')
  const [sessions, setSessions] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState<number | ''>(0)

  /** 支払い手段（DB payment_method） */
  const [instrumentMethod, setInstrumentMethod] = useState<
    'cash' | 'card' | 'loan' | 'transfer' | 'auto_billing'
  >('cash')
  const [cardBrand, setCardBrand] = useState<
    'visa' | 'master' | 'jcb' | 'amex' | 'diners' | 'unionpay' | 'other'
  >('visa')
  const [loanCompany, setLoanCompany] = useState('')

  /** 一括 / 分割（DB payment_type） */
  const [paymentType, setPaymentType] = useState<'lump_sum' | 'installment'>('lump_sum')
  const [installPreset, setInstallPreset] = useState<'3' | '6' | '12' | '24' | '36' | 'other'>('12')
  const [installOtherCount, setInstallOtherCount] = useState(18)
  const [installMonthly, setInstallMonthly] = useState<number | ''>(0)
  const [installFirst, setInstallFirst] = useState<number | ''>(0)
  const [installNote, setInstallNote] = useState('')

  /** 自動引き落とし（サブスク） */
  const [billingDay, setBillingDay] = useState(1)
  const [billingMethod, setBillingMethod] = useState<'card' | 'bank_transfer'>('card')
  const [firstBillingDate, setFirstBillingDate] = useState('')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'biannual' | 'annual'>(
    'monthly'
  )

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
    let cancelled = false
    Promise.all([
      fetch('/api/menus').then(r => r.json()),
      fetch('/api/tickets').then(r => r.json()),
      fetch('/api/subscription-plans').then(r => r.json()),
    ])
      .then(([mj, tj, sj]) => {
        if (cancelled) return
        type M = { id: string; name: string; price?: number; category?: string }
        type P = { id: string; name: string; price?: number; category?: string }
        const rawMenus = (mj.menus || []) as M[]
        const rawTickets = (tj.plans || []) as P[]
        const rawSubs = (sj.plans || []) as P[]
        const lines: ContractLine[] = []

        for (const m of rawMenus) {
          lines.push({
            key: `menu:${m.id}`,
            kind: 'menu',
            courseLabel: `【メニュー】${m.name}`,
            price: Number(m.price) || 0,
            category: String(m.category ?? '').trim(),
          })
        }
        for (const p of rawTickets) {
          lines.push({
            key: `ticket:${p.id}`,
            kind: 'ticket',
            courseLabel: `【回数券】${p.name}`,
            price: Number(p.price) || 0,
            category: String(p.category ?? '').trim(),
          })
        }
        for (const p of rawSubs) {
          lines.push({
            key: `sub:${p.id}`,
            kind: 'subscription',
            courseLabel: `【サブスク】${p.name}`,
            price: Number(p.price) || 0,
            category: String(p.category ?? '').trim(),
          })
        }
        lines.sort((a, b) => {
          const ord = (k: ContractLineKind) => (k === 'menu' ? 0 : k === 'ticket' ? 1 : 2)
          const d = ord(a.kind) - ord(b.kind)
          if (d !== 0) return d
          return a.courseLabel.localeCompare(b.courseLabel, 'ja')
        })
        setContractLines(lines)
      })
      .catch(() => {
        if (!cancelled) setContractLines([])
      })
    return () => {
      cancelled = true
    }
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

  // 選択時に合計金額を自動計算
  useEffect(() => {
    const total = selectedLineKeys.reduce((sum, key) => {
      const line = contractLines.find(l => l.key === key)
      return sum + (line?.price ?? 0)
    }, 0)
    if (total > 0) setAmount(total)
  }, [selectedLineKeys, contractLines])

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.includes(customerSearch) ||
    (c.name_kana && c.name_kana.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch))
  )

  const linesForKind =
    kindFilter === 'all' ? contractLines : contractLines.filter(l => l.kind === kindFilter)
  const categories = Array.from(
    new Set(linesForKind.map(l => l.category).filter(c => c.length > 0))
  ).sort((a, b) => a.localeCompare(b, 'ja'))
  const filteredLines = menuCategory
    ? linesForKind.filter(l => l.category === menuCategory)
    : linesForKind

  const kindFilterLabel = (k: typeof kindFilter) =>
    k === 'all' ? '全て' : k === 'menu' ? 'メニュー' : k === 'ticket' ? '回数券' : 'サブスク'

  const courseName = selectedLineKeys
    .map(key => contractLines.find(l => l.key === key)?.courseLabel)
    .filter(Boolean)
    .join(', ')

  const amountNum = Number(amount)
  const amountOk = !Number.isNaN(amountNum) && amountNum >= 0

  const installmentCountNum =
    installPreset === 'other'
      ? Math.max(2, installOtherCount || 2)
      : parseInt(installPreset, 10)

  const handleSubmit = async () => {
    if (!customerId || selectedLineKeys.length === 0 || !amountOk) return
    setSaving(true)
    try {
      const paymentDetail: PaymentDetail | null =
        paymentType === 'installment'
          ? {
              type: '分割',
              count: installmentCountNum,
              monthly: Number(installMonthly) || 0,
              first: Number(installFirst) || 0,
              note: installNote,
            }
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
          amount: amountNum,
          payment_type: paymentType,
          payment_method: instrumentMethod,
          payment_detail: paymentDetail,
          card_brand: instrumentMethod === 'card' ? cardBrand : null,
          loan_company: instrumentMethod === 'loan' ? loanCompany.trim() || null : null,
          installment_count: paymentType === 'installment' ? installmentCountNum : null,
          billing_cycle: instrumentMethod === 'auto_billing' ? billingCycle : null,
          billing_day: instrumentMethod === 'auto_billing' ? billingDay : null,
          billing_method: instrumentMethod === 'auto_billing' ? billingMethod : null,
          first_billing_date: instrumentMethod === 'auto_billing' ? firstBillingDate || null : null,
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

        {/* コース選択（メニュー / 回数券 / サブスク） */}
        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">コース（メニュー・回数券・サブスク） *</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(['all', 'menu', 'ticket', 'subscription'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKindFilter(k)
                  setMenuCategory('')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  kindFilter === k ? 'bg-rose text-white' : 'bg-gray-100 text-[#4A5568]'
                }`}
              >
                {kindFilterLabel(k)}
              </button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setMenuCategory('')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  menuCategory === '' ? 'bg-[#0891B2] text-white' : 'bg-gray-100 text-[#4A5568]'
                }`}
              >
                カテゴリ全て
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMenuCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    menuCategory === cat ? 'bg-[#0891B2] text-white' : 'bg-gray-100 text-[#4A5568]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto border border-[#BAE6FD] rounded-lg p-2 space-y-1">
            {filteredLines.length === 0 ? (
              <p className="text-xs text-[#4A5568] py-1">
                {contractLines.length === 0 ? '読み込み中、または項目がありません' : '該当するコースがありません'}
              </p>
            ) : (
              filteredLines.map(line => (
                <label
                  key={line.key}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#F0F9FF] ${
                    selectedLineKeys.includes(line.key) ? 'bg-[#F0F9FF] border border-rose/30' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLineKeys.includes(line.key)}
                    onChange={() => {
                      setSelectedLineKeys(prev =>
                        prev.includes(line.key) ? prev.filter(x => x !== line.key) : [...prev, line.key]
                      )
                    }}
                    className="accent-rose mt-0.5 shrink-0"
                  />
                  <span className="text-sm text-[#1A202C] flex-1 min-w-0 leading-snug">{line.courseLabel}</span>
                  <span className="text-xs text-[#4A5568] shrink-0 tabular-nums">¥{line.price.toLocaleString()}</span>
                </label>
              ))
            )}
          </div>
          {selectedLineKeys.length > 0 && (
            <p className="text-xs text-rose mt-1 font-medium">
              {selectedLineKeys.length}件選択 · 合計 ¥
              {selectedLineKeys
                .reduce((s, key) => s + (contractLines.find(l => l.key === key)?.price ?? 0), 0)
                .toLocaleString()}
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
          <label className="text-xs text-[#4A5568] mb-1 block">支払い方法</label>
          <select
            value={instrumentMethod}
            onChange={e =>
              setInstrumentMethod(e.target.value as typeof instrumentMethod)
            }
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="cash">現金</option>
            <option value="card">クレジットカード</option>
            <option value="loan">ローン</option>
            <option value="transfer">銀行振込</option>
            <option value="auto_billing">自動引き落とし（サブスク用）</option>
          </select>
        </div>

        {instrumentMethod === 'card' && (
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">カード種別</label>
            <select
              value={cardBrand}
              onChange={e => setCardBrand(e.target.value as typeof cardBrand)}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            >
              <option value="visa">VISA</option>
              <option value="master">Mastercard</option>
              <option value="jcb">JCB</option>
              <option value="amex">AMEX</option>
              <option value="diners">Diners Club</option>
              <option value="unionpay">銀聯（UnionPay）</option>
              <option value="other">その他</option>
            </select>
          </div>
        )}

        {instrumentMethod === 'loan' && (
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">ローン会社名</label>
            <input
              type="text"
              value={loanCompany}
              onChange={e => setLoanCompany(e.target.value)}
              placeholder="例: ○○信販"
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {instrumentMethod === 'auto_billing' && (
          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-[#4A5568]">自動引き落とし（将来の Stripe 等と連携可能な項目）</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">引き落とし日（毎月）</label>
                <select
                  value={billingDay}
                  onChange={e => setBillingDay(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>
                      {d}日
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">初回決済日</label>
                <input
                  type="date"
                  value={firstBillingDate}
                  onChange={e => setFirstBillingDate(e.target.value)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">引き落とし方法</label>
              <select
                value={billingMethod}
                onChange={e => setBillingMethod(e.target.value as typeof billingMethod)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              >
                <option value="card">クレジットカード自動決済</option>
                <option value="bank_transfer">口座振替</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">決済サイクル</label>
              <select
                value={billingCycle}
                onChange={e => setBillingCycle(e.target.value as typeof billingCycle)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
              >
                <option value="monthly">毎月</option>
                <option value="quarterly">毎3ヶ月</option>
                <option value="biannual">毎6ヶ月</option>
                <option value="annual">毎年</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-[#4A5568] mb-1 block">支払い回数</label>
          <select
            value={paymentType}
            onChange={e => setPaymentType(e.target.value as typeof paymentType)}
            className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
          >
            <option value="lump_sum">一括</option>
            <option value="installment">分割</option>
          </select>
        </div>

        {paymentType === 'installment' && (
          <div className="bg-[#F8F5FF] border border-[#BAE6FD] rounded-lg p-3 space-y-3">
            <p className="text-xs font-medium text-[#4A5568]">分割払い詳細</p>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">分割回数</label>
              <select
                value={installPreset}
                onChange={e =>
                  setInstallPreset(e.target.value as typeof installPreset)
                }
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm mb-2"
              >
                <option value="3">3回</option>
                <option value="6">6回</option>
                <option value="12">12回</option>
                <option value="24">24回</option>
                <option value="36">36回</option>
                <option value="other">その他</option>
              </select>
              {installPreset === 'other' && (
                <input
                  type="number"
                  min={2}
                  value={installOtherCount}
                  onChange={e => setInstallOtherCount(parseInt(e.target.value, 10) || 2)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  placeholder="回数"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
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
          disabled={saving || !customerId || selectedLineKeys.length === 0 || !amountOk}
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
