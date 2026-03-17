'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  User,
  Phone,
  X,
  Loader2,
  Ticket,
  Minus,
  Repeat,
  Edit2,
  Receipt,
  MapPin,
  Calendar,
  Mail,
  FileText,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react'
import {
  fetchCustomerTickets,
  fetchTicketPlans,
  addCustomerTicket,
  consumeTicket,
  isTicketExpired,
  daysUntilTicketExpiry,
  type CustomerTicket,
  type TicketPlan,
} from '@/lib/tickets'
import { getCategories, DEFAULT_CATEGORIES } from '@/lib/menus'
import {
  fetchCustomerSubscriptions,
  fetchSubscriptionPlans,
  addCustomerSubscription,
  useSubscriptionSession,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
  daysUntilNextBilling,
  type CustomerSubscription,
} from '@/lib/subscriptions'

interface Customer {
  id: string
  name: string
  name_kana?: string
  phone?: string
  email?: string
  address?: string
  birthday?: string
  gender?: 'female' | 'male' | 'other' | 'unknown'
  first_visit_date?: string
  last_visit_date?: string
  visit_count: number
  total_spent?: number
  avg_unit_price?: number
  status?: 'active' | 'lost' | 'vip' | 'temporary' | 'at_risk' | 'dormant'
  memo?: string
  line_user_id?: string
  line_status?: string
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'アクティブ' },
  { value: 'vip', label: 'VIP' },
  { value: 'at_risk', label: '失客予備軍' },
  { value: 'dormant', label: '休眠客' },
  { value: 'lost', label: '失客' },
  { value: 'temporary', label: '仮登録' },
]

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: 'アクティブ', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    lost: { label: '失客', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
    vip: { label: 'VIP', color: 'bg-amber-500/20 text-[#0891B2] border-amber-500/30' },
    temporary: { label: '仮登録', color: 'bg-sky-500/20 text-sky-600 border-sky-500/30' },
    at_risk: { label: '失客予備軍', color: 'bg-orange-500/20 text-orange-600 border-orange-500/30' },
    dormant: { label: '休眠客', color: 'bg-purple-500/20 text-purple-600 border-purple-500/30' },
  }
  if (!status || !map[status]) return null
  const { label, color } = map[status]
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  )
}

interface VisitRecord {
  id: string
  visit_date: string
  menu?: string
  staff_name?: string
  amount?: number
}

