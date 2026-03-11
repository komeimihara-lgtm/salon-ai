'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  User,
  Phone,
  Calendar,
  Heart,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Loader2,
  X,
} from 'lucide-react'
import { fetchMenus, type MenuItem } from '@/lib/menus'
import { fetchStaffList } from '@/lib/staff-management'
import { ChartImage } from '@/components/chart-image'

interface Customer {
  id: string
  name: string
  name_kana?: string
  phone?: string
  email?: string
  birthday?: string
  visit_count: number
  last_visit_date?: string
  concerns?: string
  goals?: string
  allergies?: string
  memo?: string
  skin_type?: string
  preferred_menu?: string
  treatment_intensity?: string
  assigned_staff?: string
  photo_url?: string
  line_user_id?: string
  status: string
  updated_at?: string
}

interface Visit {
  id: string
  visit_date: string
  menu?: string
  staff_name?: string
  amount: number
  skin_condition?: string
  treatment_note?: string
  counseling_note?: string
  products_used?: string
  scope_image_before?: string
  scope_image_after?: string
  visit_images?: string[]
  created_at: string
}

const CONCERN_OPTIONS = ['乾燥', '毛穴', 'たるみ', 'くすみ', 'ニキビ', '脱毛', 'その他']
const INTENSITY_OPTIONS = [
  { value: 'light', label: '弱め' },
  { value: 'normal', label: '普通' },
  { value: 'strong', label: '強め' },
]

