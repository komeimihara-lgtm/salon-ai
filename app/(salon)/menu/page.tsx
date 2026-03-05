'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Pencil, X, Ticket, Repeat, Tag, Settings2, Loader2 } from 'lucide-react'
import { fetchTicketPlans, createTicketPlan, deleteTicketPlan, type TicketPlan } from '@/lib/tickets'
import { fetchSubscriptionPlans, createSubscriptionPlan, deleteSubscriptionPlan, type SubscriptionPlan } from '@/lib/subscriptions'
import {
  getMenus, setMenus, getCategories, setCategories,
  getTaxSettings, setTaxSettings, getCampaigns, setCampaigns,
  DEFAULT_CATEGORIES, isCampaignActive, isCampaignExpired,
  type MenuItem, type TaxSettings, type Campaign, type CampaignType, type CampaignTargetType
} from '@/lib/menus'

// インポート用メニュー型（要確認フラグ付き）
type ImportMenuItem = MenuItem & { needsReview?: boolean }

// インポートモーダル
function ImportModal({ onClose, onImport }: {
  onClose: () => void
  onImport: (menus: MenuItem[], categories: string[]) => void
}) {
  const [mode, setMode] = useState<'image' | 'pdf' | 'url'>('image')
  const [url, setUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [filesOverflowWarning, setFilesOverflowWarning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ menus: ImportMenuItem[], categories: string[] } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<ImportMenuItem>>({})
  const [error, setError] = useState('')

  const CATEGORIES = ['フェイシャル', 'ボディ', '脱毛', 'オプション', '物販', 'キャンペーン', 'クーポン']

  const handleExtract = async () => {
    setLoading(true); setError(''); setPreview(null)
    try {
      const formData = new FormData()
      formData.append('type', mode)
      if (mode === 'url') {
        formData.append('url', url)
      } else {
        const toSend = files.length > 0 ? files.slice(0, 20) : []
        toSend.forEach(f => formData.append('files', f))
        if (toSend.length === 0) throw new Error('ファイルを選択してください')
      }
      const res = await fetch('/api/menu/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const menus: ImportMenuItem[] = (json.menus || []).map((m: ImportMenuItem) => ({
        ...m,
        id: `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category: m.category || 'フェイシャル',
        duration: m.duration ?? 60,
        price: m.price ?? 0,
      }))
      setPreview({ menus, categories: json.categories || CATEGORIES })
      setSelectedIds(new Set(menus.map(m => m.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み取りに失敗しました。別の画像やURLをお試しください。')
    } finally {
      setLoading(false)
    }
  }

  const updatePreviewMenu = (id: string, updates: Partial<ImportMenuItem>) => {
    if (!preview) return
    setPreview({
      ...preview,
      menus: preview.menus.map(m => m.id === id ? { ...m, ...updates } : m),
    })
    setEditingId(null)
    setEditRow({})
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!preview) return
    if (selectedIds.size === preview.menus.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(preview.menus.map(m => m.id)))
  }

  const handleImport = () => {
    if (!preview) return
    const toImport = preview.menus.filter(m => selectedIds.has(m.id))
    onImport(toImport, preview.categories)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="font-bold text-text-main text-lg">メニューを自動インポート</h3>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-text-main"><X className="w-5 h-5" /></button>
        </div>

        {!preview ? (
          <>
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 shrink-0">
              💡 URLより画像の方が精度が高いです。メニュー表のスクショをアップロードすることをおすすめします。
            </p>
            <div className="flex gap-2 mb-4 shrink-0">
              {[{ id: 'image', label: '📷 画像' }, { id: 'pdf', label: '📄 PDF' }, { id: 'url', label: '🌐 URL' }].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as typeof mode)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${mode === m.id ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'url' ? (
              <div className="mb-4 shrink-0">
                <p className="text-xs text-text-sub mb-2">URLが読み込めない場合はスクショをお試しください。（JavaScriptで動的に読み込まれるページは取得できない場合があります）</p>
                <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://beauty.hotpepper.jp/..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose outline-none text-sm" />
              </div>
            ) : (
              <div className="mb-4 shrink-0">
                <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-rose transition-all">
                  <input type="file" accept={mode === 'pdf' ? '.pdf' : 'image/*'} className="hidden" multiple
                    onChange={e => {
                      const selected = Array.from(e.target.files || [])
                      if (selected.length > 20) {
                        setFiles(selected.slice(0, 20))
                        setFilesOverflowWarning(true)
                      } else {
                        setFiles(selected)
                        setFilesOverflowWarning(false)
                      }
                    }} />
                  {files.length > 0 ? (
                    <p className="text-sm text-text-main font-medium">{files.length}件のファイルを選択（最大20枚まで）</p>
                  ) : (
                    <>
                      <p className="text-2xl mb-2">{mode === 'pdf' ? '📄' : '📷'}</p>
                      <p className="text-sm text-text-sub">{mode === 'pdf' ? 'PDFファイルをアップロード（最大20枚まで）' : 'メニュー表の画像をアップロード（最大20枚まで）'}</p>
                    </>
                  )}
                </label>
                {filesOverflowWarning && (
                  <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    20枚を超えたため、先頭20枚のみ処理します
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-400 mb-3 shrink-0">{error}</p>}

            <button onClick={handleExtract} disabled={loading || (mode === 'url' ? !url.trim() : files.length === 0)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 shrink-0">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />読み取り中...</> : '✨ AIで読み取る'}
            </button>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h4 className="font-bold text-text-main">読み取り結果（{preview.menus.length}件）</h4>
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)} className="py-2 px-4 rounded-xl border border-gray-200 text-sm">やり直す</button>
                <button onClick={handleImport} disabled={selectedIds.size === 0}
                  className="py-2 px-4 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold text-sm disabled:opacity-50">
                  選択した項目をインポート（{selectedIds.size}件）
                </button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="bg-light-lav/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">
                      <input type="checkbox" checked={selectedIds.size === preview.menus.length} onChange={toggleSelectAll}
                        className="rounded border-gray-300" />
                    </th>
                    <th className="p-2 text-left text-text-sub font-medium">施術名</th>
                    <th className="p-2 text-left text-text-sub font-medium">カテゴリ</th>
                    <th className="p-2 text-left text-text-sub font-medium">所要時間</th>
                    <th className="p-2 text-left text-text-sub font-medium">価格</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.menus.map((m) => (
                    <tr key={m.id} className={`border-t border-gray-100 ${m.needsReview ? 'bg-orange-50' : ''}`}>
                      <td className="p-2">
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)}
                          className="rounded border-gray-300" />
                      </td>
                      <td className="p-2">
                        {editingId === m.id ? (
                          <input value={editRow.name ?? m.name} onChange={e => setEditRow(r => ({ ...r, name: e.target.value }))}
                            className="w-full px-2 py-1 border rounded text-sm" onBlur={() => updatePreviewMenu(m.id, { name: editRow.name ?? m.name })} autoFocus />
                        ) : (
                          <span className="font-medium text-text-main cursor-pointer hover:bg-gray-100 rounded px-1" onClick={() => { setEditingId(m.id); setEditRow({ name: m.name, category: m.category, duration: m.duration, price: m.price }) }}>{m.name || '（未入力）'}</span>
                        )}
                        {m.needsReview && <span className="ml-1 text-xs text-orange-600 font-medium">要確認</span>}
                      </td>
                      <td className="p-2">
                        {editingId === m.id ? (
                          <select value={editRow.category ?? m.category} onChange={e => setEditRow(r => ({ ...r, category: e.target.value }))}
                            className="px-2 py-1 border rounded text-sm" onBlur={() => updatePreviewMenu(m.id, { category: editRow.category ?? m.category })}>
                            {(preview.categories.length ? preview.categories : CATEGORIES).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="cursor-pointer hover:bg-gray-100 rounded px-1" onClick={() => { setEditingId(m.id); setEditRow({ name: m.name, category: m.category, duration: m.duration, price: m.price }) }}>{m.category}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {editingId === m.id ? (
                          <input type="number" value={editRow.duration ?? m.duration} onChange={e => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setEditRow(r => ({ ...r, duration: v === '' ? 0 : Number(v) })) }}
                            onBlur={() => updatePreviewMenu(m.id, { duration: editRow.duration ?? m.duration })}
                            className="w-16 px-2 py-1 border rounded text-sm" />
                        ) : (
                          <span className="cursor-pointer hover:bg-gray-100 rounded px-1" onClick={() => { setEditingId(m.id); setEditRow({ name: m.name, category: m.category, duration: m.duration, price: m.price }) }}>{m.duration}分</span>
                        )}
                      </td>
                      <td className="p-2">
                        {editingId === m.id ? (
                          <input type="number" value={editRow.price ?? m.price} onChange={e => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setEditRow(r => ({ ...r, price: v === '' ? 0 : Number(v) })) }}
                            onBlur={() => updatePreviewMenu(m.id, { price: editRow.price ?? m.price })}
                            className="w-24 px-2 py-1 border rounded text-sm" />
                        ) : (
                          <span className="cursor-pointer hover:bg-gray-100 rounded px-1" onClick={() => { setEditingId(m.id); setEditRow({ name: m.name, category: m.category, duration: m.duration, price: m.price }) }}>¥{(m.price ?? 0).toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MenuSettingsPage() {
  const [activeTab, setActiveTab] = useState<'menus' | 'courses' | 'subscriptions' | 'campaigns' | 'tax'>('menus')
  const [menus, setMenusState] = useState<MenuItem[]>([])
  const [categories, setCategoriesState] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [taxSettings, setTaxSettingsState] = useState<TaxSettings>({ taxType: 'included', taxRate: 10 })
  const [campaigns, setCampaignsState] = useState<Campaign[]>([])
  const [ticketPlans, setTicketPlansState] = useState<TicketPlan[]>([])
  const [ticketPlansLoading, setTicketPlansLoading] = useState(true)
  const [subPlans, setSubPlansState] = useState<SubscriptionPlan[]>([])
  const [subPlansLoading, setSubPlansLoading] = useState(true)

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
  const [campType, setCampType] = useState<CampaignType>('discount')
  const [campName, setCampName] = useState('')
  const [campDiscountType, setCampDiscountType] = useState<'percent' | 'amount'>('percent')
  const [campDiscountValue, setCampDiscountValue] = useState(10)
  const [campTargetType, setCampTargetType] = useState<CampaignTargetType>('menu')
  const [campTargetId, setCampTargetId] = useState('')
  const [campTargetName, setCampTargetName] = useState('')
  const [campMenuName, setCampMenuName] = useState('')
  const [campMenuDesc, setCampMenuDesc] = useState('')
  const [campPrice, setCampPrice] = useState(5000)
  const [campDuration, setCampDuration] = useState(60)
  const [campSessions, setCampSessions] = useState(5)
  const [campSubSessions, setCampSubSessions] = useState(2)
  const [campStartDate, setCampStartDate] = useState('')
  const [campEndDate, setCampEndDate] = useState('')

  // コース・サブスク
  const [courseName, setCourseName] = useState('')
  const [courseMenuName, setCourseMenuName] = useState('')
  const [courseCategory, setCourseCategory] = useState('')
  const [courseSessions, setCourseSessions] = useState(5)
  const [coursePrice, setCoursePrice] = useState(40000)
  const [courseExpiryDays, setCourseExpiryDays] = useState(180)
  const [subName, setSubName] = useState('')
  const [subMenuName, setSubMenuName] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [subPrice, setSubPrice] = useState(8000)
  const [subSessions, setSubSessions] = useState(2)
  const [subBillingDay, setSubBillingDay] = useState(1)
  const [showImport, setShowImport] = useState(false)
  const [categoryEditMode, setCategoryEditMode] = useState(false)
  const [showTaxConfirm, setShowTaxConfirm] = useState(false)

  useEffect(() => {
    const m = getMenus()
    const c = getCategories()
    setMenusState(m)
    setCategoriesState(c)
    setSelectedCategory(c[0] ?? '')
    setNewCategory(c[0] ?? '')
    setTaxSettingsState(getTaxSettings())
    setCampaignsState(getCampaigns())
    setCourseMenuName(m[0]?.name ?? '')
    setSubMenuName(m[0]?.name ?? '')
    setCourseCategory(c[0] ?? '')
    setSubCategory(c[0] ?? '')
    setTicketPlansLoading(true)
    setSubPlansLoading(true)
    fetchTicketPlans().then(p => { setTicketPlansState(p) }).catch(() => {}).finally(() => setTicketPlansLoading(false))
    fetchSubscriptionPlans().then(p => { setSubPlansState(p) }).catch(() => {}).finally(() => setSubPlansLoading(false))
  }, [])

  const categoriesForFilter = categories.length > 0 ? categories : DEFAULT_CATEGORIES
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
    if (!confirm(`「${cat}」を削除しますか？\nこのカテゴリのメニューは削除されません。`)) return
    const next = categories.filter(c => c !== cat)
    setCategoriesState(next)
    setCategories(next)
  }

  const saveTax = () => {
    setTaxSettings(taxSettings)
    setShowTaxConfirm(false)
    alert('消費税設定を保存しました')
  }

  const addCampaign = () => {
    if (!campName.trim()) return
    if (campType === 'limited_menu' && !campMenuName.trim()) return
    const camp: Campaign = {
      id: Date.now().toString(),
      name: campName.trim(),
      campaignType: campType,
      startDate: campStartDate || undefined,
      endDate: campEndDate || undefined,
    }
    if (campType === 'discount') {
      camp.discountType = campDiscountType
      camp.discountValue = campDiscountValue
      camp.targetType = campTargetType
      camp.targetId = campTargetId || undefined
      camp.targetName = campTargetName || undefined
    } else {
      camp.menuName = campMenuName.trim()
      camp.menuDescription = campMenuDesc.trim() || undefined
      camp.targetType = campTargetType
      camp.price = campPrice
      if (campTargetType === 'menu') camp.durationMinutes = campDuration
      else if (campTargetType === 'ticket') camp.totalSessions = campSessions
      else if (campTargetType === 'subscription') camp.sessionsPerMonth = campSubSessions
    }
    const next = [...campaigns, camp]
    setCampaignsState(next)
    setCampaigns(next)
    setCampName('')
    setCampMenuName('')
    setCampMenuDesc('')
    setCampDiscountValue(10)
    setCampPrice(5000)
    setCampDuration(60)
    setCampSessions(5)
    setCampSubSessions(2)
    setCampTargetId('')
    setCampTargetName('')
    setCampStartDate('')
    setCampEndDate('')
  }

  const removeCampaign = (id: string) => {
    const next = campaigns.filter(c => c.id !== id)
    setCampaignsState(next)
    setCampaigns(next)
  }

  const addTicketPlan = async () => {
    if (!courseName.trim()) return
    try {
      const plan = await createTicketPlan({
        name: courseName.trim(),
        menuName: courseMenuName,
        totalSessions: courseSessions,
        price: coursePrice,
        expiryDays: courseExpiryDays,
        category: courseCategory || categories[0] || '',
      })
      setTicketPlansState(prev => [...prev, plan])
      setCourseName('')
    } catch {
      alert('登録に失敗しました')
    }
  }

  const addSubPlan = async () => {
    if (!subName.trim()) return
    try {
      const plan = await createSubscriptionPlan({
        name: subName.trim(),
        menuName: subMenuName,
        price: subPrice,
        sessionsPerMonth: subSessions,
        billingDay: Math.min(28, Math.max(1, subBillingDay)),
        category: subCategory || categories[0] || '',
      })
      setSubPlansState(prev => [...prev, plan])
      setSubName('')
    } catch {
      alert('登録に失敗しました')
    }
  }

  const TABS = [
    { id: 'menus', label: '通常メニュー' },
    { id: 'campaigns', label: 'キャンペーン' },
    { id: 'courses', label: '回数チケット' },
    { id: 'subscriptions', label: 'サブスク' },
    { id: 'tax', label: '消費税設定' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans text-base font-bold text-text-main">メニュー設定</span>
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl text-sm font-bold">
          ✨ 自動インポート
        </button>
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

      {/* 通常メニュー */}
      {activeTab === 'menus' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden space-y-6">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />

          {/* 大分類（カテゴリタブ） */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-main">カテゴリ</h3>
              {categoryEditMode ? (
                <button
                  onClick={() => setCategoryEditMode(false)}
                  className="text-sm font-medium text-rose hover:underline"
                >
                  完了
                </button>
              ) : (
                <button
                  onClick={() => setCategoryEditMode(true)}
                  className="text-sm font-medium text-text-sub hover:text-rose"
                >
                  カテゴリを編集
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {categoriesForFilter.map(cat => (
                <div key={cat} className="flex items-center gap-1 px-3 py-1.5 bg-light-lav rounded-lg">
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-sm font-medium ${selectedCategory === cat ? 'text-rose' : 'text-text-main'}`}
                  >
                    {cat}
                  </button>
                  {categoryEditMode && (
                    <button onClick={() => removeCategory(cat)} className="text-text-sub hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
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

          {/* 通常メニューのみ表示 */}
          <div>
            <h3 className="text-sm font-bold text-text-main mb-3">
              メニュー {selectedCategory ? `（${selectedCategory}）` : '（全て）'}
            </h3>
            <div className="space-y-2 mb-4">
              {filteredMenus.map(m => (
                <div key={m.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                  {editingId === m.id ? (
                    <div className="flex-1 flex gap-2 flex-wrap items-center">
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 min-w-48 flex-1" />
                      <input type="number" value={editDuration} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setEditDuration(val === '' ? 0 : Number(val)) }}
                        onFocus={e => e.target.select()} className="px-3 py-1.5 rounded-lg border border-gray-200 w-20" />
                      <span className="text-text-sub text-sm">分</span>
                      <input type="number" value={editPrice} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setEditPrice(val === '' ? 0 : Number(val)) }}
                        onFocus={e => e.target.select()} className="px-3 py-1.5 rounded-lg border border-gray-200 w-24" />
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
                placeholder="メニュー名" className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none min-w-48 flex-1" />
              <input type="number" value={newDuration} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setNewDuration(val === '' ? 0 : Number(val)) }}
                onFocus={e => e.target.select()} className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-20" />
              <span className="self-center text-text-sub text-sm">分</span>
              <input type="number" value={newPrice} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setNewPrice(val === '' ? 0 : Number(val)) }}
                onFocus={e => e.target.select()} className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none w-28" />
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
            {campaigns.map(c => {
              const active = isCampaignActive(c)
              const expired = isCampaignExpired(c)
              return (
                <div key={c.id} className={`flex items-center justify-between py-3 px-4 rounded-xl ${expired ? 'bg-gray-100 opacity-70' : active ? 'bg-rose/5 border border-rose/20' : 'bg-light-lav/50'}`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.campaignType === 'discount' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.campaignType === 'discount' ? '割引' : '期間限定'}
                      </span>
                      <p className="font-medium text-text-main">{c.name}</p>
                    </div>
                    <p className="text-xs text-text-sub mt-0.5">
                      {c.campaignType === 'discount'
                        ? `${c.discountType === 'percent' ? `${c.discountValue ?? 0}%OFF` : `¥${(c.discountValue ?? 0).toLocaleString()}引き`}${c.targetName ? ` · ${c.targetName}` : ''}`
                        : `${c.menuName ?? ''} · ¥${(c.price ?? 0).toLocaleString()}${c.targetType === 'ticket' ? ` · ${c.totalSessions ?? 0}回` : c.targetType === 'subscription' ? ` · ${c.sessionsPerMonth ?? 0}回/月` : ` · ${c.durationMinutes ?? 0}分`}`}
                      {c.startDate && ` · ${c.startDate}〜${c.endDate}`}
                    </p>
                  </div>
                  <button onClick={() => removeCampaign(c.id)} className="p-2 text-text-sub hover:text-red-600 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex gap-2">
              {[
                { value: 'discount' as const, label: '割引キャンペーン' },
                { value: 'limited_menu' as const, label: '期間限定メニュー' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setCampType(opt.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${campType === opt.value ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-text-sub mb-1">キャンペーン名 *</label>
                <input type="text" value={campName} onChange={e => setCampName(e.target.value)}
                  placeholder="例: 初回限定50%OFF" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none" />
              </div>
              {campType === 'discount' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-sub mb-1">対象</label>
                      <select value={campTargetType} onChange={e => setCampTargetType(e.target.value as CampaignTargetType)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                        <option value="menu">通常メニュー</option>
                        <option value="ticket">回数券</option>
                        <option value="subscription">サブスク</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-sub mb-1">対象選択</label>
                      {campTargetType === 'menu' && (
                        <select value={campTargetId} onChange={e => { const m = menus.find(x => x.id === e.target.value); setCampTargetId(e.target.value); setCampTargetName(m?.name ?? '') }}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                          <option value="">選択</option>
                          {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      {campTargetType === 'ticket' && (
                        <select value={campTargetId} onChange={e => { const p = ticketPlans.find(x => x.id === e.target.value); setCampTargetId(e.target.value); setCampTargetName(p?.name ?? '') }}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                          <option value="">選択</option>
                          {ticketPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      {campTargetType === 'subscription' && (
                        <select value={campTargetId} onChange={e => { const p = subPlans.find(x => x.id === e.target.value); setCampTargetId(e.target.value); setCampTargetName(p?.name ?? '') }}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                          <option value="">選択</option>
                          {subPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-text-sub mb-1">割引種別</label>
                      <select value={campDiscountType} onChange={e => setCampDiscountType(e.target.value as 'percent' | 'amount')}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                        <option value="percent">%OFF</option>
                        <option value="amount">円引き</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-sub mb-1">割引額</label>
                      <input type="number" value={campDiscountValue} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCampDiscountValue(val === '' ? 0 : Number(val)) }}
                        onFocus={e => e.target.select()} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                    </div>
                  </div>
                </>
              )}
              {campType === 'limited_menu' && (
                <>
                  <div>
                    <label className="block text-xs text-text-sub mb-1">メニュー名 *</label>
                    <input type="text" value={campMenuName} onChange={e => setCampMenuName(e.target.value)}
                      placeholder="例: 夏の特別フェイシャル" className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-sub mb-1">説明（任意）</label>
                    <input type="text" value={campMenuDesc} onChange={e => setCampMenuDesc(e.target.value)}
                      placeholder="施術内容の説明" className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-sub mb-1">種別</label>
                    <select value={campTargetType} onChange={e => setCampTargetType(e.target.value as CampaignTargetType)}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none">
                      <option value="menu">通常メニュー</option>
                      <option value="ticket">回数券</option>
                      <option value="subscription">サブスク</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-sub mb-1">価格（円）</label>
                      <input type="number" value={campPrice} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCampPrice(val === '' ? 0 : Number(val)) }}
                        onFocus={e => e.target.select()} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                    </div>
                    {campTargetType === 'menu' && (
                      <div>
                        <label className="block text-xs text-text-sub mb-1">施術時間（分）</label>
                        <input type="number" value={campDuration} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCampDuration(val === '' ? 0 : Number(val)) }}
                          onFocus={e => e.target.select()} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                      </div>
                    )}
                    {campTargetType === 'ticket' && (
                      <div>
                        <label className="block text-xs text-text-sub mb-1">回数</label>
                        <input type="number" value={campSessions} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCampSessions(val === '' ? 0 : Number(val)) }}
                          onFocus={e => e.target.select()} min={2} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                      </div>
                    )}
                    {campTargetType === 'subscription' && (
                      <div>
                        <label className="block text-xs text-text-sub mb-1">回数/月</label>
                        <input type="number" value={campSubSessions} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCampSubSessions(val === '' ? 0 : Number(val)) }}
                          onFocus={e => e.target.select()} min={1} className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-sub mb-1">開始日</label>
                  <input type="date" value={campStartDate} onChange={e => setCampStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-text-sub mb-1">終了日</label>
                  <input type="date" value={campEndDate} onChange={e => setCampEndDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none" />
                </div>
              </div>
            </div>
            <button onClick={addCampaign} disabled={!campName.trim() || (campType === 'limited_menu' && !campMenuName.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium disabled:opacity-50">
              <Plus className="w-4 h-4" />追加
            </button>
          </div>
        </div>
      )}

      {/* 回数券 */}
      {activeTab === 'courses' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          {ticketPlansLoading ? (
            <p className="text-sm text-text-sub py-4">読み込み中...</p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {ticketPlans.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                    <div>
                      <p className="font-medium text-text-main">{p.name}</p>
                      <p className="text-xs text-text-sub">
                        {p.menuName} · {p.totalSessions}回 · ¥{p.price.toLocaleString()}
                        {p.expiryDays ? ` · 有効${p.expiryDays}日` : ''}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('削除しますか？')) return
                        try {
                          await deleteTicketPlan(p.id)
                          setTicketPlansState(prev => prev.filter(x => x.id !== p.id))
                        } catch {
                          alert('削除に失敗しました')
                        }
                      }}
                      className="p-2 text-text-sub hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
                <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)}
                  placeholder="例: フェイシャル5回券" className="px-4 py-2 rounded-xl border border-gray-200 outline-none min-w-48 flex-1" />
                <select value={courseCategory} onChange={e => setCourseCategory(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
                  {(categories.length ? categories : DEFAULT_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={courseMenuName} onChange={e => setCourseMenuName(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
                  {menus.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <input type="number" value={courseSessions} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCourseSessions(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()} min={2} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-20" />
                <span className="self-center text-text-sub text-sm">回</span>
                <input type="number" value={coursePrice} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCoursePrice(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-28" />
                <span className="self-center text-text-sub text-sm">円</span>
                <input type="number" value={courseExpiryDays} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setCourseExpiryDays(val === '' ? 0 : Number(val)) }}
                  onFocus={e => e.target.select()} min={1} placeholder="日数" className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-24" />
                <span className="self-center text-text-sub text-sm">日</span>
                <button onClick={addTicketPlan}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
                  <Plus className="w-4 h-4" />追加
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* サブスク */}
      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          {subPlansLoading ? (
            <p className="text-sm text-text-sub py-4">読み込み中...</p>
          ) : (
          <>
          <div className="space-y-3 mb-4">
            {subPlans.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 px-4 bg-light-lav/50 rounded-xl">
                <div>
                  <p className="font-medium text-text-main">{p.name}</p>
                  <p className="text-xs text-text-sub">¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回 · 毎月{p.billingDay}日課金</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('削除しますか？')) return
                    try {
                      await deleteSubscriptionPlan(p.id)
                      setSubPlansState(prev => prev.filter(x => x.id !== p.id))
                    } catch {
                      alert('削除に失敗しました')
                    }
                  }}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
            <input type="text" value={subName} onChange={e => setSubName(e.target.value)}
              placeholder="例: 月額プレミアム" className="px-4 py-2 rounded-xl border border-gray-200 outline-none min-w-48 flex-1" />
            <select value={subCategory} onChange={e => setSubCategory(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
              {(categories.length ? categories : DEFAULT_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={subMenuName} onChange={e => setSubMenuName(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 outline-none">
              {menus.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <input type="number" value={subPrice} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setSubPrice(val === '' ? 0 : Number(val)) }}
              onFocus={e => e.target.select()} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-24" />
            <span className="self-center text-text-sub text-sm">円/月</span>
            <input type="number" value={subSessions} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setSubSessions(val === '' ? 0 : Number(val)) }}
              onFocus={e => e.target.select()} min={1} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-16" />
            <span className="self-center text-text-sub text-sm">回/月</span>
            <input type="number" value={subBillingDay} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setSubBillingDay(val === '' ? 0 : Number(val)) }}
              onFocus={e => e.target.select()} min={1} max={28} className="px-4 py-2 rounded-xl border border-gray-200 outline-none w-16" />
            <span className="self-center text-text-sub text-sm">日課金</span>
            <button onClick={addSubPlan}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium">
              <Plus className="w-4 h-4" />追加
            </button>
          </div>
          </>
          )}
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
                  onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setTaxSettingsState(prev => ({ ...prev, taxRate: val === '' ? 0 : Number(val) })) }}
                  onFocus={e => e.target.select()} min={0} max={100}
                  className="w-24 px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none text-lg font-bold" />
                <span className="text-text-main font-bold">%</span>
              </div>
            </div>
            <button onClick={() => setShowTaxConfirm(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold">
              保存する
            </button>
          </div>
        </div>
      )}

      {/* 消費税設定 確認モーダル */}
      {showTaxConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main text-lg mb-4">消費税設定の変更</h3>
            <p className="text-sm text-text-main mb-6 whitespace-pre-line">
              消費税設定を変更しますか？
              変更すると全メニューの税計算に影響します。
              本当に変更してよいですか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTaxConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={saveTax}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium"
              >
                変更する
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(newMenus, newCategories) => {
            const merged = [...menus, ...newMenus]
            setMenusState(merged)
            setMenus(merged)
            const mergedCats = Array.from(new Set([...categories, ...newCategories]))
            setCategoriesState(mergedCats)
            setCategories(mergedCats)
            setShowImport(false)
          }}
        />
      )}
    </div>
  )
}
