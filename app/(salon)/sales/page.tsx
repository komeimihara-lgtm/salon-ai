'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ShoppingCart, Receipt, Plus, Trash2, Pencil, X,
  ChevronLeft, ChevronRight, Loader2, Tag, AlertCircle, ArrowLeft,
  UserPlus, Search,
} from 'lucide-react'
import { getMenus, getCategories, getTaxSettings, getCampaigns, calcTotalWithTax, calcTaxAmount, isCampaignActive, type MenuItem, type Campaign } from '@/lib/menus'
import { DEMO_SALON_ID } from '@/lib/supabase'
import { getStaffList } from '@/lib/staff-management'
import { fetchTicketPlans, addCustomerTicket, type TicketPlan } from '@/lib/tickets'
import { fetchSubscriptionPlans, addCustomerSubscription, type SubscriptionPlan } from '@/lib/subscriptions'

const PAYMENTS = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'online', label: 'オンライン決済' },
  { value: 'loan', label: 'ローン' },
]

interface Sale {
  id: string
  sale_date: string
  amount: number
  customer_id?: string
  customer_name?: string
  menu?: string
  staff_name?: string
  payment_method: string
  memo?: string
}

type CartItemType = 'menu' | 'ticket' | 'subscription'

interface CartItem {
  type: CartItemType
  menuId: string
  name: string
  price: number
  qty: number
  category: string
  ticketPlan?: TicketPlan
  subPlan?: SubscriptionPlan
  campaign?: Campaign
}