export default function ChartPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'gallery' | 'follow'>('info')
  const [addVisitOpen, setAddVisitOpen] = useState(false)
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [staffList, setStaffList] = useState<{ id: string; name: string; color: string }[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [custRes, visitsRes] = await Promise.all([
        fetch(`/api/customers/${id}`),
        fetch(`/api/customers/${id}/visits`),
      ])
      if (!custRes.ok) throw new Error()
      const custData = await custRes.json()
      const visitsData = await visitsRes.json()
      setCustomer(custData.customer)
      setVisits(visitsData.visits || [])
    } catch {
      setCustomer(null)
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchMenus().then(setMenus)
    fetchStaffList().then(setStaffList).catch(() => [])
    fetchData()
  }, [fetchData])

  const handleSaveProfile = async (updates: Partial<Customer>) => {
    if (!customer) return
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCustomer(data.customer)
      setProfileEditOpen(false)
    } catch {
      alert('保存に失敗しました')
    }
  }

  const handleAddVisitSuccess = () => {
    setAddVisitOpen(false)
    fetchData()
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

  const daysSinceVisit = customer.last_visit_date
    ? Math.floor((Date.now() - new Date(customer.last_visit_date).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const formatDateJa = (dateStr: string) => {
    const d = new Date(dateStr)
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`
  }

  const allPhotos = visits.flatMap((v) => [
    ...(v.scope_image_before ? [{ url: v.scope_image_before, date: v.visit_date }] : []),
    ...(v.scope_image_after ? [{ url: v.scope_image_after, date: v.visit_date }] : []),
    ...(v.visit_images || []).map((url) => ({ url, date: v.visit_date })),
  ])

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-text-main font-serif-jp">カルテ</h1>
        </div>
        <button
          onClick={() => setProfileEditOpen(true)}
          className="px-3 py-1.5 rounded-lg border border-[#C4728A]/50 text-[#C4728A] text-sm font-medium hover:bg-rose/5"
        >
          編集
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-8">
        {/* ① プロフィールエリア（左 or 上部） */}
        <section className="bg-white rounded-2xl p-6 card-shadow overflow-hidden mb-6 lg:mb-0">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] -mx-6 -mt-6 mb-6" />
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-rose/20 to-lavender/20 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-rose/20">
              {customer.photo_url ? (
                <img src={customer.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-rose" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-text-main">{customer.name}</h2>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-text-sub">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  来店{customer.visit_count}回
                </span>
                <span>
                  最終来店: {customer.last_visit_date ? `${formatDateJa(customer.last_visit_date)}（${daysSinceVisit}日前）` : '—'}
                </span>
                {customer.assigned_staff && (
                  <span>担当: {customer.assigned_staff}</span>
                )}
                {customer.line_user_id ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 text-xs font-medium">
                    <MessageCircle className="w-3 h-3" /> LINE連携済
                  </span>
                ) : (
                  <span className="text-text-sub text-xs">LINE未連携</span>
                )}
              </div>
              {customer.phone && (
                <p className="mt-1 text-sm text-text-sub flex items-center gap-1">
                  <Phone className="w-4 h-4" /> {customer.phone}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* タブ（モバイル） */}
        <div className="lg:hidden flex gap-1 p-1 bg-[#F8F5FF] rounded-xl mb-4 overflow-x-auto">
          {[
            { key: 'info' as const, label: 'お客様情報', icon: Heart },
            { key: 'history' as const, label: '施術履歴', icon: FileText },
            { key: 'gallery' as const, label: '写真', icon: ImageIcon },
            { key: 'follow' as const, label: 'フォロー', icon: MessageCircle },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                activeTab === key ? 'bg-white shadow text-rose' : 'text-text-sub'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* 右カラム（PC）or タブコンテンツ（モバイル） */}
        <div className="space-y-6">
          {/* ② お客様情報 */}
          <section className={`bg-white rounded-2xl p-6 card-shadow overflow-hidden ${activeTab === 'info' ? 'block' : 'hidden lg:block'}`}>
            <div>
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
              <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose" />
                お客様情報
              </h3>
              <CustomerInfoForm key={`info-${customer.id}`} customer={customer} onSave={handleSaveProfile} />
            </div>
          </section>

          {/* ③ 施術履歴 */}
          <section className={`bg-white rounded-2xl p-6 card-shadow overflow-hidden ${activeTab === 'history' ? 'block' : 'hidden lg:block'}`}>
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose" />
                施術履歴
              </h3>
              <button
                onClick={() => setAddVisitOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> 施術を記録する
              </button>
            </div>
            {visits.length === 0 ? (
              <p className="text-text-sub text-sm py-8 text-center">施術履歴がありません</p>
            ) : (
              <div className="space-y-4">
                {visits.map((v) => (
                  <div key={v.id} className="p-4 rounded-xl bg-[#F8F5FF] border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-text-main">{formatDateJa(v.visit_date)}</span>
                      {v.staff_name && <span className="text-xs text-text-sub">担当: {v.staff_name}</span>}
                    </div>
                    {v.menu && <p className="text-sm text-text-sub">メニュー: {v.menu}</p>}
                    {v.products_used && <p className="text-xs text-text-sub mt-1">使用製品: {v.products_used}</p>}
                    {v.treatment_note && (
                      <p className="text-sm text-text-main mt-2 p-3 rounded-lg bg-[#F8F5FF] border border-gray-100">
                        {v.treatment_note}
                      </p>
                    )}
                    {(v.scope_image_before || v.scope_image_after || (v.visit_images && v.visit_images.length > 0)) && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[v.scope_image_before, v.scope_image_after, ...(v.visit_images || [])].filter(Boolean).map((url, i) => (
                          <button key={i} onClick={() => setLightboxImage(url!)} className="shrink-0">
                            <ChartImage src={url!} alt="" className="w-16 h-16 object-cover rounded-lg hover:opacity-90" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ④ 結果写真ギャラリー */}
          <section className={`bg-white rounded-2xl p-6 card-shadow overflow-hidden ${activeTab === 'gallery' ? 'block' : 'hidden lg:block'}`}>
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-rose" />
              結果写真ギャラリー
            </h3>
            <p className="text-xs text-text-sub mb-2">写真はお使いのPC（ブラウザ）に保存されます</p>
            {allPhotos.length === 0 ? (
              <p className="text-text-sub text-sm py-8 text-center">写真がありません</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {allPhotos.map(({ url }, i) => (
                  <button key={url + String(i)} onClick={() => setLightboxImage(url)} className="aspect-square overflow-hidden rounded-lg">
                    <ChartImage src={url} alt="" className="w-full h-full object-cover hover:opacity-90" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ⑤ フォロー履歴 */}
          <section className={`bg-white rounded-2xl p-6 card-shadow overflow-hidden ${activeTab === 'follow' ? 'block' : 'hidden lg:block'}`}>
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-rose" />
              フォロー履歴
            </h3>
            <p className="text-text-sub text-sm">LINE自動送信の履歴は準備中です</p>
          </section>
        </div>
      </div>

      {/* ライトボックス */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <ChartImage src={lightboxImage} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {profileEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">お客様情報を編集</h3>
              <button onClick={() => setProfileEditOpen(false)} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <CustomerInfoForm key={`edit-${customer.id}`} customer={customer} onSave={handleSaveProfile} />
            <button
              onClick={() => setProfileEditOpen(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
      {addVisitOpen && (
        <AddVisitModal
          customerId={id}
          menus={menus}
          staffList={staffList}
          onClose={() => setAddVisitOpen(false)}
          onSuccess={handleAddVisitSuccess}
        />
      )}
    </div>
  )
}

function CustomerInfoForm({ customer, onSave }: { customer: Customer; onSave: (u: Partial<Customer>) => void }) {
  const parsed = (customer.concerns || '').split(',').map((s) => s.trim()).filter(Boolean)
  const [concerns, setConcerns] = useState<string[]>(() => parsed.filter((p) => CONCERN_OPTIONS.includes(p)))
  const [concernsFree, setConcernsFree] = useState(() => parsed.filter((p) => !CONCERN_OPTIONS.includes(p)).join(', '))
  const [goals, setGoals] = useState(customer.goals || '')
  const [allergies, setAllergies] = useState(customer.allergies || '')
  const [preferredMenu, setPreferredMenu] = useState(customer.preferred_menu || '')
  const [intensity, setIntensity] = useState(customer.treatment_intensity || 'normal')
  const [memo, setMemo] = useState(customer.memo || '')

  const saveConcerns = (opts: string[], free: string) => {
    onSave({ concerns: [...opts, free].filter(Boolean).join(', ') })
  }
  const toggleConcern = (opt: string) => {
    const next = concerns.includes(opt) ? concerns.filter((c) => c !== opt) : [...concerns, opt]
    setConcerns(next)
    saveConcerns(next, concernsFree)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-sub block mb-2">お悩み</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {CONCERN_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={concerns.includes(opt)}
                onChange={() => toggleConcern(opt)}
                className="rounded border-gray-300 text-rose"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
        <input
          type="text"
          value={concernsFree}
          onChange={(e) => setConcernsFree(e.target.value)}
          onBlur={() => saveConcerns(concerns, concernsFree)}
          placeholder="その他（フリーテキスト）"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-[#F8F5FF] text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-text-sub block mb-1">願望・ゴール</label>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          onBlur={() => onSave({ goals })}
          placeholder="例：3ヶ月後に毛穴レスな肌になりたい"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-[#F8F5FF] text-sm min-h-[80px]"
          rows={3}
        />
      </div>
      <div>
        <label className="text-xs text-text-sub block mb-1">アレルギー・注意事項</label>
        <textarea
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          onBlur={() => onSave({ allergies })}
          placeholder="アレルギーや注意事項を入力"
          className="w-full px-3 py-2 rounded-lg border-2 border-red-200 bg-red-50/50 text-sm min-h-[80px] focus:border-red-400"
          rows={3}
        />
      </div>
      <div>
        <label className="text-xs text-text-sub block mb-1">好みのメニュー</label>
        <input
          type="text"
          value={preferredMenu}
          onChange={(e) => setPreferredMenu(e.target.value)}
          onBlur={() => onSave({ preferred_menu: preferredMenu })}
          placeholder="例：フェイシャル60分"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-text-sub block mb-2">施術強度の好み</label>
        <div className="flex gap-4">
          {INTENSITY_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="intensity"
                checked={intensity === value}
                onChange={() => {
                  setIntensity(value)
                  onSave({ treatment_intensity: value })
                }}
                className="text-rose"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-text-sub block mb-1">備考</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => onSave({ memo })}
          placeholder="スタッフメモ"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-[#F8F5FF] text-sm min-h-[60px]"
          rows={2}
        />
      </div>
    </div>
  )
}

function AddVisitModal({
  customerId,
  menus,
  staffList,
  onClose,
  onSuccess,
}: {
  customerId: string
  menus: { id: string; name: string }[]
  staffList: { id: string; name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    visit_date: today,
    menu: menus[0]?.name || '',
    staff_name: staffList[0]?.name || '',
    amount: 0,
    treatment_note: '',
    products_used: '',
  })
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/customers/${customerId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const { visit } = await res.json()
      const visitId = visit.id

      if (photoFiles.length > 0) {
        const { saveImage, createImageKey } = await import('@/lib/chart-images')
        const keys: string[] = []
        for (let i = 0; i < photoFiles.length; i++) {
          const key = createImageKey(customerId, visitId, i)
          await saveImage(key, photoFiles[i])
          keys.push(key)
        }
        await fetch(`/api/customers/${customerId}/visits/${visitId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visit_images: keys }),
        })
      }
      onSuccess()
    } catch {
      alert('登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-main">施術を登録</h3>
          <button onClick={onClose} className="p-2 text-text-sub">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-sub block mb-1">来店日</label>
            <input
              type="date"
              value={form.visit_date}
              onChange={(e) => setForm((p) => ({ ...p, visit_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">メニュー</label>
            <select
              value={form.menu}
              onChange={(e) => setForm((p) => ({ ...p, menu: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">担当</label>
            <select
              value={form.staff_name}
              onChange={(e) => setForm((p) => ({ ...p, staff_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">施術メモ</label>
            <textarea
              value={form.treatment_note}
              onChange={(e) => setForm((p) => ({ ...p, treatment_note: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">使用製品</label>
            <input
              type="text"
              value={form.products_used}
              onChange={(e) => setForm((p) => ({ ...p, products_used: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
              placeholder="製品名を入力"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">施術写真（PCに保存）</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              className="w-full px-3 py-2 rounded-lg border text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-rose/10 file:text-rose file:text-sm"
            />
            {photoFiles.length > 0 && (
              <p className="text-xs text-text-sub mt-1">{photoFiles.length}枚選択済み（ローカル保存）</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border" disabled={saving}>
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
          >
            {saving ? '登録中...' : '登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
