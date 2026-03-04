'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  Receipt,
  Plus,
  Trash2,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { getMenus } from '@/lib/menus'
import { getStaffList } from '@/lib/staff-management'

const PAYMENTS = [
  { value: 'cash', label: '現金' },
  { value: 'card', label: 'カード' },
  { value: 'paypay', label: 'PayPay' },
  { value: 'line_pay', label: 'LINE Pay' },
  { value: 'other', label: 'その他' },
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

interface CartItem {
  menuId: string
  name: string
  price: number
  qty: number
}

export default function SalesPage() {
  const [tab, setTab] = useState<'register' | 'sales'>('register')
  const [menus, setMenus] = useState<ReturnType<typeof getMenus>>([])
  const [staffList, setStaffList] = useState<ReturnType<typeof getStaffList>>([])
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState(() => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  })

  // レジ
  const today = new Date().toISOString().slice(0, 10)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [saleDate, setSaleDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 編集モーダル
  const [editSale, setEditSale] = useState<Sale | null>(null)

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/kpi/sales?start=${dateRange.start}&end=${dateRange.end}`)
      const json = await res.json()
      setSales(json.sales || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [dateRange.start, dateRange.end])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers/list?limit=500&page=1')
      const json = await res.json()
      setCustomers((json.customers || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    setMenus(getMenus())
    setStaffList(getStaffList())
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setLoading(true)
    fetchSales()
  }, [fetchSales])

  const addToCart = (menu: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const found = prev.find((c) => c.menuId === menu.id)
      if (found) {
        return prev.map((c) => (c.menuId === menu.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { menuId: menu.id, name: menu.name, price: menu.price, qty: 1 }]
    })
  }

  const removeFromCart = (menuId: string) => {
    setCart((prev) => prev.filter((c) => c.menuId !== menuId))
  }

  const updateCartQty = (menuId: string, qty: number) => {
    if (qty < 1) return removeFromCart(menuId)
    setCart((prev) =>
      prev.map((c) => (c.menuId === menuId ? { ...c, qty } : c))
    )
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0)

  const handleRegister = async () => {
    if (cart.length === 0) {
      setError('メニューを追加してください')
      return
    }
    setSaving(true)
    setError('')
    try {
      const salesToCreate = cart.flatMap((c) =>
        Array.from({ length: c.qty }, () => ({
          sale_date: saleDate,
          amount: c.price,
          customer_id: selectedCustomer?.id || null,
          customer_name: selectedCustomer?.name || null,
          menu: c.name,
          staff_name: selectedStaff?.name || null,
          payment_method: paymentMethod,
        }))
      )
      const res = await fetch('/api/kpi/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: salesToCreate }),
      })
      if (!res.ok) throw new Error()
      setCart([])
      setSelectedCustomer(null)
      setSelectedStaff(null)
      fetchSales()
    } catch {
      setError('登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この売上を削除しますか？')) return
    try {
      const res = await fetch(`/api/kpi/sales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      fetchSales()
    } catch {
      alert('削除に失敗しました')
    }
  }

  const prevMonth = () => {
    const [y, m] = dateRange.start.split('-').map(Number)
    const d = new Date(y, m - 2)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) })
  }

  const nextMonth = () => {
    const [y, m] = dateRange.start.split('-').map(Number)
    const d = new Date(y, m)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) })
  }

  const dayTotal = sales.reduce((sum, s) => sum + s.amount, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans">売上管理・レジ</span>
      </div>

      {/* タブ */}
      <div className="flex gap-2 p-1 bg-light-lav/50 rounded-xl">
        <button
          onClick={() => setTab('register')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
            tab === 'register' ? 'bg-white shadow text-rose' : 'text-text-sub hover:text-text-main'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          レジ
        </button>
        <button
          onClick={() => setTab('sales')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
            tab === 'sales' ? 'bg-white shadow text-rose' : 'text-text-sub hover:text-text-main'
          }`}
        >
          <Receipt className="w-4 h-4" />
          売上管理
        </button>
      </div>

      {tab === 'register' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="grid md:grid-cols-2 gap-6">
            {/* 左: メニュー選択 */}
            <div>
              <h3 className="text-sm font-semibold text-text-main mb-3">メニュー</h3>
              <div className="grid grid-cols-2 gap-2">
                {menus.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addToCart(m)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-rose hover:bg-rose/5 text-left transition-all"
                  >
                    <p className="font-medium text-text-main">{m.name}</p>
                    <p className="text-sm text-rose font-bold">¥{m.price.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 右: カート・決済 */}
            <div>
              <h3 className="text-sm font-semibold text-text-main mb-3">カート</h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {cart.length === 0 ? (
                  <p className="text-sm text-text-sub py-4">メニューを選択してください</p>
                ) : (
                  cart.map((c) => (
                    <div
                      key={c.menuId}
                      className="flex items-center gap-3 p-3 bg-light-lav/50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-main truncate">{c.name}</p>
                        <p className="text-sm text-text-sub">¥{c.price.toLocaleString()} × {c.qty}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQty(c.menuId, c.qty - 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-text-sub hover:text-rose"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{c.qty}</span>
                        <button
                          onClick={() => updateCartQty(c.menuId, c.qty + 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-text-sub hover:text-rose"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(c.menuId)}
                          className="p-1.5 text-text-sub hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-text-sub block mb-1">日付</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">顧客</label>
                  <select
                    value={selectedCustomer?.id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value
                      const c = customers.find((x) => x.id === id)
                      setSelectedCustomer(c || null)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <option value="">選択なし</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">担当スタッフ</label>
                  <select
                    value={selectedStaff?.id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value
                      const s = staffList.find((x) => x.id === id)
                      setSelectedStaff(s || null)
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <option value="">選択なし</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-sub block mb-1">支払方法</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENTS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPaymentMethod(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          paymentMethod === p.value
                            ? 'bg-rose text-white'
                            : 'bg-gray-100 text-text-sub hover:bg-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-text-main">合計</span>
                <span className="text-2xl font-black text-rose">¥{total.toLocaleString()}</span>
              </div>
              <button
                onClick={handleRegister}
                disabled={saving || cart.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
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
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-light-lav">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold text-text-main">
                {dateRange.start.slice(0, 7).replace('-', '年')}月
              </span>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-light-lav">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm font-bold text-rose">合計: ¥{dayTotal.toLocaleString()}</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-text-sub">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>この期間の売上はありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-light-lav/50 rounded-xl"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text-main">¥{s.amount.toLocaleString()}</span>
                      {s.menu && <span className="text-sm text-text-sub">{s.menu}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-sub">
                      <span>{s.sale_date}</span>
                      {s.customer_name && <span>{s.customer_name}</span>}
                      {s.staff_name && <span>/ {s.staff_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white rounded-full px-2 py-0.5">
                      {PAYMENTS.find((p) => p.value === s.payment_method)?.label ?? s.payment_method}
                    </span>
                    <button
                      onClick={() => setEditSale(s)}
                      className="p-2 text-text-sub hover:text-rose rounded-lg"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-2 text-text-sub hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editSale && (
        <EditSaleModal
          sale={editSale}
          customers={customers}
          staffList={staffList}
          onClose={() => setEditSale(null)}
          onSaved={() => {
            fetchSales()
            setEditSale(null)
          }}
        />
      )}
    </div>
  )
}

function EditSaleModal({
  sale,
  customers,
  staffList,
  onClose,
  onSaved,
}: {
  sale: Sale
  customers: { id: string; name: string }[]
  staffList: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    sale_date: sale.sale_date,
    amount: String(sale.amount),
    customer_id: sale.customer_id ?? '',
    customer_name: sale.customer_name ?? '',
    staff_name: sale.staff_name ?? '',
    payment_method: sale.payment_method,
  })
  const [saving, setSaving] = useState(false)
  const staffNames = staffList.map((s) => s.name)

  const handleSubmit = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      const res = await fetch(`/api/kpi/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_date: form.sale_date,
          amount: parseInt(form.amount),
          customer_id: form.customer_id || null,
          customer_name: form.customer_name || null,
          staff_name: form.staff_name || null,
          payment_method: form.payment_method,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved()
    } catch {
      alert('更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-main">売上を編集</h3>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-text-main">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-sub block mb-1">日付</label>
            <input
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm((p) => ({ ...p, sale_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">金額（円）</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">顧客</label>
            <select
              value={form.customer_id}
              onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value)
                setForm((p) => ({ ...p, customer_id: e.target.value, customer_name: c?.name ?? '' }))
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            >
              <option value="">選択なし</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">担当スタッフ</label>
            <select
              value={form.staff_name}
              onChange={(e) => setForm((p) => ({ ...p, staff_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            >
              <option value="">選択なし</option>
              {staffNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">支払方法</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            >
              {PAYMENTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.amount}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
