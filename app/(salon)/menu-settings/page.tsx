'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Ticket, Repeat } from 'lucide-react'
import { fetchTicketPlans, createTicketPlan, deleteTicketPlan, type TicketPlan } from '@/lib/tickets'
import { fetchSubscriptionPlans, createSubscriptionPlan, deleteSubscriptionPlan, type SubscriptionPlan } from '@/lib/subscriptions'
import { fetchMenus, saveMenu, updateMenu, deleteMenu, migrateMenusFromLocalStorage, type MenuItem } from '@/lib/menus'

export default function MenuSettingsPage() {
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [menusLoading, setMenusLoading] = useState(true)
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
  const [courseMenuName, setCourseMenuName] = useState('')
  const [courseSessions, setCourseSessions] = useState(5)
  const [coursePrice, setCoursePrice] = useState(40000)
  const [courseExpiryDays, setCourseExpiryDays] = useState(180)

  const [subPlans, setSubPlansState] = useState<SubscriptionPlan[]>([])
  const [subPlansLoading, setSubPlansLoading] = useState(true)
  const [subName, setSubName] = useState('')
  const [subMenuNames, setSubMenuNames] = useState<string[]>([])
  const [subPrice, setSubPrice] = useState(8000)
  const [subSessions, setSubSessions] = useState(2)
  const [subBillingDay, setSubBillingDay] = useState(1)
  const [subDuration, setSubDuration] = useState(60)

  useEffect(() => {
    migrateMenusFromLocalStorage().then(() => {
      fetchMenus().then(m => {
        setMenus(m)
        setMenusLoading(false)
        if (m.length > 0) {
          setCourseMenuName(m[0].name)
          setSubMenuNames([m[0].name])
        }
      }).catch(() => setMenusLoading(false))
    })
    setTicketPlansLoading(true)
    setSubPlansLoading(true)
    fetchTicketPlans().then(p => { setTicketPlansState(p) }).catch(() => {}).finally(() => setTicketPlansLoading(false))
    fetchSubscriptionPlans().then(p => { setSubPlansState(p) }).catch(() => {}).finally(() => setSubPlansLoading(false))
  }, [])

  const addMenu = async () => {
    if (!newName.trim()) return
    const saved = await saveMenu({ name: newName.trim(), duration: newDuration, price: newPrice, category: '' })
    if (saved) {
      setMenus(prev => [...prev, saved])
      setNewName('')
      setNewDuration(60)
      setNewPrice(5000)
    } else {
      alert('登録に失敗しました')
    }
  }

  const removeMenu = async (id: string) => {
    try {
      await deleteMenu(id)
      setMenus(prev => prev.filter(m => m.id !== id))
      if (editingId === id) setEditingId(null)
    } catch {
      alert('削除に失敗しました')
    }
  }

  const startEdit = (m: MenuItem) => {
    setEditingId(m.id)
    setEditName(m.name)
    setEditDuration(m.duration)
    setEditPrice(m.price)
  }

  const saveEdit = async () => {
    if (!editingId) return
    try {
      await updateMenu(editingId, { name: editName.trim(), duration: editDuration, price: editPrice })
      setMenus(prev => prev.map(m =>
        m.id === editingId ? { ...m, name: editName.trim(), duration: editDuration, price: editPrice } : m
      ))
      setEditingId(null)
    } catch {
      alert('更新に失敗しました')
    }
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

  const addSubPlan = async () => {
    if (!subName.trim() || subMenuNames.length === 0) return
    try {
      const plan = await createSubscriptionPlan({
        name: subName.trim(),
        menuName: subMenuNames.join(', '),
        price: subPrice,
        sessionsPerMonth: subSessions,
        billingDay: Math.min(28, Math.max(1, subBillingDay)),
        durationMinutes: Math.max(1, subDuration),
      })
      setSubPlansState(prev => [...prev, plan])
      setSubName('')
      setSubMenuNames([])
      setSubPrice(8000)
      setSubSessions(2)
      setSubBillingDay(1)
      setSubDuration(60)
    } catch {
      alert('登録に失敗しました')
    }
  }

  const removeSubPlan = async (id: string) => {
    if (!confirm('削除しますか？')) return
    try {
      await deleteSubscriptionPlan(id)
      setSubPlansState(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('削除に失敗しました')
    }
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
            {menusLoading ? (
              <p className="text-sm text-text-sub py-4">読み込み中...</p>
            ) : (
            <>
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
                      value={editDuration || ''}
                      onChange={e => setEditDuration(e.target.value === '' ? 0 : Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 w-20"
                    />
                    <span className="text-text-sub text-sm">分</span>
                    <input
                      type="number"
                      value={editPrice || ''}
                      onChange={e => setEditPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                      onFocus={e => e.target.select()}
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
            </>
            )}
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
                value={newDuration || ''}
                onChange={e => setNewDuration(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-24"
              />
              <span className="self-center text-text-sub text-sm">分</span>
              <input
                type="number"
                value={newPrice || ''}
                onChange={e => setNewPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={e => e.target.select()}
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
                  onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCourseSessions(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()}
                  min={2}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-20"
                />
                <span className="self-center text-text-sub text-sm">回</span>
                <input
                  type="number"
                  value={coursePrice}
                  onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCoursePrice(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()}
                  className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-28"
                />
                <span className="self-center text-text-sub text-sm">円</span>
                <input
                  type="number"
                  value={courseExpiryDays}
                  onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCourseExpiryDays(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()}
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
                    ¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回 · {p.durationMinutes}分 · 毎月{p.billingDay}日課金
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
              <div className="w-full">
                <p className="text-xs text-text-sub mb-1">メニュー（複数選択可）</p>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                  {menus.map(m => (
                    <label key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-rose/5 ${subMenuNames.includes(m.name) ? 'bg-rose/10' : ''}`}>
                      <input type="checkbox" checked={subMenuNames.includes(m.name)}
                        onChange={() => setSubMenuNames(prev => prev.includes(m.name) ? prev.filter(n => n !== m.name) : [...prev, m.name])}
                        className="accent-rose" />
                      <span className="text-sm">{m.name}</span>
                    </label>
                  ))}
                </div>
                {subMenuNames.length > 0 && <p className="text-xs text-rose mt-1">{subMenuNames.length}件選択</p>}
              </div>
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
              <input
                type="number"
                value={subDuration}
                onChange={e => setSubDuration(Number(e.target.value))}
                min={1}
                step={5}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-20"
                title="サブスクメニューの施術時間(分)"
              />
              <span className="self-center text-text-sub text-sm">分</span>
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
