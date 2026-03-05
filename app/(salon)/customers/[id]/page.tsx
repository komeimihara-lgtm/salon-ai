'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  User,
  Phone,
  X,
  Loader2,
  Ticket,
  Minus,
  Repeat,
} from 'lucide-react'
import { DEMO_SALON_ID } from '@/lib/supabase'
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
import { getCategories, DEFAULT_CATEGORIES } from '@/lib/menus'
import {
  fetchCustomerSubscriptions,
  fetchSubscriptionPlans,
  addCustomerSubscription,
  useSubscriptionSession,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
  daysUntilNextBilling,
  type CustomerSubscription,
} from '@/lib/subscriptions'

interface Customer {
  id: string
  name: string
  name_kana?: string
  phone?: string
  visit_count: number
  avg_unit_price?: number
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [subs, setSubs] = useState<CustomerSubscription[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [packs, setPacks] = useState<TicketPlan[]>([])
  const [subPlans, setSubPlans] = useState<Awaited<ReturnType<typeof fetchSubscriptionPlans>>>([])
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [selectedPack, setSelectedPack] = useState<TicketPlan | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<CustomerTicket | null>(null)
  const [subPurchaseOpen, setSubPurchaseOpen] = useState(false)
  const [selectedSubPlan, setSelectedSubPlan] = useState<Awaited<ReturnType<typeof fetchSubscriptionPlans>>[0] | null>(null)
  const [subUseTarget, setSubUseTarget] = useState<CustomerSubscription | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [ticketModalCategory, setTicketModalCategory] = useState('')
  const [subModalCategory, setSubModalCategory] = useState('')

  const refresh = useCallback(async () => {
    if (!id) return
    setTicketsLoading(true)
    try {
      const [ticketsResult, packsResult, subsResult, plansResult] = await Promise.allSettled([
        fetchCustomerTickets(id),
        fetchTicketPlans(DEMO_SALON_ID),
        fetchCustomerSubscriptions(id),
        fetchSubscriptionPlans(DEMO_SALON_ID),
      ])
      setTickets(ticketsResult.status === 'fulfilled' ? ticketsResult.value : [])
      setPacks(packsResult.status === 'fulfilled' ? packsResult.value : [])
      setSubs(subsResult.status === 'fulfilled' ? subsResult.value.map(s => ensureBillingPeriodCurrent(s)) : [])
      setSubPlans(plansResult.status === 'fulfilled' ? plansResult.value : [])
      if (ticketsResult.status === 'rejected') console.error('fetchCustomerTickets:', ticketsResult.reason)
      if (packsResult.status === 'rejected') console.error('fetchTicketPlans:', packsResult.reason)
      if (subsResult.status === 'rejected') console.error('fetchCustomerSubscriptions:', subsResult.reason)
      if (plansResult.status === 'rejected') console.error('fetchSubscriptionPlans:', plansResult.reason)
    } finally {
      setTicketsLoading(false)
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/customers/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setCustomer(data.customer ?? null)
      })
      .catch(() => { if (!cancelled) setCustomer(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (customer) refresh()
  }, [customer, refresh])

  const ticketCategories = getCategories()
  const categoriesForTicket = ticketCategories.length ? ticketCategories : DEFAULT_CATEGORIES
  const categoriesForSub = ticketCategories.length ? ticketCategories : DEFAULT_CATEGORIES
  const filteredPacksForModal = ticketModalCategory
    ? packs.filter(p => (p.category || '') === ticketModalCategory)
    : packs
  const filteredSubPlansForModal = subModalCategory
    ? subPlans.filter(p => (p.category || '') === subModalCategory)
    : subPlans

  const handlePurchase = async () => {
    if (!selectedPack || !customer) return
    setActionLoading(true)
    try {
      await addCustomerTicket(customer.id, customer.name, selectedPack)
      await refresh()
      setPurchaseOpen(false)
      setSelectedPack(null)
    } catch {
      alert('登録に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConsume = async (c: CustomerTicket) => {
    setActionLoading(true)
    try {
      const ok = await consumeTicket(c.id)
      if (ok) await refresh()
      setConsumeTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubJoin = async () => {
    if (!selectedSubPlan || !customer) return
    setActionLoading(true)
    try {
      await addCustomerSubscription(customer.id, customer.name, selectedSubPlan)
      await refresh()
      setSubPurchaseOpen(false)
      setSelectedSubPlan(null)
    } catch {
      alert('登録に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubUse = async (s: CustomerSubscription) => {
    setActionLoading(true)
    try {
      const ok = await useSubscriptionSession(s.id)
      if (ok) await refresh()
      setSubUseTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-rose animate-spin" />
      </div>
    )
  }
  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-text-sub mb-4">顧客が見つかりません</p>
        <Link href="/customers" className="text-rose font-medium hover:underline">
          顧客一覧に戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <Link href="/customers" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <Link
          href={`/chart/${customer.id}`}
          className="px-3 py-1.5 rounded-lg bg-rose text-white text-sm font-medium hover:opacity-90"
        >
          カルテ
        </Link>
      </div>

      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-rose/20 to-lavender/20 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-rose" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1A202C]">{customer.name} 様</h1>
            {customer.phone && (
              <p className="text-sm text-[#4A5568] flex items-center gap-1 mt-0.5">
                <Phone className="w-4 h-4" /> {customer.phone}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[#4A5568]">来店回数</p>
            <p className="font-bold text-[#1A202C]">{customer.visit_count}回</p>
          </div>
          <div>
            <p className="text-xs text-[#4A5568]">客単価</p>
            <p className="font-bold text-[#1A202C]">
              ¥{(customer.avg_unit_price ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 保有コース */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-main flex items-center gap-2">
            <Ticket className="w-4 h-4 text-rose" />
            保有回数券
          </h2>
          <button
            onClick={() => setPurchaseOpen(true)}
            className="text-xs font-semibold text-rose hover:underline"
          >
            + 購入
          </button>
        </div>
        {ticketsLoading ? (
          <p className="text-sm text-text-sub py-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </p>
        ) : tickets.length === 0 ? (
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
                    expired ? 'bg-red-500/10' : 'bg-[#F8F5FF] border border-[#BAE6FD]'
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
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded disabled:opacity-50"
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

      {/* サブスク */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-main flex items-center gap-2">
            <Repeat className="w-4 h-4 text-rose" />
            サブスク
          </h2>
          <button
            onClick={() => setSubPurchaseOpen(true)}
            className="text-xs font-semibold text-rose hover:underline"
          >
            + 加入
          </button>
        </div>
        {ticketsLoading ? (
          <p className="text-sm text-text-sub py-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-[#4A5568] py-2">サブスク加入はありません</p>
        ) : (
          <div className="space-y-2">
            {subs.map(s => {
              const remaining = getRemainingSessions(s)
              const days = daysUntilNextBilling(s)
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F8F5FF] border border-[#BAE6FD]"
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
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded disabled:opacity-50"
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

      {/* コース購入モーダル */}
      {purchaseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">コースを選択</h3>
              <button onClick={() => { setPurchaseOpen(false); setSelectedPack(null) }} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setTicketModalCategory('')}
                className={`px-2 py-1 rounded-lg text-xs font-medium ${!ticketModalCategory ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
              >
                全て
              </button>
              {categoriesForTicket.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTicketModalCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${ticketModalCategory === cat ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {filteredPacksForModal.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPack(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedPack?.id === p.id ? 'border-rose bg-rose/5' : 'border-gray-200'
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
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handlePurchase}
                disabled={!selectedPack || actionLoading}
                className="flex-1 py-2 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '登録中...' : '購入登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブスク加入モーダル */}
      {subPurchaseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">プランを選択</h3>
              <button onClick={() => { setSubPurchaseOpen(false); setSelectedSubPlan(null) }} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setSubModalCategory('')}
                className={`px-2 py-1 rounded-lg text-xs font-medium ${!subModalCategory ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
              >
                全て
              </button>
              {categoriesForSub.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSubModalCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${subModalCategory === cat ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {filteredSubPlansForModal.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSubPlan(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedSubPlan?.id === p.id ? 'border-rose bg-rose/5' : 'border-gray-200'
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
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubJoin}
                disabled={!selectedSubPlan || actionLoading}
                className="flex-1 py-2 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '登録中...' : '加入登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 回数券消化確認 */}
      {consumeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full">
            <p className="text-sm mb-4">{consumeTarget.planName} を1回消化しますか？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConsumeTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg border"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleConsume(consumeTarget)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '処理中...' : '消化する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブスク利用確認 */}
      {subUseTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full">
            <p className="text-sm mb-4">{subUseTarget.planName} を1回利用しますか？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSubUseTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg border"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSubUse(subUseTarget)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '処理中...' : '利用する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