export default function CustomerDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [subs, setSubs] = useState<CustomerSubscription[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [packs, setPacks] = useState<TicketPlan[]>([])
  const [subPlans, setSubPlans] = useState<Awaited<ReturnType<typeof fetchSubscriptionPlans>>>([])
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [selectedPack, setSelectedPack] = useState<TicketPlan | null>(null)
  const [consumeTarget, setConsumeTarget] = useState<CustomerTicket | null>(null)
  const [subPurchaseOpen, setSubPurchaseOpen] = useState(false)
  const [selectedSubPlan, setSelectedSubPlan] = useState<Awaited<ReturnType<typeof fetchSubscriptionPlans>>[0] | null>(null)
  const [subUseTarget, setSubUseTarget] = useState<CustomerSubscription | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [ticketModalCategory, setTicketModalCategory] = useState('')
  const [subModalCategory, setSubModalCategory] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'cash' | 'card' | 'online' | 'loan'>('card')
  const [subJoinDate, setSubJoinDate] = useState(new Date().toISOString().slice(0, 10))
  const [subPaymentMethod, setSubPaymentMethod] = useState<'cash' | 'card' | 'online' | 'loan'>('card')
  const [unmatchedUsers, setUnmatchedUsers] = useState<{ line_user_id: string; followed_at: string }[]>([])
  const [linkingLine, setLinkingLine] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // 既存コース登録
  const [existingCourseOpen, setExistingCourseOpen] = useState(false)
  const [existingCourseName, setExistingCourseName] = useState('')
  const [existingCourseCount, setExistingCourseCount] = useState(5)
  const [existingCourseExpiry, setExistingCourseExpiry] = useState('')
  const [existingCourseSaving, setExistingCourseSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Customer>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [visitsExpanded, setVisitsExpanded] = useState(false)
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitEditing, setVisitEditing] = useState<VisitRecord | null>(null)
  const [visitForm, setVisitForm] = useState({ visit_date: '', menu: '', staff_name: '', amount: '' })
  const [visitSaving, setVisitSaving] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchCustomer = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/customers/${id}`)
    const data = await res.json()
    setCustomer(data.customer ?? null)
  }, [id])

  const openEdit = () => {
    if (!customer) return
    setEditForm({
      name: customer.name,
      name_kana: customer.name_kana || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      birthday: customer.birthday || '',
      first_visit_date: customer.first_visit_date || '',
      visit_count: customer.visit_count,
      status: customer.status || 'active',
      memo: customer.memo || '',
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!customer) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        await fetchCustomer()
        setEditOpen(false)
        showToast('更新しました')
      }
    } catch {
      showToast('更新に失敗しました')
    } finally {
      setEditSaving(false)
    }
  }

  const fetchVisits = useCallback(async () => {
    if (!id) return
    setVisitsLoading(true)
    try {
      const res = await fetch(`/api/customers/${id}/visits`)
      const data = await res.json()
      setVisits(data.visits || [])
    } catch {
      setVisits([])
    } finally {
      setVisitsLoading(false)
    }
  }, [id])

  const openVisitAdd = () => {
    setVisitEditing(null)
    setVisitForm({ visit_date: new Date().toISOString().slice(0, 10), menu: '', staff_name: '', amount: '' })
    setVisitModalOpen(true)
  }

  const openVisitEdit = (v: VisitRecord) => {
    setVisitEditing(v)
    setVisitForm({
      visit_date: v.visit_date || '',
      menu: v.menu || '',
      staff_name: v.staff_name || '',
      amount: v.amount != null ? String(v.amount) : '',
    })
    setVisitModalOpen(true)
  }

  const handleVisitSave = async () => {
    if (!id) return
    setVisitSaving(true)
    try {
      const payload: Record<string, unknown> = {
        visit_date: visitForm.visit_date,
        menu: visitForm.menu,
        staff_name: visitForm.staff_name,
        amount: visitForm.amount ? Number(visitForm.amount) : null,
      }
      if (visitEditing) {
        payload.visitId = visitEditing.id
        await fetch(`/api/customers/${id}/visits`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch(`/api/customers/${id}/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      await fetchVisits()
      await fetchCustomer()
      setVisitModalOpen(false)
      showToast(visitEditing ? '来店履歴を更新しました' : '来店履歴を追加しました')
    } catch {
      showToast('保存に失敗しました')
    } finally {
      setVisitSaving(false)
    }
  }

  const handleVisitDelete = async (visitId: string) => {
    if (!confirm('この来店履歴を削除しますか？')) return
    try {
      await fetch(`/api/customers/${id}/visits?visitId=${visitId}`, { method: 'DELETE' })
      await fetchVisits()
      await fetchCustomer()
      showToast('来店履歴を削除しました')
    } catch {
      showToast('削除に失敗しました')
    }
  }

  const fetchUnmatchedUsers = async () => {
    const res = await fetch('/api/line/unmatched')
    const json = await res.json()
    setUnmatchedUsers(json.users || [])
  }

  const handleLinkLine = async (lineUserId: string) => {
    if (!customer) return
    setLinkingLine(true)
    try {
      await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId, line_status: 'followed' })
      })
      await fetch('/api/line/unmatched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: lineUserId })
      })
      showToast('LINE連携しました✨')
      fetchCustomer()
    } catch {
      showToast('失敗しました')
    } finally { setLinkingLine(false) }
  }

  const refresh = useCallback(async () => {
    if (!id) return
    setTicketsLoading(true)
    try {
      const [ticketsResult, packsResult, subsResult, plansResult] = await Promise.allSettled([
        fetchCustomerTickets(id),
        fetchTicketPlans(),
        fetchCustomerSubscriptions(id),
        fetchSubscriptionPlans(),
      ])
      setTickets(ticketsResult.status === 'fulfilled' ? ticketsResult.value : [])
      setPacks(packsResult.status === 'fulfilled' ? packsResult.value : [])
      setSubs(subsResult.status === 'fulfilled' ? subsResult.value.map(s => ensureBillingPeriodCurrent(s)) : [])
      setSubPlans(plansResult.status === 'fulfilled' ? plansResult.value : [])
      if (ticketsResult.status === 'rejected') console.error('fetchCustomerTickets:', ticketsResult.reason)
      if (packsResult.status === 'rejected') console.error('fetchTicketPlans:', packsResult.reason)
      if (subsResult.status === 'rejected') console.error('fetchCustomerSubscriptions:', subsResult.reason)
      if (plansResult.status === 'rejected') console.error('fetchSubscriptionPlans:', plansResult.reason)
    } finally {
      setTicketsLoading(false)
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/customers/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setCustomer(data.customer ?? null)
      })
      .catch(() => { if (!cancelled) setCustomer(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (customer) {
      refresh()
      fetchVisits()
    }
  }, [customer, refresh, fetchVisits])

  useEffect(() => {
    if (purchaseOpen) {
      setPurchaseDate(new Date().toISOString().slice(0, 10))
    }
  }, [purchaseOpen])

  useEffect(() => {
    if (subPurchaseOpen) {
      setSubJoinDate(new Date().toISOString().slice(0, 10))
    }
  }, [subPurchaseOpen])

  const ticketCategories = getCategories()
  const categoriesForTicket = ticketCategories.length ? ticketCategories : DEFAULT_CATEGORIES
  const categoriesForSub = ticketCategories.length ? ticketCategories : DEFAULT_CATEGORIES
  const filteredPacksForModal = ticketModalCategory
    ? packs.filter(p => (p.category || '') === ticketModalCategory)
    : packs
  const filteredSubPlansForModal = subModalCategory
    ? subPlans.filter(p => (p.category || '') === subModalCategory)
    : subPlans

  const handlePurchase = async () => {
    if (!selectedPack || !customer) return
    setActionLoading(true)
    try {
      await addCustomerTicket(customer.id, customer.name, selectedPack, {
        purchasedAt: purchaseDate,
        paymentMethod: purchasePaymentMethod,
      })
      await refresh()
      setPurchaseOpen(false)
      setSelectedPack(null)
    } catch {
      alert('登録に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConsume = async (c: CustomerTicket) => {
    setActionLoading(true)
    try {
      const ok = await consumeTicket(c.id)
      if (ok) await refresh()
      setConsumeTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubJoin = async () => {
    if (!selectedSubPlan || !customer) return
    setActionLoading(true)
    try {
      await addCustomerSubscription(customer.id, customer.name, selectedSubPlan, {
        startedAt: subJoinDate,
        paymentMethod: subPaymentMethod,
      })
      await refresh()
      setSubPurchaseOpen(false)
      setSelectedSubPlan(null)
    } catch {
      alert('登録に失敗しました')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubUse = async (s: CustomerSubscription) => {
    setActionLoading(true)
    try {
      const ok = await useSubscriptionSession(s.id)
      if (ok) await refresh()
      setSubUseTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleExistingCourse = async () => {
    if (!customer || !existingCourseName.trim() || existingCourseCount <= 0) return
    setExistingCourseSaving(true)
    try {
      const res = await fetch('/api/customer-tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          plan_name: existingCourseName.trim(),
          remaining_count: existingCourseCount,
          expiry_date: existingCourseExpiry || null,
          is_existing: true,
        }),
      })
      if (res.ok) {
        await refresh()
        setExistingCourseOpen(false)
        setExistingCourseName('')
        setExistingCourseCount(5)
        setExistingCourseExpiry('')
        showToast('既存コースを登録しました')
      } else {
        alert('登録に失敗しました')
      }
    } catch {
      alert('登録に失敗しました')
    } finally {
      setExistingCourseSaving(false)
    }
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

  return (
    <div className="max-w-lg mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <Link href="/customers" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={openEdit}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-text-main text-sm font-medium hover:bg-gray-50 flex items-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" /> 編集
          </button>
          <Link
            href={`/contracts/new?customer_id=${customer.id}`}
            className="px-3 py-1.5 rounded-lg border border-rose text-rose text-sm font-medium hover:bg-rose/5 flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" /> 契約書作成
          </Link>
          <Link
            href={`/karute?customer_id=${customer.id}`}
            className="px-3 py-1.5 rounded-lg bg-rose text-white text-sm font-medium hover:opacity-90"
          >
            カルテを見る
          </Link>
        </div>
      </div>

      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-rose/20 to-lavender/20 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-rose" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#1A202C]">{customer.name} 様</h1>
              <StatusBadge status={customer.status} />
            </div>
            {customer.name_kana && (
              <p className="text-xs text-[#4A5568] mt-0.5">{customer.name_kana}</p>
            )}
            {customer.phone && (
              <p className="text-sm text-[#4A5568] flex items-center gap-1 mt-0.5">
                <Phone className="w-4 h-4" /> {customer.phone}
              </p>
            )}
            {customer.email && (
              <p className="text-sm text-[#4A5568] flex items-center gap-1 mt-0.5">
                <Mail className="w-4 h-4" /> {customer.email}
              </p>
            )}
            {customer.address && (
              <p className="text-sm text-[#4A5568] flex items-center gap-1 mt-0.5">
                <MapPin className="w-4 h-4" /> {customer.address}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[#4A5568]">来店回数</p>
            <p className="font-bold text-[#1A202C]">{customer.visit_count}回</p>
          </div>
          <div>
            <p className="text-xs text-[#4A5568]">客単価</p>
            <p className="font-bold text-[#1A202C]">
              ¥{(customer.avg_unit_price ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#4A5568]">累計売上</p>
            <p className="font-bold text-[#1A202C]">
              ¥{(customer.total_spent ?? 0).toLocaleString()}
            </p>
          </div>
          {customer.birthday && (
            <div>
              <p className="text-xs text-[#4A5568]">生年月日</p>
              <p className="font-bold text-[#1A202C]">{customer.birthday}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-[#4A5568]">初回来店日</p>
            <p className="font-bold text-[#1A202C]">{customer.first_visit_date || '—'}</p>
          </div>
          {customer.last_visit_date && (
            <div>
              <p className="text-xs text-[#4A5568]">最終来店日</p>
              <p className="font-bold text-[#1A202C]">{customer.last_visit_date}</p>
            </div>
          )}
          {customer.memo && (
            <div className="col-span-2">
              <p className="text-xs text-[#4A5568]">メモ</p>
              <p className="text-sm text-[#1A202C] whitespace-pre-wrap">{customer.memo}</p>
            </div>
          )}
        </div>
      </div>

      {/* 保有コース */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-main flex items-center gap-2">
            <Ticket className="w-4 h-4 text-rose" />
            保有回数券
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExistingCourseOpen(true)}
              className="text-xs font-semibold text-[#0891B2] hover:underline"
            >
              + 既存コース
            </button>
            <button
              onClick={() => setPurchaseOpen(true)}
              className="text-xs font-semibold text-rose hover:underline"
            >
              + 購入
            </button>
          </div>
        </div>
        {ticketsLoading ? (
          <p className="text-sm text-text-sub py-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-[#4A5568] py-2">保有回数券はありません</p>
        ) : (
          <div className="space-y-2">
            {tickets.map(c => {
              const expired = isTicketExpired(c)
              const days = daysUntilTicketExpiry(c)
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    expired ? 'bg-red-500/10' : 'bg-[#F8F5FF] border border-[#BAE6FD]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A202C]">{c.planName}</p>
                    <p className="text-xs text-[#4A5568]">
                      残り{c.remainingSessions}/{c.totalSessions}回 · 期限{c.expiryDate ?? '—'}
                      {!expired && c.remainingSessions > 0 && ` (残${days}日)`}
                    </p>
                  </div>
                  {c.remainingSessions > 0 && !expired && (
                    <button
                      onClick={() => setConsumeTarget(c)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded disabled:opacity-50"
                    >
                      <Minus className="w-3 h-3" />消化
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* サブスク */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-main flex items-center gap-2">
            <Repeat className="w-4 h-4 text-rose" />
            サブスク
          </h2>
          <button
            onClick={() => setSubPurchaseOpen(true)}
            className="text-xs font-semibold text-rose hover:underline"
          >
            + 加入
          </button>
        </div>
        {ticketsLoading ? (
          <p className="text-sm text-text-sub py-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-[#4A5568] py-2">サブスク加入はありません</p>
        ) : (
          <div className="space-y-2">
            {subs.map(s => {
              const remaining = getRemainingSessions(s)
              const days = daysUntilNextBilling(s)
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F8F5FF] border border-[#BAE6FD]"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A202C]">{s.planName}</p>
                    <p className="text-xs text-[#4A5568]">
                      今月残り{remaining}/{s.sessionsPerMonth}回 · 次回課金{s.nextBillingDate}（残{days}日）
                    </p>
                  </div>
                  {remaining > 0 && (
                    <button
                      onClick={() => setSubUseTarget(s)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose hover:bg-rose/10 rounded disabled:opacity-50"
                    >
                      <Minus className="w-3 h-3" />利用
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* LINE連携 */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <h3 className="font-bold text-text-main mb-3 flex items-center gap-2">
          <span className="text-green-500">💬</span> LINE連携
        </h3>
        {customer.line_user_id ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
            <span className="text-green-500 text-lg">✅</span>
            <div>
              <p className="text-sm font-bold text-green-700">LINE連携済み</p>
              <p className="text-xs text-text-sub">{customer.line_status === 'blocked' ? 'ブロック中' : 'フォロー中'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-text-sub">友達追加済みのお客様と紐付けてください</p>
            <button onClick={fetchUnmatchedUsers}
              className="w-full py-2 rounded-xl border border-dashed border-green-300 text-green-600 text-sm font-bold">
              友達追加リストを取得
            </button>
            {unmatchedUsers.length > 0 && (
              <div className="space-y-2">
                {unmatchedUsers.map(u => (
                  <div key={u.line_user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-xs font-medium text-text-main">{u.line_user_id.slice(0, 20)}...</p>
                      <p className="text-xs text-text-sub">{new Date(u.followed_at).toLocaleDateString('ja-JP')} 追加</p>
                    </div>
                    <button onClick={() => handleLinkLine(u.line_user_id)} disabled={linkingLine}
                      className="px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold">
                      紐付け
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 来店・売上履歴 */}
      <div className="bg-white rounded-2xl p-5 card-shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-main flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose" />
            来店・売上履歴
          </h2>
          <button
            onClick={openVisitAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose text-white text-xs font-bold hover:opacity-90 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            追加
          </button>
        </div>
        {visitsLoading ? (
          <p className="text-sm text-text-sub py-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </p>
        ) : visits.length === 0 ? (
          <p className="text-sm text-[#4A5568] py-2">来店履歴はありません</p>
        ) : (
          <>
            <div className="space-y-2">
              {(visitsExpanded ? visits : visits.slice(0, 10)).map(v => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#F8F5FF] border border-[#BAE6FD]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A202C]">{v.menu || '—'}</p>
                    <p className="text-xs text-[#4A5568]">
                      {v.visit_date}{v.staff_name ? ` · ${v.staff_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {v.amount != null && (
                      <p className="text-sm font-bold text-[#1A202C]">¥{v.amount.toLocaleString()}</p>
                    )}
                    <button onClick={() => openVisitEdit(v)} className="p-1 text-[#4A5568] hover:text-rose transition" title="編集">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleVisitDelete(v.id)} className="p-1 text-[#4A5568] hover:text-red-500 transition" title="削除">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {visits.length > 10 && !visitsExpanded && (
              <button
                onClick={() => setVisitsExpanded(true)}
                className="w-full mt-3 py-2 text-sm text-rose font-medium hover:underline"
              >
                もっと見る（残り{visits.length - 10}件）
              </button>
            )}
          </>
        )}
      </div>

      {/* 来店履歴 追加/編集モーダル */}
      {visitModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{visitEditing ? '来店履歴を編集' : '来店履歴を追加'}</h3>
              <button onClick={() => setVisitModalOpen(false)} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">来店日 *</label>
                <input
                  type="date"
                  value={visitForm.visit_date}
                  onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))}
                  className="w-full border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">メニュー</label>
                <input
                  type="text"
                  value={visitForm.menu}
                  onChange={e => setVisitForm(f => ({ ...f, menu: e.target.value }))}
                  placeholder="例: カット、カラー"
                  className="w-full border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">担当スタッフ</label>
                <input
                  type="text"
                  value={visitForm.staff_name}
                  onChange={e => setVisitForm(f => ({ ...f, staff_name: e.target.value }))}
                  placeholder="例: 山田"
                  className="w-full border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">金額</label>
                <input
                  type="number"
                  value={visitForm.amount}
                  onChange={e => setVisitForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="例: 8000"
                  className="w-full border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setVisitModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-medium text-[#4A5568]"
              >
                キャンセル
              </button>
              <button
                onClick={handleVisitSave}
                disabled={visitSaving || !visitForm.visit_date}
                className="flex-1 py-2 rounded-xl bg-rose text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {visitSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {visitEditing ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">顧客情報を編集</h3>
              <button onClick={() => setEditOpen(false)} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">ステータス</label>
                <select
                  value={editForm.status || 'active'}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Customer['status'] }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">名前</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">カナ</label>
                <input
                  type="text"
                  value={editForm.name_kana || ''}
                  onChange={e => setEditForm(f => ({ ...f, name_kana: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">電話番号</label>
                <input
                  type="tel"
                  value={editForm.phone || ''}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">メール</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">住所</label>
                <input
                  type="text"
                  value={editForm.address || ''}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">生年月日</label>
                <input
                  type="date"
                  value={editForm.birthday || ''}
                  onChange={e => setEditForm(f => ({ ...f, birthday: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">初回来店日</label>
                <input
                  type="date"
                  value={editForm.first_visit_date || ''}
                  onChange={e => setEditForm(f => ({ ...f, first_visit_date: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">来店回数</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.visit_count ?? 0}
                  onChange={e => setEditForm(f => ({ ...f, visit_count: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">メモ</label>
                <textarea
                  value={editForm.memo || ''}
                  onChange={e => setEditForm(f => ({ ...f, memo: e.target.value }))}
                  rows={3}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex-1 py-2 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
              >
                {editSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* コース購入モーダル */}
      {purchaseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">コースを選択</h3>
              <button onClick={() => { setPurchaseOpen(false); setSelectedPack(null) }} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setTicketModalCategory('')}
                className={`px-2 py-1 rounded-lg text-xs font-medium ${!ticketModalCategory ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
              >
                全て
              </button>
              {categoriesForTicket.map(cat => (
                <button
                  key={cat}
                  onClick={() => setTicketModalCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${ticketModalCategory === cat ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {filteredPacksForModal.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPack(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedPack?.id === p.id ? 'border-rose bg-rose/5' : 'border-gray-200'
                  }`}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[#4A5568]">
                    ¥{p.price.toLocaleString()} · {p.totalSessions}回
                    {p.expiryDays ? ` · 有効${p.expiryDays}日` : ''}
                  </p>
                </button>
              ))}
            </div>
            {selectedPack && (
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-[#F8F5FF] border border-[#BAE6FD]">
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">購入日</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">支払方法</label>
                  <select
                    value={purchasePaymentMethod}
                    onChange={e => setPurchasePaymentMethod(e.target.value as 'cash' | 'card' | 'online' | 'loan')}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="cash">現金</option>
                    <option value="card">カード</option>
                    <option value="online">オンライン</option>
                    <option value="loan">ローン</option>
                  </select>
                </div>
                <p className="text-xs text-[#4A5568]">💡 購入日を今日にすると本日の売上に計上されます</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setPurchaseOpen(false); setSelectedPack(null) }}
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handlePurchase}
                disabled={!selectedPack || actionLoading}
                className="flex-1 py-2 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '登録中...' : '購入登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブスク加入モーダル */}
      {subPurchaseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">プランを選択</h3>
              <button onClick={() => { setSubPurchaseOpen(false); setSelectedSubPlan(null) }} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setSubModalCategory('')}
                className={`px-2 py-1 rounded-lg text-xs font-medium ${!subModalCategory ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
              >
                全て
              </button>
              {categoriesForSub.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSubModalCategory(cat)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium ${subModalCategory === cat ? 'bg-rose text-white' : 'bg-gray-100 text-text-sub'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {filteredSubPlansForModal.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSubPlan(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedSubPlan?.id === p.id ? 'border-rose bg-rose/5' : 'border-gray-200'
                  }`}
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-[#4A5568]">
                    ¥{p.price.toLocaleString()}/月 · {p.menuName} {p.sessionsPerMonth}回
                  </p>
                </button>
              ))}
            </div>
            {selectedSubPlan && (
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-[#F8F5FF] border border-[#BAE6FD]">
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">加入日</label>
                  <input
                    type="date"
                    value={subJoinDate}
                    onChange={e => setSubJoinDate(e.target.value)}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#4A5568] mb-1 block">支払方法</label>
                  <select
                    value={subPaymentMethod}
                    onChange={e => setSubPaymentMethod(e.target.value as 'cash' | 'card' | 'online' | 'loan')}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="cash">現金</option>
                    <option value="card">カード</option>
                    <option value="online">オンライン</option>
                    <option value="loan">ローン</option>
                  </select>
                </div>
                <p className="text-xs text-[#4A5568]">💡 加入日を今日にすると本日の売上に計上されます</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setSubPurchaseOpen(false); setSelectedSubPlan(null) }}
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubJoin}
                disabled={!selectedSubPlan || actionLoading}
                className="flex-1 py-2 rounded-xl bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '登録中...' : '加入登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 回数券消化確認 */}
      {consumeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full">
            <p className="text-sm mb-4">{consumeTarget.planName} を1回消化しますか？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConsumeTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg border"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleConsume(consumeTarget)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '処理中...' : '消化する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] px-6 py-4 rounded-2xl shadow-lg bg-emerald-600 text-white font-medium">
          {toast}
        </div>
      )}

      {/* 既存コース登録モーダル */}
      {existingCourseOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">既存コースを登録</h3>
              <button onClick={() => setExistingCourseOpen(false)} className="p-2 text-text-sub">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-text-sub mb-3">他サロンや以前のコースを登録できます（売上計上なし）</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">コース名 *</label>
                <input
                  type="text"
                  value={existingCourseName}
                  onChange={e => setExistingCourseName(e.target.value)}
                  placeholder="例: 全身脱毛コース"
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">残り回数 *</label>
                <input
                  type="number"
                  min={1}
                  value={existingCourseCount}
                  onChange={e => setExistingCourseCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">有効期限（任意）</label>
                <input
                  type="date"
                  value={existingCourseExpiry}
                  onChange={e => setExistingCourseExpiry(e.target.value)}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setExistingCourseOpen(false)}
                className="flex-1 py-2 rounded-xl border"
              >
                キャンセル
              </button>
              <button
                onClick={handleExistingCourse}
                disabled={existingCourseSaving || !existingCourseName.trim() || existingCourseCount <= 0}
                className="flex-1 py-2 rounded-xl bg-[#0891B2] text-white font-medium disabled:opacity-50"
              >
                {existingCourseSaving ? '登録中...' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブスク利用確認 */}
      {subUseTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full">
            <p className="text-sm mb-4">{subUseTarget.planName} を1回利用しますか？</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSubUseTarget(null)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg border"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSubUse(subUseTarget)}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg bg-rose text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? '処理中...' : '利用する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
