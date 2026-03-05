'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Users, Search, Plus, Upload, ChevronLeft, ChevronRight,
  AlertTriangle, Crown, Phone, X, Check, Loader2, Ticket, Minus, Repeat
} from 'lucide-react'
import { Customer } from '@/types'
import {
  fetchCustomerTickets,
  fetchTicketPlans,
  addCustomerTicket,
  consumeTicket,
  isTicketExpired,
  daysUntilTicketExpiry,
  type CustomerTicket,
  type TicketPlan,
} from '@/lib/tickets'
import {
  fetchCustomerSubscriptions,
  getSubscriptionPlans,
  addCustomerSubscription,
  useSubscriptionSession,
  pauseSubscription,
  resumeSubscription,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
  daysUntilNextBilling,
  type CustomerSubscription,
} from '@/lib/subscriptions'

// ステータスバッジ
function StatusBadge({ status }: { status: Customer['status'] }) {
  const map = {
    active: { label: 'アクティブ', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    lost: { label: '失客', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
    vip: { label: 'VIP', color: 'bg-amber-500/20 text-[#0891B2] border-amber-500/30' },
  }
  const { label, color } = map[status]
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {status === 'vip' && <Crown className="w-3 h-3 inline mr-1" />}
      {status === 'lost' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
      {label}
    </span>
  )
}

// 顧客詳細モーダル（コース表示・購入・消化）
function CustomerDetailModal({
  customer,
  onClose,
  onCourseUpdated,
}: {
  customer: Customer
  onClose: () => void
  onCourseUpdated?: () => void
}) {
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [packs, setPacks] = useState<TicketPlan[]>([])
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [selectedPack, setSelectedPack] = useState<TicketPlan | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<CustomerTicket | null>(null)

  const [subs, setSubs] = useState<CustomerSubscription[]>([])
  const [subPlans, setSubPlans] = useState<ReturnType<typeof getSubscriptionPlans>>([])
  const [subPurchaseOpen, setSubPurchaseOpen] = useState(false)
  const [selectedSubPlan, setSelectedSubPlan] = useState<ReturnType<typeof getSubscriptionPlans>[0] | null>(null)
  const [subUseTarget, setSubUseTarget] = useState<CustomerSubscription | null>(null)

  const refresh = useCallback(async () => {
    const [ticketsData, packsData, subsData] = await Promise.all([
      fetchCustomerTickets(customer.id),
      fetchTicketPlans(),
      fetchCustomerSubscriptions(customer.id),
    ])
    setTickets(ticketsData)
    setPacks(packsData)
    setSubs(subsData.map(s => ensureBillingPeriodCurrent(s)))
    setSubPlans(getSubscriptionPlans())
    onCourseUpdated?.()
  }, [customer.id, onCourseUpdated])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('customer-tickets-updated', handler)
    window.addEventListener('customer-subscriptions-updated', handler)
    return () => {
      window.removeEventListener('customer-tickets-updated', handler)
      window.removeEventListener('customer-subscriptions-updated', handler)
    }
  }, [refresh])

  const handlePurchase = async () => {
    if (!selectedPack) return
    try {
      await addCustomerTicket(customer.id, customer.name, selectedPack)
      refresh()
      setPurchaseOpen(false)
      setSelectedPack(null)
    } catch (e) {
      alert('登録に失敗しました')
    }
  }

  const handleConsume = async (c: CustomerTicket) => {
    const ok = await consumeTicket(c.id)
    if (ok) refresh()
    setConsumeTarget(null)
  }

  const handleSubJoin = async () => {
    if (!selectedSubPlan) return
    try {
      await addCustomerSubscription(customer.id, customer.name, selectedSubPlan)
      refresh()
      setSubPurchaseOpen(false)
      setSelectedSubPlan(null)
    } catch (e) {
      alert('登録に失敗しました')
    }
  }

  const handleSubUse = async (s: CustomerSubscription) => {
    const ok = await useSubscriptionSession(s.id)
    if (ok) refresh()
    setSubUseTarget(null)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">{customer.name} 様</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/chart/${customer.id}`}
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-rose text-white text-sm font-medium hover:opacity-90"
            >
              カルテ
            </Link>
            <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[#4A5568]">来店回数</p>
              <p className="font-bold text-[#1A202C]">{customer.visit_count}回</p>
            </div>
            <div>
              <p className="text-xs text-[#4A5568]">客単価</p>
              <p className="font-bold text-[#1A202C]">¥{customer.avg_unit_price.toLocaleString()}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#1A202C] flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                保有回数券
              </h3>
                <button
                  onClick={() => setPurchaseOpen(true)}
                  className="text-xs font-semibold text-rose hover:underline"
                >
                  + 回数券購入
                </button>
            </div>
            {tickets.length === 0 ? (
              <p className="text-sm text-[#4A5568] py-2">保有回数券はありません</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(c => {
                  const expired = isTicketExpired(c)
                  const days = daysUntilTicketExpiry(c)
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                        expired ? 'bg-red-500/10' : 'bg-white border border-[#BAE6FD]'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1A202C]">{c.planName}</p>
                        <p className="text-xs text-[#4A5568]">
                          残り{c.remainingSessions}/{c.totalSessions}回 · 期限{c.expiryDate ?? '—'}
                          {!expired && c.remainingSessions > 0 && ` (残${days}日)`}
                        </p>
                      </div>
                      {c.remainingSessions > 0 && !expired && (
                        <button
                          onClick={() => setConsumeTarget(c)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded"
                        >
                          <Minus className="w-3 h-3" />消化
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[#1A202C] flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                サブスク
              </h3>
              <button
                onClick={() => setSubPurchaseOpen(true)}
                className="text-xs font-semibold text-rose hover:underline"
              >
                + 加入
              </button>
            </div>
            {subs.length === 0 ? (
              <p className="text-sm text-[#4A5568] py-2">サブスク加入はありません</p>
            ) : (
              <div className="space-y-2">
                {subs.map(s => {
                  const remaining = getRemainingSessions(s)
                  const days = daysUntilNextBilling(s)
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#BAE6FD]"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1A202C]">{s.planName}</p>
                        <p className="text-xs text-[#4A5568]">
                          今月残り{remaining}/{s.sessionsPerMonth}回 · 次回課金{s.nextBillingDate}（残{days}日）
                        </p>
                      </div>
                      {remaining > 0 && (
                        <button
                          onClick={() => setSubUseTarget(s)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded"
                        >
                          <Minus className="w-3 h-3" />利用
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {purchaseOpen && (
          <div className="p-5 border-t border-[#BAE6FD] bg-white/50 rounded-b-2xl">
            <p className="text-sm font-medium text-[#1A202C] mb-2">回数券を選択</p>
            <div className="space-y-2 mb-4">
              {packs.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPack(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedPack?.id === p.id ? 'border-rose bg-rose/5' : 'border-[#BAE6FD]'
                  }`}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[#4A5568]">
                    ¥{p.price.toLocaleString()} · {p.totalSessions}回
                    {p.expiryDays ? ` · 有効${p.expiryDays}日` : ''}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPurchaseOpen(false); setSelectedPack(null) }}
                className="flex-1 py-2 rounded-xl border border-[#BAE6FD] text-[#4A5568]"
              >
                キャンセル
              </button>
              <button
                onClick={handlePurchase}
                disabled={!selectedPack}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white font-bold disabled:opacity-50"
              >
                購入登録
              </button>
            </div>
          </div>
        )}

        {subPurchaseOpen && (
          <div className="p-5 border-t border-[#BAE6FD] bg-white/50 rounded-b-2xl">
            <p className="text-sm font-medium text-[#1A202C] mb-2">プランを選択</p>
            <div className="space-y-2 mb-4">
              {subPlans.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSubPlan(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedSubPlan?.id === p.id ? 'border-rose bg-rose/5' : 'border-[#BAE6FD]'
                  }`}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[#4A5568]">
                    ¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setSubPurchaseOpen(false); setSelectedSubPlan(null) }}
                className="flex-1 py-2 rounded-xl border border-[#BAE6FD] text-[#4A5568]"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubJoin}
                disabled={!selectedSubPlan}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white font-bold disabled:opacity-50"
              >
                加入登録
              </button>
            </div>
          </div>
        )}

        {consumeTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl p-5 max-w-sm w-full">
              <p className="text-sm mb-4">
                {consumeTarget.planName} を1回消化しますか？
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConsumeTarget(null)}
                  className="flex-1 py-2 rounded-lg border"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleConsume(consumeTarget)}
                  className="flex-1 py-2 rounded-lg bg-rose text-white font-medium"
                >
                  消化する
                </button>
              </div>
            </div>
          </div>
        )}

        {subUseTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl p-5 max-w-sm w-full">
              <p className="text-sm mb-4">
                {subUseTarget.planName} を1回利用しますか？
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSubUseTarget(null)}
                  className="flex-1 py-2 rounded-lg border"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSubUse(subUseTarget)}
                  className="flex-1 py-2 rounded-lg bg-rose text-white font-medium"
                >
                  利用する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 顧客カード
function CustomerCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const daysSinceVisit = customer.last_visit_date
    ? Math.floor((Date.now() - new Date(customer.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div
      onClick={onClick}
      className="bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] hover:border-[#0891B2] rounded-xl p-4 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/chart/${customer.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-bold text-[#1A202C] group-hover:text-[#0891B2] transition-colors hover:underline"
            >
              {customer.name}
            </Link>
            {customer.name_kana && (
              <span className="text-xs text-[#4A5568]">{customer.name_kana}</span>
            )}
          </div>
          {customer.phone && (
            <div className="flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-[#4A5568]" />
              <span className="text-xs text-[#4A5568]">{customer.phone}</span>
            </div>
          )}
        </div>
        <StatusBadge status={customer.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#BAE6FD]">
        <div className="text-center">
          <p className="text-xs text-[#4A5568]">来店回数</p>
          <p className="text-sm font-bold text-[#1A202C]">{customer.visit_count}回</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#4A5568]">客単価</p>
          <p className="text-sm font-bold text-[#1A202C]">
            ¥{customer.avg_unit_price.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[#4A5568]">最終来店</p>
          <p className={`text-sm font-bold ${
            daysSinceVisit && daysSinceVisit > 90 ? 'text-red-600' :
            daysSinceVisit && daysSinceVisit > 60 ? 'text-[#0891B2]' : 'text-[#1A202C]'
          }`}>
            {daysSinceVisit !== null ? `${daysSinceVisit}日前` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// 新規顧客モーダル
function NewCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', name_kana: '', phone: '', email: '',
    birthday: '', gender: 'female', memo: '',
    first_visit_date: '', last_visit_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.name.trim()) { setError('氏名は必須です'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">新規顧客登録</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">氏名 *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="山田 花子"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">フリガナ</label>
              <input
                value={form.name_kana}
                onChange={e => setForm(p => ({ ...p, name_kana: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="ヤマダ ハナコ"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">電話番号</label>
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="090-0000-0000"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">性別</label>
              <select
                value={form.gender}
                onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
              >
                <option value="female">女性</option>
                <option value="male">男性</option>
                <option value="other">その他</option>
                <option value="unknown">不明</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メールアドレス</label>
            <input
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
              placeholder="example@email.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">初回来店日</label>
              <input
                type="date"
                value={form.first_visit_date}
                onChange={e => setForm(p => ({ ...p, first_visit_date: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
              />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">最終来店日</label>
              <input
                type="date"
                value={form.last_visit_date}
                onChange={e => setForm(p => ({ ...p, last_visit_date: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メモ</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={3}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2] resize-none"
              placeholder="肌タイプ、アレルギー、特記事項など"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#BAE6FD]">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm hover:text-[#1A202C] transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? '保存中...' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// CSVインポートモーダル
function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (count: number) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; message: string } | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setError('')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) { setError('データが空です'); return }

      // CSVパース（ヘッダー行 + データ行）
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
      })

      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult(data)
      onImported(data.imported)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">ペンギン CSVインポート</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  ペンギン（サロンズソリューション）から書き出したCSVファイルを選択してください。
                  氏名・電話番号・来店回数などが自動でマッピングされます。
                </p>
              </div>
              <div
                className="border-2 border-dashed border-[#BAE6FD] rounded-xl p-8 text-center cursor-pointer hover:border-[#0891B2] transition-colors"
                onClick={() => document.getElementById('csv-input')?.click()}
              >
                <Upload className="w-8 h-8 text-[#4A5568] mx-auto mb-2" />
                {file ? (
                  <p className="text-sm text-[#0891B2] font-medium">{file.name}</p>
                ) : (
                  <p className="text-sm text-[#4A5568]">CSVファイルを選択</p>
                )}
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-[#1A202C] mb-1">{result.imported}件 インポート完了</p>
              <p className="text-sm text-[#4A5568]">{result.message}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-[#BAE6FD]">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm hover:text-[#1A202C] transition-colors"
          >
            {result ? '閉じる' : 'キャンセル'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'インポート中...' : 'インポート開始'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15秒でタイムアウト
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      })
      const res = await fetch(`/api/customers/list?${params}`, { signal: controller.signal })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFetchError(data.error || `エラー (${res.status})`)
        setCustomers([])
        setTotal(0)
        return
      }
      setCustomers(data.customers || [])
      setTotal(data.total ?? 0)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setFetchError('通信がタイムアウトしました。しばらくしてから再試行してください。')
      } else {
        setFetchError(err instanceof Error ? err.message : '顧客データの取得に失敗しました')
      }
      setCustomers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const totalPages = Math.ceil(total / 20)
  const lostCount = customers.filter(c => c.status === 'lost').length
  const vipCount = customers.filter(c => c.status === 'vip').length

  return (
    <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-sub">{total.toLocaleString()}名</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-rose text-text-main rounded-lg px-3 py-1.5 text-xs transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              CSVインポート
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-rose to-lavender text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              新規登録
            </button>
          </div>
        </div>
        {/* アラートバー */}
        {lostCount > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">
                <span className="font-bold">失客アラート：</span>
                {lostCount}名が3ヶ月以上未来店です
              </p>
            </div>
            <Link href="/leo" className="text-xs text-red-600 hover:text-red-700 font-semibold underline">
              LEOに対策を相談 →
            </Link>
          </div>
        )}

        {/* 検索・フィルター */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="氏名・フリガナ・電話番号で検索..."
              className="w-full bg-[#F0F9FF] border border-[#BAE6FD] focus:border-[#0891B2] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#1A202C] placeholder-[#4A5568] focus:outline-none transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-3 py-2.5 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
          >
            <option value="">全員</option>
            <option value="active">アクティブ</option>
            <option value="lost">失客</option>
            <option value="vip">VIP</option>
          </select>
        </div>

        {/* 統計サマリー */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '総顧客数', value: total, icon: Users, color: 'text-blue-400' },
            { label: '失客', value: lostCount, icon: AlertTriangle, color: 'text-red-600' },
            { label: 'VIP', value: vipCount, icon: Crown, color: 'text-[#0891B2]' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <p className="text-xs text-[#4A5568]">{label}</p>
                <p className="text-lg font-bold text-[#1A202C]">{value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* エラー表示 */}
        {fetchError && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700 flex-1">{fetchError}</p>
            <button
              onClick={() => fetchCustomers()}
              className="text-xs font-semibold text-red-600 hover:text-red-700 underline whitespace-nowrap"
            >
              再試行
            </button>
          </div>
        )}

        {/* 顧客一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#0891B2] animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-[#4A5568] mx-auto mb-3" />
            <p className="text-[#4A5568] mb-2">
              {search || statusFilter ? '検索結果が見つかりません' : '顧客データがありません'}
            </p>
            {!search && !statusFilter && (
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  CSVでインポートする
                </button>
                <span className="text-[#4A5568]">or</span>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="text-sm text-[#0891B2] hover:text-amber-300 underline"
                >
                  手動で登録する
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customers.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => setSelectedCustomer(customer)}
              />
            ))}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center disabled:opacity-30 hover:border-[#0891B2] transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#4A5568]" />
            </button>
            <span className="text-sm text-[#4A5568]">
              {page} / {totalPages}ページ
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center disabled:opacity-30 hover:border-[#0891B2] transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#4A5568]" />
            </button>
          </div>
        )}

      {/* モーダル */}
      {showNewModal && (
        <NewCustomerModal
          onClose={() => setShowNewModal(false)}
          onSaved={fetchCustomers}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchCustomers()}
        />
      )}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}
