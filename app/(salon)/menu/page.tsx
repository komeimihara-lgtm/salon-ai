'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Ticket, Repeat, Tag, Settings2 } from 'lucide-react'
import { getCoursePacks, setCoursePacks, type CoursePack } from '@/lib/courses'
import { getSubscriptionPlans, setSubscriptionPlans, type SubscriptionPlan } from '@/lib/subscriptions'
import {
  getMenus, setMenus, getCategories, setCategories,
  getTaxSettings, setTaxSettings, getCampaigns, setCampaigns,
  type MenuItem, type TaxSettings, type Campaign
} from '@/lib/menus'

export default function MenuSettingsPage() {
  const [activeTab, setActiveTab] = useState<'menus' | 'courses' | 'subscriptions' | 'campaigns' | 'tax'>('menus')
  const [menus, setMenusState] = useState<MenuItem[]>([])
  const [categories, setCategoriesState] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [taxSettings, setTaxSettingsState] = useState<TaxSettings>({ taxType: 'included', taxRate: 10 })
  const [campaigns, setCampaignsState] = useState<Campaign[]>([])
  const [coursePacks, setCoursePacksState] = useState<CoursePack[]>([])
  const [subPlans, setSubPlansState] = useState<SubscriptionPlan[]>([])

  // メニュー追加フォーム
  const [newName, setNewName] = useState('')
  const [newDuration, setNewDuration] = useState(60)
  const [newPrice, setNewPrice] = useState(5000)
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDuration, setEditDuration] = useState(60)
  const [editPrice, setEditPrice] = useState(0)
  const [editCategory, setEditCategory] = useState('')

  // カテゴリ追加
  const [newCategoryName, setNewCategoryName] = useState('')

  // キャンペーン追加フォーム
  const [campName, setCampName] = useState('')
  const [campDiscountType, setCampDiscountType] = useState<'percent' | 'amount'>('percent')
  const [campDiscountValue, setCampDiscountValue] = useState(10)
  const [campStartDate, setCampStartDate] = useState('')
  const [campEndDate, setCampEndDate] = useState('')

  // コース・サブスク
  const [courseName, setCourseName] = useState('')
  const [courseMenuName, setCourseMenuName] = useState('')
  const [courseSessions, setCourseSessions] = useState(5)
  const [coursePrice, setCoursePrice] = useState(40000)
  const [courseExpiryMonths, setCourseExpiryMonths] = useState(6)
  const [subName, setSubName] = useState('')
  const [subMenuName, setSubMenuName] = useState('')
  const [subPrice, setSubPrice] = useState(8000)
  const [subSessions, setSubSessions] = useState(2)
  const [subBillingDay, setSubBillingDay] = useState(1)

  useEffect(() => {
    const m = getMenus()
    const c = getCategories()
    setMenusState(m)
    setCategoriesState(c)
    setSelectedCategory(c[0] ?? '')
    setNewCategory(c[0] ?? '')
    setTaxSettingsState(getTaxSettings())
    setCampaignsState(getCampaigns())
    setCoursePacksState(getCoursePacks())
    setSubPlansState(getSubscriptionPlans())
    setCourseMenuName(m[0]?.name ?? '')
    setSubMenuName(m[0]?.name ?? '')
  }, [])

  const filteredMenus = selectedCategory
    ? menus.filter(m => m.category === selectedCategory)
    : menus

  const addMenu = () => {
    if (!newName.trim()) return
    const item: MenuItem = {
      id: Date.now().toString(),
      name: newName.trim(),
      duration: newDuration,
      price: newPrice,
      category: newCategory || categories[0] || '',
    }
    const next = [...menus, item]
    setMenusState(next)
    setMenus(next)
    setNewName('')
    setNewDuration(60)
    setNewPrice(5000)
  }

  const removeMenu = (id: string) => {
    const next = menus.filter(m => m.id !== id)
    setMenusState(next)
    setMenus(next)
  }

  const startEdit = (m: MenuItem) => {
    setEditingId(m.id)
    setEditName(m.name)
    setEditDuration(m.duration)
    setEditPrice(m.price)
    setEditCategory(m.category)
  }

  const saveEdit = () => {
    if (!editingId) return
    const next = menus.map(m =>
      m.id === editingId
        ? { ...m, name: editName.trim(), duration: editDuration, price: editPrice, category: editCategory }
        : m
    )
    setMenusState(next)
    setMenus(next)
    setEditingId(null)
  }

  const addCategory = () => {
    if (!newCategoryName.trim()) return
    const next = [...categories, newCategoryName.trim()]
    setCategoriesState(next)
    setCategories(next)
    setNewCategoryName('')
  }

  const removeCategory = (cat: string) => {
    const next = categories.filter(c => c !== cat)
    setCategoriesState(next)
    setCategories(next)
  }

  const saveTax = () => {
    setTaxSettings(taxSettings)
    alert('消費税設定を保存しました')
  }

  const addCampaign = () => {
    if (!campName.trim()) return
    const camp: Campaign = {
      id: Date.now().toString(),
      name: campName.trim(),
      discountType: campDiscountType,
      discountValue: campDiscountValue,
      startDate: campStartDate || undefined,
      endDate: campEndDate || undefined,
    }
    const next = [...campaigns, camp]
    setCampaignsState(next)
    setCampaigns(next)
    setCampName('')
    setCampDiscountValue(10)
    setCampStartDate('')
    setCampEndDate('')
  }

  const removeCampaign = (id: string) => {
    const next = campaigns.filter(c => c.id !== id)
    setCampaignsState(next)
    setCampaigns(next)
  }

  const addCoursePack = () => {
    if (!courseName.trim()) return
    const pack: CoursePack = {
      id: Date.now().toString(),
      name: courseName.trim(),
      menuName: courseMenuName,
      totalSessions: courseSessions,
      price: coursePrice,
      expiryMonths: courseExpiryMonths,
    }
    const next = [...coursePacks, pack]
    setCoursePacksState(next)
    setCoursePacks(next)
    setCourseName('')
  }

  const addSubPlan = () => {
    if (!subName.trim()) return
    const plan: SubscriptionPlan = {
      id: Date.now().toString(),
      name: subName.trim(),
      price: subPrice,
      sessionsPerMonth: subSessions,
      menuName: subMenuName,
      billingDay: Math.min(28, Math.max(1, subBillingDay)),
    }
    const next = [...subPlans, plan]
    setSubPlansState(next)
    setSubscriptionPlans(next)
    setSubName('')
  }

  const TABS = [
    { id: 'menus', label: '施術メニュー' },
    { id: 'campaigns', label: 'キャンペーン' },
    { id: 'courses', label: '回数券' },
    { id: 'subscriptions', label: 'サブスク' },
    { id: 'tax', label: '消費税設定' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans text-base font-bold text-text-main">メニュー設定</span>
      </div>

      {/* タブ */}
      <div className="flex gap-2 p-1 bg-light-lav/50 rounded-xl overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-white shadow text-rose' : 'text-text-sub hover:text-text-main'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 施術メニュー */}
      {activeTab === 'menus' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden space-y-6">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />

          {/* 大分類 */}
          <div>
            <h3 className="text-sm font-bold text-text-main mb-3">大分類</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-1 px-3 py-1.5 bg-light-lav rounded-lg">
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-sm font-medium ${selectedCategory === cat ? 'text-rose' : 'text-text-main'}`}
                  >
                    {cat}
                  </button>
                  <button onClick={() => removeCategory(cat)} className="text-text-sub hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="新しい大分類名"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-rose outline-none text-sm"
              />
              <button
                onClick={addCategory}
                className="px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 小分類メニュー一覧 */}
          <div>
            <h3 className="text-sm font-bold text-text-main mb-3">
              小分類メニュー {selectedCategory ? `（${selectedCategory}）` : '（全て）'}
            </h3>
            <div className="space-y-2">
              {filteredMenus.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                  {editingId === m.id ? (
                    <div className="flex-1 flex gap-2 flex-wrap items-center">
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 w-28" />
                      <input type="number" value={editDuration} onChange={e => setEditDuration(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 w-20" />
                      <span className="text-text-sub text-sm">分</span>
                      <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 w-24" />
                      <span className="text-text-sub text-sm">円</span>
                      <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200">
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={saveEdit}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-sm">保存</button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-text-sub rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium text-text-main">{m.name}</p>
                        <p className="text-xs text-text-sub">{m.category} · {m.duration}分 · ¥{m.price.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(m)} className="p-2 text-text-sub hover:text-rose rounded-lg">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeMenu(m.id)} className="p-2 text-text-sub hover:text-red-600 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* メニュー追加フォーム */}
            <div className="flex gap-2 flex-wrap pt-4 border-t border-gray-100 mt-4">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="メニュー名" className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-32" />
              <input type="number" value={newDuration} onChange={e => setNewDuration(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-20" />
              <span className="self-center text-text-sub text-sm">分</span>
              <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-28" />
              <span className="self-center text-text-sub text-sm">円</span>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={addMenu}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
                <Plus className="w-4 h-4" />追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* キャンペーン */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3 mb-6">
            {campaigns.length === 0 && <p className="text-sm text-text-sub">キャンペーンがありません</p>}
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                <div>
                  <p className="font-medium text-text-main">{c.name}</p>
                  <p className="text-xs text-text-sub">
                    {c.discountType === 'percent' ? `${c.discountValue}%OFF` : `¥${c.discountValue.toLocaleString()}引き`}
                    {c.startDate && ` · ${c.startDate}〜${c.endDate}`}
                  </p>
                </div>
                <button onClick={() => removeCampaign(c.id)} className="p-2 text-text-sub hover:text-red-600 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
            <input type="text" value={campName} onChange={e => setCampName(e.target.value)}
              placeholder="キャンペーン名" className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-40" />
            <select value={campDiscountType} onChange={e => setCampDiscountType(e.target.value as 'percent' | 'amount')}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
              <option value="percent">%OFF</option>
              <option value="amount">円引き</option>
            </select>
            <input type="number" value={campDiscountValue} onChange={e => setCampDiscountValue(Number(e.target.value))}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-24" />
            <input type="date" value={campStartDate} onChange={e => setCampStartDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none" />
            <span className="self-center text-text-sub text-sm">〜</span>
            <input type="date" value={campEndDate} onChange={e => setCampEndDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none" />
            <button onClick={addCampaign}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
              <Plus className="w-4 h-4" />追加
            </button>
          </div>
        </div>
      )}

      {/* 回数券 */}
      {activeTab === 'courses' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3 mb-4">
            {coursePacks.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                <div>
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">{p.menuName} · {p.totalSessions}回 · ¥{p.price.toLocaleString()} · 有効{p.expiryMonths}ヶ月</p>
                </div>
                <button onClick={() => { const next = coursePacks.filter(x => x.id !== p.id); setCoursePacksState(next); setCoursePacks(next) }}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
            <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)}
              placeholder="例: フェイシャル5回券" className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-40" />
            <select value={courseMenuName} onChange={e => setCourseMenuName(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
              {menus.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <input type="number" value={courseSessions} onChange={e => setCourseSessions(Number(e.target.value))}
              min={2} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-20" />
            <span className="self-center text-text-sub text-sm">回</span>
            <input type="number" value={coursePrice} onChange={e => setCoursePrice(Number(e.target.value))}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-28" />
            <span className="self-center text-text-sub text-sm">円</span>
            <input type="number" value={courseExpiryMonths} onChange={e => setCourseExpiryMonths(Number(e.target.value))}
              min={1} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-20" />
            <span className="self-center text-text-sub text-sm">ヶ月</span>
            <button onClick={addCoursePack}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
              <Plus className="w-4 h-4" />追加
            </button>
          </div>
        </div>
      )}

      {/* サブスク */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3 mb-4">
            {subPlans.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                <div>
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回 · 毎月{p.billingDay}日課金</p>
                </div>
                <button onClick={() => { const next = subPlans.filter(x => x.id !== p.id); setSubPlansState(next); setSubscriptionPlans(next) }}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
            <input type="text" value={subName} onChange={e => setSubName(e.target.value)}
              placeholder="例: 月額プレミアム" className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-36" />
            <select value={subMenuName} onChange={e => setSubMenuName(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
              {menus.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <input type="number" value={subPrice} onChange={e => setSubPrice(Number(e.target.value))}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-24" />
            <span className="self-center text-text-sub text-sm">円/月</span>
            <input type="number" value={subSessions} onChange={e => setSubSessions(Number(e.target.value))}
              min={1} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-16" />
            <span className="self-center text-text-sub text-sm">回/月</span>
            <input type="number" value={subBillingDay} onChange={e => setSubBillingDay(Number(e.target.value))}
              min={1} max={28} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-16" />
            <span className="self-center text-text-sub text-sm">日課金</span>
            <button onClick={addSubPlan}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
              <Plus className="w-4 h-4" />追加
            </button>
          </div>
        </div>
      )}

      {/* 消費税設定 */}
      {activeTab === 'tax' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-6">
            <div>
              <label className="text-sm font-bold text-text-main block mb-3">税表示</label>
              <div className="flex gap-3">
                {[{ value: 'included', label: '内税（税込）' }, { value: 'excluded', label: '外税（税抜）' }].map(opt => (
                  <button key={opt.value}
                    onClick={() => setTaxSettingsState(prev => ({ ...prev, taxType: opt.value as 'included' | 'excluded' }))}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      taxSettings.taxType === opt.value
                        ? 'bg-gradient-to-r from-rose to-lavender text-white'
                        : 'bg-light-lav text-text-sub'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-text-main block mb-3">消費税率</label>
              <div className="flex items-center gap-3">
                <input type="number" value={taxSettings.taxRate}
                  onChange={e => setTaxSettingsState(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                  min={0} max={100}
                  className="w-24 px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none text-lg font-bold" />
                <span className="text-text-main font-bold">%</span>
              </div>
            </div>
            <button onClick={saveTax}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold">
              保存する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