export default function SalesPage() {
  const [tab, setTab] = useState<'register' | 'sales'>('register')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [menus, setMenus] = useState<ReturnType<typeof getMenus>>([])
  const [staffList, setStaffList] = useState<ReturnType<typeof getStaffList>>([])
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [taxSettings, setTaxSettingsState] = useState(getTaxSettings())
  const [campaigns, setCampaignsState] = useState<Campaign[]>([])
  const [dateRange, setDateRange] = useState(() => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  })

  const today = new Date().toISOString().slice(0, 10)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string | null; name: string; visit_count?: number; last_visit_date?: string } | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [saleDate, setSaleDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'amount' | null>(null)
  const [discountValue, setDiscountValue] = useState(0)
  const [showDiscountPanel, setShowDiscountPanel] = useState(false)
  const [showCampaignPanel, setShowCampaignPanel] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{ type: 'card' | 'loan' } | null>(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [ticketPlans, setTicketPlans] = useState<TicketPlan[]>([])
  const [subPlans, setSubPlans] = useState<SubscriptionPlan[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; phone?: string; visit_count?: number; last_visit_date?: string }>>([])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/kpi/sales?start=${dateRange.start}&end=${dateRange.end}`)
      const json = await res.json()
      setSales(json.sales || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [dateRange.start, dateRange.end])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers/list?limit=500&page=1')
      const json = await res.json()
      setCustomers((json.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    } catch (e) { console.error(e) }
  }, [])

  const fetchCustomerSearch = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/customers/list?search=${encodeURIComponent(q)}&limit=50&page=1`)
      const json = await res.json()
      const list = (json.customers || []).map((c: { id: string; name: string; phone?: string; visit_count?: number; last_visit_date?: string }) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        visit_count: c.visit_count ?? 0,
        last_visit_date: c.last_visit_date,
      }))
      setSearchResults(list)
    } catch (e) { console.error(e); setSearchResults([]) }
  }, [])

  useEffect(() => {
    const m = getMenus()
    const c = getCategories()
    const migratedMenus = m.map((menu: MenuItem) => ({
      ...menu,
      category: menu.category || c[0] || 'フェイシャル'
    }))
    setMenus(migratedMenus)
    setCategories(c)
    setSelectedCategory(c[0] ?? '')
    setStaffList(getStaffList())
    setTaxSettingsState(getTaxSettings())
    setCampaignsState(getCampaigns())
    fetchCustomers()
    fetchTicketPlans().then(setTicketPlans).catch(() => [])
    fetchSubscriptionPlans().then(setSubPlans).catch(() => [])
  }, [fetchCustomers])

  useEffect(() => { setLoading(true); fetchSales() }, [fetchSales])

  useEffect(() => {
    if (showCustomerModal) {
      fetchCustomerSearch(customerSearch)
    } else {
      setCustomerSearch('')
      setSearchResults([])
    }
  }, [showCustomerModal, customerSearch, fetchCustomerSearch])

  const activeCampaigns = campaigns.filter(c => isCampaignActive(c))
  const discountCampaigns = activeCampaigns.filter(c => c.campaignType === 'discount')
  const limitedCampaigns = activeCampaigns.filter(c => c.campaignType === 'limited_menu')

  const filteredMenus = selectedCategory ? menus.filter(m => m.category === selectedCategory) : menus
  const filteredTicketPlans = selectedCategory
    ? ticketPlans.filter(p => {
        const cat = (p.category || '').trim()
        return cat === '' || cat === selectedCategory.trim()
      })
    : ticketPlans
  const filteredSubPlans = selectedCategory
    ? subPlans.filter(p => {
        const cat = (p.category || '').trim()
        return cat === '' || cat === selectedCategory.trim()
      })
    : subPlans

  const isUnknownCustomer = selectedCustomer?.id === null || selectedCustomer?.id === ''
  const canAddTicketOrSub = selectedCustomer && !isUnknownCustomer

  const addTicketToCart = (plan: TicketPlan) => {
    if (!selectedCustomer) { setError('先に顧客を選択してください'); return }
    if (isUnknownCustomer) { setError('不明のお客様では回数券は登録できません'); return }
    setError('')
    setCart(prev => {
      const found = prev.find(c => c.type === 'ticket' && c.menuId === plan.id)
      if (found) return prev.map(c => c.type === 'ticket' && c.menuId === plan.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { type: 'ticket' as const, menuId: plan.id, name: plan.name, price: plan.price, qty: 1, category: plan.category || selectedCategory, ticketPlan: plan }]
    })
  }

  const addSubToCart = (plan: SubscriptionPlan) => {
    if (!selectedCustomer) { setError('先に顧客を選択してください'); return }
    if (isUnknownCustomer) { setError('不明のお客様ではサブスクは登録できません'); return }
    setError('')
    setCart(prev => {
      const found = prev.find(c => c.type === 'subscription' && c.menuId === plan.id)
      if (found) return prev.map(c => c.type === 'subscription' && c.menuId === plan.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { type: 'subscription' as const, menuId: plan.id, name: plan.name, price: plan.price, qty: 1, category: plan.category || selectedCategory, subPlan: plan }]
    })
  }

  const addToCart = (menu: { id: string; name: string; price: number; category: string }) => {
    setCart(prev => {
      const found = prev.find(c => c.type === 'menu' && c.menuId === menu.id)
      if (found) return prev.map(c => c.type === 'menu' && c.menuId === menu.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { type: 'menu' as const, menuId: menu.id, name: menu.name, price: menu.price, qty: 1, category: menu.category }]
    })
  }

  const addCampaignLimitedToCart = (camp: Campaign) => {
    if (!camp.menuName || camp.price == null) return
    if ((camp.targetType === 'ticket' || camp.targetType === 'subscription') && !selectedCustomer) {
      setError('先に顧客を選択してください')
      return
    }
    if ((camp.targetType === 'ticket' || camp.targetType === 'subscription') && isUnknownCustomer) {
      setError('不明のお客様では回数券・サブスクは登録できません')
      return
    }
    setError('')
    const key = `campaign-${camp.id}`
    const name = camp.menuName
    const price = camp.price
    const category = 'キャンペーン'
    if (camp.targetType === 'menu') {
      setCart(prev => {
        const found = prev.find(c => c.menuId === key)
        if (found) return prev.map(c => c.menuId === key ? { ...c, qty: c.qty + 1 } : c)
        return [...prev, { type: 'menu' as const, menuId: key, name, price, qty: 1, category, campaign: camp }]
      })
    } else if (camp.targetType === 'ticket') {
      setCart(prev => {
        const found = prev.find(c => c.type === 'ticket' && c.menuId === key)
        if (found) return prev.map(c => c.type === 'ticket' && c.menuId === key ? { ...c, qty: c.qty + 1 } : c)
        const virtualPlan: TicketPlan = {
          id: key,
          name,
          menuName: camp.menuDescription ?? name,
          totalSessions: camp.totalSessions ?? 5,
          price,
          unitPrice: Math.round(price / (camp.totalSessions ?? 5)),
          expiryDays: 180,
          category,
        }
        return [...prev, { type: 'ticket' as const, menuId: key, name, price, qty: 1, category, ticketPlan: virtualPlan, campaign: camp }]
      })
    } else {
      setCart(prev => {
        const found = prev.find(c => c.type === 'subscription' && c.menuId === key)
        if (found) return prev.map(c => c.type === 'subscription' && c.menuId === key ? { ...c, qty: c.qty + 1 } : c)
        const virtualPlan: SubscriptionPlan = {
          id: key,
          name,
          price,
          sessionsPerMonth: camp.sessionsPerMonth ?? 2,
          menuName: camp.menuDescription ?? name,
          billingDay: 1,
          category,
        }
        return [...prev, { type: 'subscription' as const, menuId: key, name, price, qty: 1, category, subPlan: virtualPlan, campaign: camp }]
      })
    }
    setShowCampaignPanel(false)
  }

  const removeFromCart = (menuId: string) => setCart(prev => prev.filter(c => c.menuId !== menuId))
  const updateCartQty = (menuId: string, qty: number) => {
    if (qty < 1) return removeFromCart(menuId)
    setCart(prev => prev.map(c => c.menuId === menuId ? { ...c, qty } : c))
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const discountAmount = discountType === 'percent' ? Math.round(subtotal * discountValue / 100) : discountType === 'amount' ? discountValue : 0
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = calcTaxAmount(discountedSubtotal, taxSettings)
  const total = calcTotalWithTax(discountedSubtotal, taxSettings)

  const handlePaymentSelect = (method: string) => {
    setPaymentMethod(method)
    setPaymentConfirmed(false)
    if (method === 'card' || method === 'online') setConfirmModal({ type: 'card' })
    else if (method === 'loan') setConfirmModal({ type: 'loan' })
  }

  const applyCampaign = (camp: Campaign) => {
    if (camp.campaignType !== 'discount') return
    setDiscountType(camp.discountType ?? 'percent')
    setDiscountValue(camp.discountValue ?? 0)
    setShowCampaignPanel(false)
  }

  const handleRegister = async () => {
    if (cart.length === 0) { setError('メニュー・回数券・サブスクを追加してください'); return }
    if (!selectedCustomer) { setError('顧客を選択してください'); return }
    const hasTicketOrSub = cart.some(c => c.type === 'ticket' || c.type === 'subscription')
    if (hasTicketOrSub && isUnknownCustomer) { setError('不明のお客様では回数券・サブスクの登録はできません。顧客を選択し直してください。'); return }
    if ((paymentMethod === 'card' || paymentMethod === 'online' || paymentMethod === 'loan') && !paymentConfirmed) { setError('決済確認が必要です'); return }
    setSaving(true); setError('')
    try {
      const hasProduct = cart.some(c => c.category === '物販')
      const salesToCreate: Array<Record<string, unknown>> = []
      const discountRatio = subtotal > 0 ? discountedSubtotal / subtotal : 1
      for (const c of cart) {
        const amt = Math.round(c.price * discountRatio)
        const saleBase = {
          salon_id: process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID,
          sale_date: saleDate,
          amount: amt,
          customer_id: isUnknownCustomer ? null : (selectedCustomer?.id || null),
          customer_name: isUnknownCustomer ? '不明' : (selectedCustomer?.name || null),
          menu: c.name,
          staff_name: selectedStaff?.name || null,
          payment_method: paymentMethod,
          sale_type: hasProduct || c.category === '物販' ? 'product' : paymentMethod,
        }
        if (c.type === 'ticket' && c.ticketPlan) {
          const custId = selectedCustomer!.id
          if (!custId) continue
          for (let i = 0; i < c.qty; i++) {
            await addCustomerTicket(custId, selectedCustomer!.name, c.ticketPlan, {
              paymentMethod: paymentMethod as 'cash' | 'card' | 'online' | 'loan',
              campaignId: c.campaign?.id,
            })
            salesToCreate.push({ ...saleBase })
          }
        } else if (c.type === 'subscription' && c.subPlan) {
          const custId = selectedCustomer!.id
          if (!custId) continue
          for (let i = 0; i < c.qty; i++) {
            await addCustomerSubscription(custId, selectedCustomer!.name, c.subPlan, {
              paymentMethod: paymentMethod as 'cash' | 'card' | 'online' | 'loan',
              campaignId: c.campaign?.id,
            })
            salesToCreate.push({ ...saleBase })
          }
        } else {
          for (let i = 0; i < c.qty; i++) salesToCreate.push({ ...saleBase })
        }
      }
      if (salesToCreate.length > 0) {
        const res = await fetch('/api/kpi/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sales: salesToCreate }) })
        if (!res.ok) throw new Error()
      }
      setCart([]); setSelectedCustomer(null); setSelectedStaff(null)
      setDiscountType(null); setDiscountValue(0); setPaymentConfirmed(false)
      fetchSales()
      showToast('売上を登録しました')
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました')
      showToast(e instanceof Error ? e.message : '登録に失敗しました', 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/kpi/sales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleteTarget(null)
      fetchSales()
    } catch { showToast('削除に失敗しました', 'error') }
  }

  const prevMonth = () => {
    const [y, m] = dateRange.start.split('-').map(Number)
    const d = new Date(y, m - 2)
    setDateRange({ start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) })
  }
  const nextMonth = () => {
    const [y, m] = dateRange.start.split('-').map(Number)
    const d = new Date(y, m)
    setDateRange({ start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) })
  }
  const dayTotal = sales.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="h-screen flex flex-col bg-off-white overflow-hidden">
      {/* 上部: 顧客選択バー + タブ */}
      <div className="shrink-0 flex flex-col border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl text-text-sub hover:text-rose hover:bg-light-lav transition-colors shrink-0" title="ダッシュボードへ">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <button
            type="button"
            onClick={() => setShowCustomerModal(true)}
            className={`flex-1 min-w-0 min-h-[80px] flex items-center gap-4 px-5 rounded-2xl transition-all text-left ${
              selectedCustomer
                ? 'bg-rose-100 border-2 border-rose-400'
                : 'bg-rose-50 border-2 border-rose-300 border-dashed hover:bg-rose-100/80'
            }`}
          >
            {selectedCustomer ? (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-rose-700 truncate">{selectedCustomer.name}様</p>
                  <p className="text-sm text-text-sub mt-0.5">
                    {isUnknownCustomer ? '不明のお客様' : (
                      `${selectedCustomer.visit_count ?? 0}回来店 · 最終来店: ${selectedCustomer.last_visit_date ? new Date(selectedCustomer.last_visit_date).toLocaleDateString('ja-JP') : '—'}`
                    )}
                  </p>
                </div>
                <span className="px-4 py-2 rounded-xl bg-rose-200 text-rose-800 font-bold text-sm shrink-0">変更</span>
              </>
            ) : (
              <>
                <UserPlus className="w-14 h-14 text-rose-400 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-rose-700">👤 顧客を選択してください</p>
                  <p className="text-sm text-text-sub mt-0.5">顧客を選択してから施術メニューを選んでください</p>
                </div>
              </>
            )}
          </button>
          <div className="w-32 shrink-0">
            <label className="text-xs text-text-sub block mb-0.5">日付</label>
            <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base" />
          </div>
          <div className="flex gap-2 p-1 bg-light-lav/50 rounded-xl shrink-0">
            <button onClick={() => setTab('register')} className={`px-4 py-2.5 rounded-lg text-base font-bold transition-all ${tab === 'register' ? 'bg-white shadow text-rose' : 'text-text-sub'}`}>
              <ShoppingCart className="w-5 h-5 inline-block mr-1.5 align-middle" />レジ
            </button>
            <button onClick={() => setTab('sales')} className={`px-4 py-2.5 rounded-lg text-base font-bold transition-all ${tab === 'sales' ? 'bg-white shadow text-rose' : 'text-text-sub'}`}>
              <Receipt className="w-5 h-5 inline-block mr-1.5 align-middle" />売上
            </button>
          </div>
        </div>
        {tab === 'register' && (
          <div className="px-4 pb-3">
            <label className="text-xs text-text-sub block mb-2">カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-3 rounded-xl text-lg font-bold transition-all min-h-[48px] ${selectedCategory === cat ? 'bg-gradient-to-r from-rose to-lavender text-white shadow' : 'bg-light-lav text-text-sub hover:text-text-main'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {tab === 'register' ? (
        <div className="flex-1 flex min-h-0">
          {/* 中央メイン 70%: メニュー・回数券・サブスク */}
          <div className="flex-[7] min-w-0 p-4 overflow-y-auto">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {filteredMenus.map(m => (
                <button key={m.id} onClick={() => addToCart(m)}
                  className="min-h-[100px] p-4 rounded-2xl border-2 border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all active:scale-[0.98]">
                  <p className="font-bold text-text-main text-base leading-tight">{m.name}</p>
                  <p className="text-xl font-bold text-rose mt-1">¥{m.price.toLocaleString()}</p>
                  <p className="text-sm text-text-sub mt-0.5">{m.duration}分</p>
                </button>
              ))}
              {selectedCategory === 'キャンペーン' && limitedCampaigns.map(camp => (
                <button key={camp.id} onClick={() => addCampaignLimitedToCart(camp)} disabled={(camp.targetType === 'ticket' || camp.targetType === 'subscription') && !canAddTicketOrSub}
                  className="min-h-[100px] p-4 rounded-2xl border-2 border-amber-200 hover:border-rose hover:bg-rose/5 text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">期間限定</span>
                  <p className="font-bold text-text-main text-base leading-tight mt-1">{camp.menuName ?? camp.name}</p>
                  <p className="text-xl font-bold text-rose mt-1">¥{(camp.price ?? 0).toLocaleString()}</p>
                  <p className="text-sm text-text-sub mt-0.5">
                    {camp.targetType === 'menu' ? `${camp.durationMinutes ?? 0}分` : camp.targetType === 'ticket' ? `回数券 ${camp.totalSessions ?? 0}回` : `サブスク ${camp.sessionsPerMonth ?? 0}回/月`}
                  </p>
                </button>
              ))}
              {filteredTicketPlans.map(p => (
                <button key={p.id} onClick={() => addTicketToCart(p)} disabled={!canAddTicketOrSub}
                  className="min-h-[100px] p-4 rounded-2xl border-2 border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  <p className="font-bold text-text-main text-base leading-tight">{p.name}</p>
                  <p className="text-xl font-bold text-rose mt-1">¥{p.price.toLocaleString()}</p>
                  <p className="text-sm text-text-sub mt-0.5">回数券 {p.totalSessions}回</p>
                </button>
              ))}
              {filteredSubPlans.map(p => (
                <button key={p.id} onClick={() => addSubToCart(p)} disabled={!canAddTicketOrSub}
                  className="min-h-[100px] p-4 rounded-2xl border-2 border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  <p className="font-bold text-text-main text-base leading-tight">{p.name}</p>
                  <p className="text-xl font-bold text-rose mt-1">¥{p.price.toLocaleString()}/月</p>
                  <p className="text-sm text-text-sub mt-0.5">サブスク {p.sessionsPerMonth}回/月</p>
                </button>
              ))}
            </div>
          </div>

          {/* 右パネル 30%: カート */}
          <div className="flex-[3] min-w-[280px] flex flex-col border-l border-gray-200 bg-white overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-text-main">カート</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-base text-text-sub py-8">メニュー・回数券・サブスクを選択</p>
              ) : cart.map(c => {
                const typeLabel = c.type === 'menu' ? '通常' : c.type === 'ticket' ? '回数券' : 'サブスク'
                const lineTotal = c.price * c.qty
                return (
                  <div key={`${c.type}-${c.menuId}`} className="flex items-start gap-3 p-3 bg-light-lav/50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-main text-base">{c.name}</p>
                      <p className="text-sm text-text-sub mt-0.5">
                        <span className="px-2 py-0.5 rounded bg-white/80 text-xs">{typeLabel}</span>
                        <span className="ml-2">¥{lineTotal.toLocaleString()}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateCartQty(c.menuId, c.qty - 1)} className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center text-lg font-bold hover:bg-rose/10">−</button>
                      <span className="w-8 text-center text-base font-bold">{c.qty}</span>
                      <button onClick={() => updateCartQty(c.menuId, c.qty + 1)} className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center text-lg font-bold hover:bg-rose/10">+</button>
                      <button onClick={() => removeFromCart(c.menuId)} className="p-2 text-text-sub hover:text-red-600 rounded-xl" title="削除"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 割引 */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2 mb-2">
                <button onClick={() => { setShowDiscountPanel(!showDiscountPanel); setShowCampaignPanel(false) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold border transition-all ${showDiscountPanel ? 'bg-rose text-white border-rose' : 'border-gray-200 text-text-sub'}`}>
                  <Tag className="w-5 h-5" />割引
                </button>
                <button onClick={() => { setShowCampaignPanel(!showCampaignPanel); setShowDiscountPanel(false) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold border transition-all ${showCampaignPanel ? 'bg-rose text-white border-rose' : 'border-gray-200 text-text-sub'}`}>
                  🎁 キャンペーン
                </button>
              </div>
              {showDiscountPanel && (
                <div className="bg-light-lav/50 rounded-xl p-3 mb-3 space-y-2">
                  <div className="flex gap-2">
                    {[{ value: 'percent', label: '%OFF' }, { value: 'amount', label: '円引き' }].map(opt => (
                      <button key={opt.value} onClick={() => setDiscountType(opt.value as 'percent' | 'amount')}
                        className={`flex-1 py-2 rounded-lg text-base font-bold ${discountType === opt.value ? 'bg-rose text-white' : 'bg-white text-text-sub'}`}>{opt.label}</button>
                    ))}
                    <button onClick={() => { setDiscountType(null); setDiscountValue(0) }} className="px-3 py-2 rounded-lg bg-white text-text-sub text-sm">クリア</button>
                  </div>
                  {discountType && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value === '' ? 0 : Number(e.target.value))} min={0}
                        className="flex-1 px-4 py-2 rounded-lg border text-lg" />
                      <span className="text-text-sub text-lg">{discountType === 'percent' ? '%' : '円'}</span>
                    </div>
                  )}
                </div>
              )}
              {showCampaignPanel && (
                <div className="bg-light-lav/50 rounded-xl p-3 mb-3 space-y-2">
                  {activeCampaigns.length === 0 ? <p className="text-sm text-text-sub">期間中のキャンペーンなし</p> : (
                    <>
                      {discountCampaigns.length > 0 && (
                        <div>
                          <p className="text-xs text-text-sub mb-1">割引キャンペーン</p>
                          {discountCampaigns.map(camp => (
                            <button key={camp.id} onClick={() => applyCampaign(camp)}
                              className="w-full text-left px-4 py-3 rounded-xl hover:bg-white text-base font-medium mb-1">
                              {camp.name} <span className="text-rose">{camp.discountType === 'percent' ? `${camp.discountValue ?? 0}%OFF` : `¥${(camp.discountValue ?? 0).toLocaleString()}引き`}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {limitedCampaigns.length > 0 && (
                        <div>
                          <p className="text-xs text-text-sub mb-1">期間限定メニュー</p>
                          {limitedCampaigns.map(camp => (
                            <button key={camp.id} onClick={() => addCampaignLimitedToCart(camp)}
                              className="w-full text-left px-4 py-3 rounded-xl hover:bg-white text-base font-medium mb-1">
                              {camp.menuName ?? camp.name} <span className="text-rose">¥{(camp.price ?? 0).toLocaleString()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 担当スタッフ */}
              <div className="mb-3">
                <label className="text-xs text-text-sub block mb-1">担当スタッフ</label>
                <select value={selectedStaff?.id ?? ''} onChange={e => { const s = staffList.find(x => x.id === e.target.value); setSelectedStaff(s || null) }}
                  className="w-full px-4 py-2.5 rounded-xl border text-base">
                  <option value="">選択なし</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* 支払方法 */}
              <div className="mb-3">
                <label className="text-xs text-text-sub block mb-2">支払方法</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENTS.map(p => (
                    <button key={p.value} onClick={() => handlePaymentSelect(p.value)}
                      className={`px-4 py-2.5 rounded-xl text-base font-bold transition-all ${paymentMethod === p.value ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}>
                      {p.label}{(p.value === 'card' || p.value === 'online' || p.value === 'loan') && paymentMethod === p.value && paymentConfirmed && ' ✓'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 合計 */}
              <div className="bg-light-lav/30 rounded-2xl p-4 mb-3 border-2 border-rose/20">
                <div className="flex justify-between text-base text-text-sub mb-1"><span>小計</span><span>¥{subtotal.toLocaleString()}</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-base text-rose mb-1"><span>割引</span><span>-¥{discountAmount.toLocaleString()}</span></div>}
                {taxSettings.taxType === 'excluded' && <div className="flex justify-between text-base text-text-sub mb-1"><span>消費税（外税）</span><span>¥{taxAmount.toLocaleString()}</span></div>}
                {taxSettings.taxType === 'included' && <div className="flex justify-between text-sm text-text-sub mb-1"><span>消費税（内税）</span><span>¥{taxAmount.toLocaleString()}</span></div>}
                <div className="flex justify-between items-baseline pt-3 mt-2 border-t-2 border-rose/20">
                  <span className="text-lg font-bold text-text-main">合計</span>
                  <span className="text-3xl font-bold text-rose">¥{total.toLocaleString()}</span>
                </div>
              </div>

              {error && <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-base font-medium text-red-600">{error}</p></div>}

              <button onClick={handleRegister} disabled={saving || cart.length === 0}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose to-lavender text-white text-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                {saving ? '登録中...' : '売上を登録'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-3 rounded-xl hover:bg-light-lav"><ChevronLeft className="w-6 h-6" /></button>
                <span className="text-xl font-bold text-text-main">{dateRange.start.slice(0, 7).replace('-', '年')}月</span>
                <button onClick={nextMonth} className="p-3 rounded-xl hover:bg-light-lav"><ChevronRight className="w-6 h-6" /></button>
              </div>
              <p className="text-xl font-bold text-rose">合計: ¥{dayTotal.toLocaleString()}</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-12 h-12 text-rose animate-spin" /></div>
            ) : sales.length === 0 ? (
              <div className="text-center py-16 text-text-sub">
                <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">この期間の売上はありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sales.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div>
                      <span className="text-2xl font-bold text-text-main">¥{s.amount.toLocaleString()}</span>
                      {s.menu && <span className="ml-3 text-base text-text-sub">{s.menu}</span>}
                      <div className="flex gap-3 mt-1 text-sm text-text-sub">
                        <span>{s.sale_date}</span>
                        {s.customer_name && <span>{s.customer_name}様</span>}
                        {s.staff_name && <span>/ {s.staff_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-light-lav text-sm font-medium">{PAYMENTS.find(p => p.value === s.payment_method)?.label ?? s.payment_method}</span>
                      <button onClick={() => setEditSale(s)} className="p-2 text-text-sub hover:text-rose rounded-xl"><Pencil className="w-5 h-5" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-2 text-text-sub hover:text-red-600 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 顧客選択モーダル */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col card-shadow overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-main">顧客を選択</h3>
              <button onClick={() => setShowCustomerModal(false)} className="p-2 text-text-sub hover:text-rose rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <button
                onClick={() => {
                  setSelectedCustomer({ id: null, name: '不明のお客様' })
                  setShowCustomerModal(false)
                }}
                className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-800 font-bold text-lg hover:bg-amber-100 transition-colors"
              >
                <UserPlus className="w-6 h-6" />
                👤 不明のお客様として登録
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-sub" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="名前・電話番号で検索"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 text-lg focus:border-rose outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-center text-text-sub py-8">検索結果がありません</p>
              ) : (
                searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer({
                        id: c.id,
                        name: c.name,
                        visit_count: c.visit_count,
                        last_visit_date: c.last_visit_date,
                      })
                      setShowCustomerModal(false)
                    }}
                    className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all active:scale-[0.99]"
                  >
                    <p className="font-bold text-lg text-text-main">{c.name}様</p>
                    <p className="text-sm text-text-sub mt-1">
                      {c.phone && <span className="mr-3">{c.phone}</span>}
                      <span>{c.visit_count ?? 0}回来店</span>
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 支払確認モーダル */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-rose" />
              <h3 className="font-bold text-text-main">{confirmModal.type === 'card' ? '決済確認' : 'ローン承認確認'}</h3>
            </div>
            <p className="text-base text-text-main mb-6">{confirmModal.type === 'card' ? '決済は完了しましたか？' : 'ローン会社の承認はOKですか？'}</p>
            <div className="flex gap-3">
              <button onClick={() => { setConfirmModal(null); setPaymentMethod('cash') }} className="flex-1 py-3 rounded-xl border border-gray-200 text-text-main font-bold">いいえ</button>
              <button onClick={() => { setPaymentConfirmed(true); setConfirmModal(null) }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold">はい</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main text-lg mb-2">売上を削除</h3>
            <p className="text-base text-text-main mb-6">この売上を削除しますか？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-text-main font-bold">キャンセル</button>
              <button onClick={() => handleDelete(deleteTarget.id)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">削除</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg text-lg font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
