'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Receipt, Plus, Trash2, Pencil, X,
  ChevronLeft, ChevronRight, Loader2, Tag, AlertCircle,
} from 'lucide-react'
import { getMenus, getCategories, getTaxSettings, getCampaigns, calcTotalWithTax, calcTaxAmount, type MenuItem, type Campaign } from '@/lib/menus'
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
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
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

  useEffect(() => {
    const m = getMenus()
    const c = getCategories()
    // メニューにcategoryがない古いデータに対応
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

  const filteredMenus = selectedCategory ? menus.filter(m => m.category === selectedCategory) : menus
  // categoryが空('')の回数券は全カテゴリに表示、一致するカテゴリも表示
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

  const addTicketToCart = (plan: TicketPlan) => {
    if (!selectedCustomer) {
      setError('先に顧客を選択してください')
      return
    }
    setError('')
    setCart(prev => {
      const found = prev.find(c => c.type === 'ticket' && c.menuId === plan.id)
      if (found) return prev.map(c => c.type === 'ticket' && c.menuId === plan.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { type: 'ticket' as const, menuId: plan.id, name: plan.name, price: plan.price, qty: 1, category: plan.category || selectedCategory, ticketPlan: plan }]
    })
  }

  const addSubToCart = (plan: SubscriptionPlan) => {
    if (!selectedCustomer) {
      setError('先に顧客を選択してください')
      return
    }
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

  const removeFromCart = (menuId: string) => {
    setCart(prev => prev.filter(c => c.menuId !== menuId))
  }
  const updateCartQty = (menuId: string, qty: number) => {
    if (qty < 1) return removeFromCart(menuId)
    setCart(prev => prev.map(c => c.menuId === menuId ? { ...c, qty } : c))
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const discountAmount = discountType === 'percent'
    ? Math.round(subtotal * discountValue / 100)
    : discountType === 'amount' ? discountValue : 0
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = calcTaxAmount(discountedSubtotal, taxSettings)
  const total = calcTotalWithTax(discountedSubtotal, taxSettings)

  const handlePaymentSelect = (method: string) => {
    setPaymentMethod(method)
    setPaymentConfirmed(false)
    if (method === 'card' || method === 'online') {
      setConfirmModal({ type: 'card' })
    } else if (method === 'loan') {
      setConfirmModal({ type: 'loan' })
    }
  }

  const applyCampaign = (camp: Campaign) => {
    setDiscountType(camp.discountType)
    setDiscountValue(camp.discountValue)
    setShowCampaignPanel(false)
  }

  const handleRegister = async () => {
    if (cart.length === 0) { setError('メニュー・回数券・サブスクを追加してください'); return }
    if (!selectedCustomer) {
      setError('顧客を選択してください')
      return
    }
    if ((paymentMethod === 'card' || paymentMethod === 'online' || paymentMethod === 'loan') && !paymentConfirmed) {
      setError('決済確認が必要です'); return
    }
    setSaving(true); setError('')
    try {
      const hasProduct = cart.some(c => c.category === '物販')
      const salesToCreate: Array<Record<string, unknown>> = []

      for (const c of cart) {
        const amt = Math.round(c.price * (1 - (discountType === 'percent' ? discountValue / 100 : 0)))
        const saleBase = {
          salon_id: process.env.NEXT_PUBLIC_SALON_ID || DEMO_SALON_ID,
          sale_date: saleDate,
          amount: amt,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          menu: c.name,
          staff_name: selectedStaff?.name || null,
          payment_method: paymentMethod,
          sale_type: hasProduct || c.category === '物販' ? 'product' : paymentMethod,
        }
        if (c.type === 'ticket' && c.ticketPlan) {
          for (let i = 0; i < c.qty; i++) {
            await addCustomerTicket(selectedCustomer!.id, selectedCustomer!.name, c.ticketPlan)
            salesToCreate.push({ ...saleBase })
          }
        } else if (c.type === 'subscription' && c.subPlan) {
          for (let i = 0; i < c.qty; i++) {
            await addCustomerSubscription(selectedCustomer!.id, selectedCustomer!.name, c.subPlan)
            salesToCreate.push({ ...saleBase })
          }
        } else {
          for (let i = 0; i < c.qty; i++) {
            salesToCreate.push({ ...saleBase })
          }
        }
      }

      if (salesToCreate.length > 0) {
        const res = await fetch('/api/kpi/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sales: salesToCreate }),
        })
        if (!res.ok) throw new Error()
      }
      setCart([]); setSelectedCustomer(null); setSelectedStaff(null)
      setDiscountType(null); setDiscountValue(0); setPaymentConfirmed(false)
      fetchSales()
      showToast('売上を登録しました')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登録に失敗しました'
      setError(msg)
      showToast(msg, 'error')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/kpi/sales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleteTarget(null)
      fetchSales()
    } catch {
      showToast('削除に失敗しました', 'error')
    }
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans text-base font-bold text-text-main">売上管理・レジ</span>
      </div>

      <div className="flex gap-2 p-1 bg-light-lav/50 rounded-xl">
        {[{ id: 'register', label: 'レジ', icon: <ShoppingCart className="w-4 h-4" /> }, { id: 'sales', label: '売上管理', icon: <Receipt className="w-4 h-4" /> }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'register' | 'sales')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${tab === t.id ? 'bg-white shadow text-rose' : 'text-text-sub hover:text-text-main'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'register' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左: メニュー選択 */}
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl text-base font-bold transition-all ${selectedCategory === cat ? 'bg-gradient-to-r from-rose to-lavender text-white shadow' : 'bg-light-lav text-text-sub hover:text-text-main'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <h3 className="text-sm font-bold text-text-main mb-3">メニュー</h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {filteredMenus.map(m => (
                  <button key={m.id} onClick={() => addToCart(m)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all">
                    <p className="font-medium text-text-main text-sm">{m.name}</p>
                    <p className="text-sm text-rose font-bold">¥{m.price.toLocaleString()}</p>
                    <p className="text-xs text-text-sub">{m.duration}分</p>
                  </button>
                ))}
              </div>
              <h3 className="text-sm font-bold text-text-main mb-2 mt-4">回数券</h3>
              <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto">
                {filteredTicketPlans.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addTicketToCart(p)}
                    disabled={!selectedCustomer}
                    className="p-3 rounded-xl border border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="font-medium text-text-main text-sm">{p.name}</p>
                    <p className="text-sm text-rose font-bold">¥{p.price.toLocaleString()}</p>
                    <p className="text-xs text-text-sub">{p.totalSessions}回</p>
                  </button>
                ))}
                {filteredTicketPlans.length === 0 && (
                  <p className="col-span-2 text-xs text-text-sub py-2">このカテゴリの回数券はありません（顧客選択後にカートへ追加可能）</p>
                )}
              </div>
              <h3 className="text-sm font-bold text-text-main mb-2 mt-4">サブスク</h3>
              <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto">
                {filteredSubPlans.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addSubToCart(p)}
                    disabled={!selectedCustomer}
                    className="p-3 rounded-xl border border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="font-medium text-text-main text-sm">{p.name}</p>
                    <p className="text-sm text-rose font-bold">¥{p.price.toLocaleString()}/月</p>
                    <p className="text-xs text-text-sub">{p.sessionsPerMonth}回/月</p>
                  </button>
                ))}
                {filteredSubPlans.length === 0 && (
                  <p className="col-span-2 text-xs text-text-sub py-2">このカテゴリのサブスクはありません（顧客選択後にカートへ追加可能）</p>
                )}
              </div>
            </div>

            {/* 右: カート・決済 */}
            <div>
              <h3 className="text-sm font-bold text-text-main mb-3">カート</h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-text-sub py-4">メニュー・回数券・サブスクを選択してください</p>
                ) : cart.map(c => {
                  const typeLabel = c.type === 'menu' ? '通常メニュー' : c.type === 'ticket' ? '回数券' : 'サブスク'
                  const lineTotal = c.price * c.qty
                  return (
                    <div key={`${c.type}-${c.menuId}`} className="flex items-start gap-3 p-3 bg-light-lav/50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-main text-sm">{c.name}</p>
                        <p className="text-xs text-text-sub mt-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-white/80 text-text-sub mr-1.5">{typeLabel}</span>
                          ¥{c.price.toLocaleString()} × {c.qty} = ¥{lineTotal.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateCartQty(c.menuId, c.qty - 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-text-sub hover:text-rose text-sm">−</button>
                        <span className="w-6 text-center text-sm font-medium">{c.qty}</span>
                        <button onClick={() => updateCartQty(c.menuId, c.qty + 1)} className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-text-sub hover:text-rose text-sm">+</button>
                        <button onClick={() => removeFromCart(c.menuId)} className="p-1.5 text-text-sub hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 割引・キャンペーン */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setShowDiscountPanel(!showDiscountPanel); setShowCampaignPanel(false) }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${showDiscountPanel ? 'bg-rose text-white border-rose' : 'border-gray-200 text-text-sub hover:border-rose hover:text-rose'}`}>
                  <Tag className="w-4 h-4" />割引
                </button>
                <button onClick={() => { setShowCampaignPanel(!showCampaignPanel); setShowDiscountPanel(false) }}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium border transition-all ${showCampaignPanel ? 'bg-rose text-white border-rose' : 'border-gray-200 text-text-sub hover:border-rose hover:text-rose'}`}>
                  🎁 キャンペーン
                </button>
              </div>

              {showDiscountPanel && (
                <div className="bg-light-lav/50 rounded-xl p-3 mb-3 space-y-2">
                  <div className="flex gap-2">
                    {[{ value: 'percent', label: '%OFF' }, { value: 'amount', label: '円引き' }].map(opt => (
                      <button key={opt.value} onClick={() => setDiscountType(opt.value as 'percent' | 'amount')}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${discountType === opt.value ? 'bg-rose text-white' : 'bg-white text-text-sub'}`}>
                        {opt.label}
                      </button>
                    ))}
                    <button onClick={() => { setDiscountType(null); setDiscountValue(0) }} className="px-2 py-1.5 rounded-lg bg-white text-text-sub text-sm">クリア</button>
                  </div>
                  {discountType && (
                    <div className="flex items-center gap-2">
                      <input type="number" value={discountValue} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setDiscountValue(val === '' ? 0 : Number(val)) }} onFocus={e => e.target.select()} min={0}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none" />
                      <span className="text-text-sub text-sm">{discountType === 'percent' ? '%' : '円'}</span>
                    </div>
                  )}
                </div>
              )}

              {showCampaignPanel && (
                <div className="bg-light-lav/50 rounded-xl p-3 mb-3 space-y-1">
                  {campaigns.length === 0 ? <p className="text-xs text-text-sub">キャンペーンがありません</p> :
                    campaigns.map(c => (
                      <button key={c.id} onClick={() => applyCampaign(c)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white transition-all text-sm">
                        <span className="font-medium text-text-main">{c.name}</span>
                        <span className="ml-2 text-rose text-xs">{c.discountType === 'percent' ? `${c.discountValue}%OFF` : `¥${c.discountValue}引き`}</span>
                      </button>
                    ))
                  }
                </div>
              )}

              {/* 顧客・スタッフ */}
              <div className="space-y-2 mb-3">
                <div>
                  <label className="text-xs text-text-sub block mb-1">日付</label>
                  <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">顧客</label>
                  <select value={selectedCustomer?.id ?? ''} onChange={e => { const c = customers.find(x => x.id === e.target.value); setSelectedCustomer(c || null) }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="">選択なし</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}様</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">担当スタッフ</label>
                  <select value={selectedStaff?.id ?? ''} onChange={e => { const s = staffList.find(x => x.id === e.target.value); setSelectedStaff(s || null) }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="">選択なし</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">支払方法</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENTS.map(p => (
                      <button key={p.value} onClick={() => handlePaymentSelect(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${paymentMethod === p.value ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub hover:bg-gray-200'}`}>
                        {p.label}
                        {(p.value === 'card' || p.value === 'online' || p.value === 'loan') && paymentMethod === p.value && paymentConfirmed && <span className="ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 合計 */}
              <div className="bg-light-lav/30 rounded-xl p-4 mb-3 space-y-2 border border-gray-100">
                <div className="flex justify-between text-sm text-text-sub">
                  <span>小計</span><span>¥{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-rose">
                    <span>割引</span><span>-¥{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {taxSettings.taxType === 'excluded' ? (
                  <div className="flex justify-between text-sm text-text-sub">
                    <span>消費税（外税 {taxSettings.taxRate}%）</span><span>¥{taxAmount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs text-text-sub">
                    <span>消費税（内税 {taxSettings.taxRate}%）</span><span>¥{taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline border-t-2 border-rose/20 pt-3 mt-2">
                  <span className="font-bold text-text-main">合計金額</span>
                  <span className="text-2xl font-bold text-rose">¥{total.toLocaleString()}</span>
                </div>
                {taxSettings.taxType === 'included' && (
                  <p className="text-xs text-text-sub text-right">税込 ¥{total.toLocaleString()}（うち消費税 ¥{taxAmount.toLocaleString()}）</p>
                )}
              </div>

              {error && (
                <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              )}
              <button onClick={handleRegister} disabled={saving || cart.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {saving ? '登録中...' : '売上を登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-light-lav"><ChevronLeft className="w-5 h-5" /></button>
              <span className="font-semibold text-text-main">{dateRange.start.slice(0, 7).replace('-', '年')}月</span>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-light-lav"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <p className="text-sm font-bold text-rose">合計: ¥{dayTotal.toLocaleString()}</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-text-sub">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>この期間の売上はありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-light-lav/50 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-main">¥{s.amount.toLocaleString()}</span>
                      {s.menu && <span className="text-sm text-text-sub">{s.menu}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-sub">
                      <span>{s.sale_date}</span>
                      {s.customer_name && <span>{s.customer_name}様</span>}
                      {s.staff_name && <span>/ {s.staff_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white rounded-full px-2 py-0.5">{PAYMENTS.find(p => p.value === s.payment_method)?.label ?? s.payment_method}</span>
                    <button onClick={() => setEditSale(s)} className="p-2 text-text-sub hover:text-rose rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteTarget(s)} className="p-2 text-text-sub hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 支払確認モーダル */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-rose" />
              <h3 className="font-bold text-text-main">
                {confirmModal.type === 'card' ? '決済確認' : 'ローン承認確認'}
              </h3>
            </div>
            <p className="text-sm text-text-main mb-6">
              {confirmModal.type === 'card'
                ? '決済は完了しましたか？'
                : 'ローン会社の承認はOKですか？'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setPaymentMethod('cash') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main">
                いいえ
              </button>
              <button onClick={() => { setPaymentConfirmed(true); setConfirmModal(null) }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium">
                はい、確認しました
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main mb-2">売上を削除</h3>
            <p className="text-sm text-text-main mb-6">この売上を削除しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main">
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteTarget.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600">
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  )
}
