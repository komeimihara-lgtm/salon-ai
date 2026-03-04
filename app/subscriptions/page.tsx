'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Repeat,
  Plus,
  Minus,
  X,
  Search,
  Loader2,
  Calendar,
  Pause,
  Play,
} from 'lucide-react'
import {
  getSubscriptionPlans,
  getCustomerSubscriptions,
  addCustomerSubscription,
  useSubscriptionSession,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
  daysUntilNextBilling,
  type CustomerSubscription,
  type SubscriptionPlan,
} from '@/lib/subscriptions'
import { Customer } from '@/types'

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [useModalOpen, setUseModalOpen] = useState<CustomerSubscription | null>(null)

  const refresh = useCallback(() => {
    const all = getCustomerSubscriptions()
    setSubscriptions(all.map(s => ensureBillingPeriodCurrent(s)))
    setPlans(getSubscriptionPlans())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('customer-subscriptions-updated', handler)
    window.addEventListener('subscription-plans-updated', () => setPlans(getSubscriptionPlans()))
    return () => {
      window.removeEventListener('customer-subscriptions-updated', handler)
      window.removeEventListener('subscription-plans-updated', () => {})
    }
  }, [refresh])

  const displaySubs =
    filter === 'active'
      ? subscriptions.filter(s => s.status === 'active')
      : filter === 'paused'
        ? subscriptions.filter(s => s.status === 'paused')
        : subscriptions

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans">サブスク管理</span>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'active' | 'paused')}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:border-rose outline-none"
          >
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="paused">一時停止</option>
          </select>
        </div>
        <button
          onClick={() => setPurchaseModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          加入登録
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden card-shadow">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-light-lav/50">
                <th className="text-left p-3 text-text-sub font-medium">お客様</th>
                <th className="text-left p-3 text-text-sub font-medium">プラン</th>
                <th className="text-left p-3 text-text-sub font-medium">今月の残り</th>
                <th className="text-left p-3 text-text-sub font-medium">次回課金</th>
                <th className="text-left p-3 text-text-sub font-medium">ステータス</th>
                <th className="text-left p-3 text-text-sub font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {displaySubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-sub">
                    サブスクの加入登録がありません
                    <br />
                    <span className="text-xs">
                      メニュー設定でサブスクプランを登録し、加入登録から顧客に紐づけてください
                    </span>
                  </td>
                </tr>
              ) : (
                displaySubs.map((s) => {
                  const remaining = getRemainingSessions(s)
                  const days = daysUntilNextBilling(s)
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="p-3 font-medium text-text-main">{s.customerName}</td>
                      <td className="p-3 text-text-main">
                        {s.planName}
                        <span className="text-xs text-text-sub ml-1">¥{s.price.toLocaleString()}/月</span>
                      </td>
                      <td className="p-3">
                        <span className={remaining <= 0 ? 'text-text-sub' : 'text-text-main'}>
                          {remaining} / {s.sessionsPerMonth}回
                        </span>
                      </td>
                      <td className="p-3 text-text-sub">
                        {s.nextBillingDate}
                        {s.status === 'active' && <span className="ml-1 text-xs">(残{days}日)</span>}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            s.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : s.status === 'paused'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-text-sub'
                          }`}
                        >
                          {s.status === 'active' ? '有効' : s.status === 'paused' ? '一時停止' : '解約'}
                        </span>
                      </td>
                      <td className="p-3">
                        {s.status === 'active' && remaining > 0 && (
                          <button
                            onClick={() => setUseModalOpen(s)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded-lg"
                          >
                            <Minus className="w-3 h-3" />
                            1回利用
                          </button>
                        )}
                        {s.status === 'paused' && (
                          <button
                            onClick={() => {
                              resumeSubscription(s.id)
                              refresh()
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600"
                          >
                            <Play className="w-3 h-3" />
                            再開
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-text-sub">
        <Link href="/menu-settings" className="text-rose hover:underline">
          メニュー設定
        </Link>
        でサブスクプランを登録できます
      </p>

      {purchaseModalOpen && (
        <PurchaseModal
          plans={plans}
          onClose={() => setPurchaseModalOpen(false)}
          onSaved={refresh}
        />
      )}

      {useModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-text-main mb-2">1回利用しますか？</h3>
            <p className="text-sm text-text-sub mb-4">
              {useModalOpen.customerName} 様の {useModalOpen.planName}
              <br />
              今月の残り {getRemainingSessions(useModalOpen)}回 → {getRemainingSessions(useModalOpen) - 1}回
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUseModalOpen(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  useSubscriptionSession(useModalOpen.id)
                  refresh()
                  setUseModalOpen(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium"
              >
                利用する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PurchaseModal({
  plans,
  onClose,
  onSaved,
}: {
  plans: SubscriptionPlan[]
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'customer' | 'plan'>('customer')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')

  const fetchCustomers = useCallback(async () => {
    if (!search.trim()) {
      setCustomers([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/list?search=${encodeURIComponent(search)}&page=1`)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(t)
  }, [fetchCustomers])

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerName(c.name)
    setCustomerId(c.id)
    setStep('plan')
  }

  const handleManualCustomer = () => {
    if (!customerName.trim()) return
    setSelectedCustomer({
      id: `local-${Date.now()}`,
      salon_id: '',
      name: customerName.trim(),
      visit_count: 0,
      total_spent: 0,
      avg_unit_price: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setCustomerId(`local-${Date.now()}`)
    setStep('plan')
  }

  const handleJoin = () => {
    if (!selectedPlan) return
    const cid = selectedCustomer?.id ?? (customerId || `local-${Date.now()}`)
    const cname = selectedCustomer?.name ?? (customerName.trim() || '未登録顧客')
    addCustomerSubscription(cid, cname, selectedPlan)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-main">
            {step === 'customer' ? '顧客を選択' : 'プランを選択'}
          </h3>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-text-main rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'customer' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="氏名で検索..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              />
            </div>
            <div>
              <p className="text-xs text-text-sub mb-2">または直接入力</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="顧客名"
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200"
                />
                <button
                  onClick={handleManualCustomer}
                  disabled={!customerName.trim()}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-text-main font-medium disabled:opacity-50"
                >
                  選択
                </button>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-rose" />
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {customers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-light-lav/50 flex justify-between"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-text-sub">{c.visit_count}回来店</span>
                  </button>
                ))}
                {search && !loading && customers.length === 0 && (
                  <p className="text-sm text-text-sub py-4 text-center">該当する顧客がいません</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-sub">
              加入者: <span className="font-medium text-text-main">{selectedCustomer?.name ?? customerName}</span>
            </p>
            <button
              onClick={() => setStep('customer')}
              className="text-xs text-rose hover:underline"
            >
              ← 顧客を変更
            </button>
            <div className="space-y-2">
              {plans.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                    selectedPlan?.id === p.id
                      ? 'border-rose bg-rose/5'
                      : 'border-gray-200 hover:border-rose/50'
                  }`}
                >
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">
                    ¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回 · 毎月{p.billingDay}日課金
                  </p>
                </button>
              ))}
            </div>
            {plans.length === 0 && (
              <p className="text-sm text-text-sub">メニュー設定でサブスクプランを登録してください</p>
            )}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main"
              >
                キャンセル
              </button>
              <button
                onClick={handleJoin}
                disabled={!selectedPlan}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium disabled:opacity-50"
              >
                加入登録
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
