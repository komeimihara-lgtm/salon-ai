'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Ticket,
  Plus,
  AlertTriangle,
  Minus,
  X,
  Search,
  Loader2,
  Calendar,
} from 'lucide-react'
import {
  getCoursePacks,
  getCustomerCourses,
  setCustomerCourses,
  addCustomerCourse,
  consumeCourse,
  getExpiringSoon,
  getExpired,
  isExpired,
  daysUntilExpiry,
  type CustomerCourse,
  type CoursePack,
} from '@/lib/courses'
import { Customer } from '@/types'

export default function CoursesPage() {
  const [courses, setCourses] = useState<CustomerCourse[]>([])
  const [packs, setPacks] = useState<CoursePack[]>([])
  const [expiringSoon, setExpiringSoon] = useState<CustomerCourse[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring'>('all')
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [consumeModalOpen, setConsumeModalOpen] = useState<CustomerCourse | null>(null)

  const refresh = useCallback(() => {
    setCourses(getCustomerCourses())
    setPacks(getCoursePacks())
    setExpiringSoon(getExpiringSoon(30))
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener('customer-courses-updated', handler)
    window.addEventListener('course-packs-updated', () => setPacks(getCoursePacks()))
    return () => {
      window.removeEventListener('customer-courses-updated', handler)
      window.removeEventListener('course-packs-updated', () => {})
    }
  }, [refresh])

  const displayCourses =
    filter === 'expiring'
      ? expiringSoon
      : filter === 'active'
        ? courses.filter(c => c.remainingSessions > 0 && !isExpired(c))
        : courses

  const expiredCount = getExpired().length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 期限切れ・期限間近アラート */}
      {(expiringSoon.length > 0 || expiredCount > 0) && (
        <div className="space-y-3">
          {expiredCount > 0 && (
            <Link
              href="#expired"
              className="block bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700">
                  <span className="font-bold">期限切れ：</span>
                  {expiredCount}件のコースが残り回数ありで期限切れです
                </p>
              </div>
            </Link>
          )}
          {expiringSoon.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <span className="font-bold">30日以内に期限：</span>
                  {expiringSoon.length}件
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans">コース（回数券）管理</span>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as 'all' | 'active' | 'expiring')}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:border-rose outline-none"
          >
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="expiring">期限間近</option>
          </select>
        </div>
        <button
          onClick={() => setPurchaseModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          購入登録
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden card-shadow">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-light-lav/50">
                <th className="text-left p-3 text-text-sub font-medium">お客様</th>
                <th className="text-left p-3 text-text-sub font-medium">コース</th>
                <th className="text-left p-3 text-text-sub font-medium">残り</th>
                <th className="text-left p-3 text-text-sub font-medium">期限</th>
                <th className="text-left p-3 text-text-sub font-medium w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {displayCourses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-sub">
                    {filter === 'expiring'
                      ? '30日以内に期限のコースはありません'
                      : 'コースの購入登録がありません'}
                    <br />
                    <span className="text-xs">
                      メニュー設定でコースを登録し、購入登録から顧客に紐づけてください
                    </span>
                  </td>
                </tr>
              ) : (
                displayCourses.map((c) => {
                  const days = daysUntilExpiry(c)
                  const expired = isExpired(c)
                  return (
                    <tr
                      key={c.id}
                      className={`border-t border-gray-100 ${
                        expired ? 'bg-red-50/50' : days <= 14 ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-text-main">{c.customerName}</td>
                      <td className="p-3 text-text-main">{c.courseName}</td>
                      <td className="p-3">
                        <span
                          className={
                            c.remainingSessions <= 0
                              ? 'text-text-sub'
                              : expired
                                ? 'text-red-600 font-semibold'
                                : 'text-text-main'
                          }
                        >
                          {c.remainingSessions} / {c.totalSessions}回
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            expired
                              ? 'text-red-600'
                              : days <= 14
                                ? 'text-amber-600'
                                : 'text-text-sub'
                          }
                        >
                          {c.expiryDate}
                          {!expired && c.remainingSessions > 0 && (
                            <span className="ml-1 text-xs">(残{days}日)</span>
                          )}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.remainingSessions > 0 && !expired && (
                          <button
                            onClick={() => setConsumeModalOpen(c)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded-lg"
                          >
                            <Minus className="w-3 h-3" />
                            1回消化
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
        でコース（回数券）の種類を登録できます
      </p>

      {/* 購入登録モーダル */}
      {purchaseModalOpen && (
        <PurchaseModal
          packs={packs}
          onClose={() => setPurchaseModalOpen(false)}
          onSaved={refresh}
        />
      )}

      {/* 消化確認モーダル */}
      {consumeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-text-main mb-2">1回消化しますか？</h3>
            <p className="text-sm text-text-sub mb-4">
              {consumeModalOpen.customerName} 様の {consumeModalOpen.courseName}
              <br />
              残り {consumeModalOpen.remainingSessions}回 → {consumeModalOpen.remainingSessions - 1}回
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConsumeModalOpen(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  consumeCourse(consumeModalOpen.id)
                  refresh()
                  setConsumeModalOpen(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium"
              >
                消化する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PurchaseModal({
  packs,
  onClose,
  onSaved,
}: {
  packs: CoursePack[]
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'customer' | 'course'>('customer')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedPack, setSelectedPack] = useState<CoursePack | null>(null)
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
    setStep('course')
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
    setStep('course')
  }

  const handlePurchase = () => {
    if (!selectedPack) return
    const cid = selectedCustomer?.id ?? (customerId || `local-${Date.now()}`)
    const cname = selectedCustomer?.name ?? (customerName.trim() || '未登録顧客')
    addCustomerCourse(cid, cname, selectedPack)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-main">
            {step === 'customer' ? '顧客を選択' : 'コースを選択'}
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
              購入者: <span className="font-medium text-text-main">{selectedCustomer?.name ?? customerName}</span>
            </p>
            <button
              onClick={() => setStep('customer')}
              className="text-xs text-rose hover:underline"
            >
              ← 顧客を変更
            </button>
            <div className="space-y-2">
              {packs.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPack(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                    selectedPack?.id === p.id
                      ? 'border-rose bg-rose/5'
                      : 'border-gray-200 hover:border-rose/50'
                  }`}
                >
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">
                    ¥{p.price.toLocaleString()} · {p.totalSessions}回 · 有効{p.expiryMonths}ヶ月
                  </p>
                </button>
              ))}
            </div>
            {packs.length === 0 && (
              <p className="text-sm text-text-sub">
                メニュー設定でコースを登録してください
              </p>
            )}
            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main"
              >
                キャンセル
              </button>
              <button
                onClick={handlePurchase}
                disabled={!selectedPack}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium disabled:opacity-50"
              >
                購入登録
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
