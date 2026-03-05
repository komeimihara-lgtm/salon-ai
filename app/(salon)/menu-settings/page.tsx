'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Ticket, Repeat } from 'lucide-react'
import { fetchTicketPlans, createTicketPlan, deleteTicketPlan, type TicketPlan } from '@/lib/tickets'
import { getSubscriptionPlans, setSubscriptionPlans, type SubscriptionPlan } from '@/lib/subscriptions'

const STORAGE_KEY = 'sola_menus'

interface MenuItem {
  id: string
  name: string
  duration: number
  price: number
}

const DEFAULT_MENUS: MenuItem[] = [
  { id: '1', name: 'フェイシャル', duration: 60, price: 8000 },
  { id: '2', name: 'ボディケア', duration: 90, price: 12000 },
  { id: '3', name: 'フルコース', duration: 120, price: 20000 },
]

function loadMenus(): MenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_MENUS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MENUS
    }
  } catch (_) {}
  return DEFAULT_MENUS
}

function saveMenus(menus: MenuItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus))
}

export default function MenuSettingsPage() {
  const [menus, setMenus] = useState<MenuItem[]>(loadMenus())
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [newPrice, setNewPrice] = useState(5000)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDuration, setEditDuration] = useState(60)
  const [editPrice, setEditPrice] = useState(0)

  const [ticketPlans, setTicketPlansState] = useState<TicketPlan[]>([])
  const [ticketPlansLoading, setTicketPlansLoading] = useState(true)
  const [courseName, setCourseName] = useState('')
  const [courseMenuName, setCourseMenuName] = useState(() => {
    if (typeof window === 'undefined') return ''
    const m = loadMenus()
    return m[0]?.name ?? ''
  })
  const [courseSessions, setCourseSessions] = useState(5)
  const [coursePrice, setCoursePrice] = useState(40000)
  const [courseExpiryDays, setCourseExpiryDays] = useState(180)

  const [subPlans, setSubPlansState] = useState<SubscriptionPlan[]>([])
  const [subName, setSubName] = useState('')
  const [subMenuName, setSubMenuName] = useState(() => {
    if (typeof window === 'undefined') return ''
    const m = loadMenus()
    return m[0]?.name ?? ''
  })
  const [subPrice, setSubPrice] = useState(8000)
  const [subSessions, setSubSessions] = useState(2)
  const [subBillingDay, setSubBillingDay] = useState(1)

  useEffect(() => {
    setSubPlansState(getSubscriptionPlans())
    if (!subMenuName && menus.length > 0) setSubMenuName(menus[0].name)
    setTicketPlansLoading(true)
    fetchTicketPlans().then(p => { setTicketPlansState(p) }).catch(() => {}).finally(() => setTicketPlansLoading(false))
  }, [])

  const addMenu = () => {
    if (!newName.trim()) return
    const item: MenuItem = {
      id: Date.now().toString(),
      name: newName.trim(),
      duration: newDuration,
      price: newPrice,
    }
    const next = [...menus, item]
    setMenus(next)
    saveMenus(next)
    setNewName('')
    setNewDuration(60)
    setNewPrice(5000)
  }

  const removeMenu = (id: string) => {
    const next = menus.filter(m => m.id !== id)
    setMenus(next)
    saveMenus(next)
    if (editingId === id) setEditingId(null)
  }

  const startEdit = (m: MenuItem) => {
    setEditingId(m.id)
    setEditName(m.name)
    setEditDuration(m.duration)
    setEditPrice(m.price)
  }

  const saveEdit = () => {
    if (!editingId) return
    const next = menus.map(m =>
      m.id === editingId
        ? { ...m, name: editName.trim(), duration: editDuration, price: editPrice }
        : m
    )
    setMenus(next)
    saveMenus(next)
    setEditingId(null)
  }

  const addTicketPlan = async () => {
    if (!courseName.trim() || !courseMenuName.trim()) return
    try {
      const plan = await createTicketPlan({
        name: courseName.trim(),
        menuName: courseMenuName.trim(),
        totalSessions: courseSessions,
        price: coursePrice,
        expiryDays: courseExpiryDays,
      })
      setTicketPlansState(prev => [...prev, plan])
      setCourseName('')
      setCourseMenuName(menus[0]?.name ?? '')
      setCourseSessions(5)
      setCoursePrice(40000)
      setCourseExpiryDays(180)
    } catch {
      alert('登録に失敗しました')
    }
  }

  const removeTicketPlan = async (id: string) => {
    try {
      await deleteTicketPlan(id)
      setTicketPlansState(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('削除に失敗しました')
    }
  }

  const addSubPlan = () => {
    if (!subName.trim() || !subMenuName.trim()) return
    const plan: SubscriptionPlan = {
      id: Date.now().toString(),
      name: subName.trim(),
      price: subPrice,
      sessionsPerMonth: subSessions,
      menuName: subMenuName.trim(),
      billingDay: Math.min(28, Math.max(1, subBillingDay)),
    }
    const next = [...subPlans, plan]
    setSubPlansState(next)
    setSubscriptionPlans(next)
    setSubName('')
    setSubMenuName(menus[0]?.name ?? '')
    setSubPrice(8000)
    setSubSessions(2)
    setSubBillingDay(1)
  }

  const removeSubPlan = (id: string) => {
    const next = subPlans.filter(p => p.id !== id)
    setSubPlansState(next)
    setSubscriptionPlans(next)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">施術メニュー</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3">
            {menus.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                {editingId === m.id ? (
                  <div className="flex-1 flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 w-28"
                    />
                    <input
                      type="number"
                      value={editDuration}
                      onChange={e => setEditDuration(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 w-20"
                    />
                    <span className="text-text-sub text-sm">分</span>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={e => setEditPrice(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 w-24"
                    />
                    <span className="text-text-sub text-sm">円</span>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-sm font-medium"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-text-sub hover:text-text-main rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-text-main">{m.name}</p>
                      <p className="text-xs text-text-sub">{m.duration}分 · ¥{m.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-2 text-text-sub hover:text-rose rounded-lg hover:bg-rose/10"
                        title="編集"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeMenu(m.id)}
                        className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="flex gap-3 flex-wrap pt-4">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="メニュー名"
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-32"
              />
              <input
                type="number"
                value={newDuration}
                onChange={e => setNewDuration(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-24"
              />
              <span className="self-center text-text-sub text-sm">分</span>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-28"
              />
              <span className="self-center text-text-sub text-sm">円</span>
              <button
                onClick={addMenu}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            回数券
          </span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <p className="text-xs text-text-sub mb-4">
            回数券の種類を登録します。顧客が購入したら消化・期限を管理画面で管理できます。
          </p>
          {ticketPlansLoading ? (
            <p className="text-sm text-text-sub py-4">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {ticketPlans.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                  <div>
                    <p className="font-medium text-text-main">{p.name}</p>
                    <p className="text-xs text-text-sub">
                      {p.menuName} · {p.totalSessions}回 · ¥{p.price.toLocaleString()}
                      {p.expiryDays ? ` · 有効${p.expiryDays}日` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTicketPlan(p.id)}
                    className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 flex-wrap pt-4 border-t border-gray-100">
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="例: フェイシャル5回券"
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-40"
                />
                <select
                  value={courseMenuName}
                  onChange={e => setCourseMenuName(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
                >
                  {menus.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={courseSessions}
                  onChange={e => setCourseSessions(Number(e.target.value))}
                  min={2}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-20"
                />
                <span className="self-center text-text-sub text-sm">回</span>
                <input
                  type="number"
                  value={coursePrice}
                  onChange={e => setCoursePrice(Number(e.target.value))}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-28"
                />
                <span className="self-center text-text-sub text-sm">円</span>
                <input
                  type="number"
                  value={courseExpiryDays}
                  onChange={e => setCourseExpiryDays(Number(e.target.value))}
                  min={1}
                  placeholder="日数"
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-24"
                />
                <span className="self-center text-text-sub text-sm">日</span>
                <button
                  onClick={addTicketPlan}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            サブスクプラン
          </span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <p className="text-xs text-text-sub mb-4">
            月額制プランを登録します。顧客が加入したら毎月の利用回数を管理できます。
          </p>
          <div className="space-y-3">
            {subPlans.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                <div>
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">
                    ¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回 · 毎月{p.billingDay}日課金
                  </p>
                </div>
                <button
                  onClick={() => removeSubPlan(p.id)}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap pt-4 border-t border-gray-100">
              <input
                type="text"
                value={subName}
                onChange={e => setSubName(e.target.value)}
                placeholder="例: 月額プレミアム"
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-36"
              />
              <select
                value={subMenuName}
                onChange={e => setSubMenuName(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              >
                {menus.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={subPrice}
                onChange={e => setSubPrice(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-24"
              />
              <span className="self-center text-text-sub text-sm">円/月</span>
              <input
                type="number"
                value={subSessions}
                onChange={e => setSubSessions(Number(e.target.value))}
                min={1}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-16"
              />
              <span className="self-center text-text-sub text-sm">回/月</span>
              <input
                type="number"
                value={subBillingDay}
                onChange={e => setSubBillingDay(Number(e.target.value))}
                min={1}
                max={28}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-16"
              />
              <span className="self-center text-text-sub text-sm">日課金</span>
              <button
                onClick={addSubPlan}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
