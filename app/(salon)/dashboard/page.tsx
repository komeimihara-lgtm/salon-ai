'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Plus,
  ArrowRight,
  X,
  ShoppingCart,
  Receipt,
  Heart,
  Loader2,
  Bell,
  AlertTriangle,
} from 'lucide-react'
import type { Reservation } from '@/types'
import ReservationActionCard from '@/components/ReservationActionCard'
import { RescheduleModal, EditReservationModal } from '@/components/ReservationModals'
import ReservationFormModal from '@/components/ReservationFormModal'
import { useReservations } from '@/hooks/useReservations'
import { fetchTasks, addTask, toggleTask, deleteTask, type ManualTask } from '@/lib/dashboard-tasks'
import { getAchievementRate, getAchievementColor, getAchievementBgColor, getDailyTarget, getWorkingDaysInMonth } from '@/lib/goals'
import { todayJstString, jstNow, jstMonthRange } from '@/lib/jst-date'
import {
  fetchExpiringSoonTickets,
  fetchExpiredTickets,
} from '@/lib/tickets'

const TASKS_AUTO_BASE: { id: number; type: string; text: string; action: string }[] = []

const SLOT_WIDTH_PX = 56
const ROW_HEIGHT = 72

function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function getSlotCount(openTime: string, closeTime: string): number {
  const open = timeToMinutes(openTime)
  const close = timeToMinutes(closeTime)
  const span = close > open ? close - open : (24 * 60 - open) + close
  return Math.max(1, Math.floor(span / 15))
}

function timeToSlotIndex(time: string, openTime: string): number {
  const t = timeToMinutes(time)
  const o = timeToMinutes(openTime)
  return Math.max(0, Math.floor((t - o) / 15))
}

function slotIndexToTime(index: number, openTime: string): string {
  const [oh = 10, om = 0] = openTime.slice(0, 5).split(':').map(Number)
  const total = oh * 60 + om + index * 15
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function getDurationSlots(start: string, end: string): number {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  return Math.max(1, Math.floor((e - s) / 15))
}

function TimelineSchedule({
  today,
  beds,
  reservations,
  loading,
  openTime,
  closeTime,
  onSlotClick,
  onReservationClick,
}: {
  today: string
  beds: string[]
  reservations: Reservation[]
  loading: boolean
  openTime: string
  closeTime: string
  onSlotClick: (slot: { date: string; start: string; end: string; bed: string }) => void
  onReservationClick: (r: Reservation) => void
}) {
  const slotCount = getSlotCount(openTime, closeTime)
  const minWidth = slotCount * SLOT_WIDTH_PX
  const openMinutes = timeToMinutes(openTime)
  const closeMinutes = timeToMinutes(closeTime)
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const inRange = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  const nowSlotIndex = inRange ? timeToSlotIndex(`${Math.floor(currentMinutes / 60)}:${currentMinutes % 60}`, openTime) : -1

  const STATUS_COLORS: Record<string, string> = {
    confirmed: 'bg-blue-500',
    rescheduled: 'bg-blue-500',
    visited: 'bg-emerald-500',
    completed: 'bg-emerald-500',
    no_show: 'bg-red-500',
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden card-shadow overflow-x-auto overflow-y-hidden scroll-smooth">
      <div className="min-w-[max(100%,280px)]" style={{ minWidth }}>
        {/* ヘッダー行 */}
        <div className="flex border-b border-gray-200 bg-light-lav sticky top-0 z-20">
          <div className="w-16 shrink-0 p-2 text-xs font-dm-sans text-text-sub" />
          <div className="flex shrink-0" style={{ width: slotCount * SLOT_WIDTH_PX }}>
            {Array.from({ length: slotCount }, (_, i) => {
              const timeStr = slotIndexToTime(i, openTime)
              return (
                <div key={i} className="p-2 text-center text-xs font-dm-sans text-text-sub border-l border-gray-200 shrink-0" style={{ width: SLOT_WIDTH_PX }}>
                  {timeStr}
                </div>
              )
            })}
          </div>
        </div>

        {/* ベッド行 */}
        {beds.map((bed) => (
          <div key={bed} className="flex border-b border-gray-100">
            <div className="w-16 shrink-0 p-3 bg-deep/5 text-sm font-medium text-text-main flex items-center justify-center border-r border-gray-100">
              ベッド{bed}
            </div>
            <div className="relative shrink-0" style={{ width: slotCount * SLOT_WIDTH_PX, height: ROW_HEIGHT }}>
              {/* 現在時刻の赤線 */}
              {nowSlotIndex >= 0 && nowSlotIndex < slotCount && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-[15]"
                  style={{ left: nowSlotIndex * SLOT_WIDTH_PX }}
                />
              )}
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-rose animate-spin" />
                </div>
              ) : (
                <>
                  {/* 空き枠クリック */}
                  {Array.from({ length: slotCount }, (_, i) => {
                    const startTime = slotIndexToTime(i, openTime)
                    const endTime = slotIndexToTime(i + 1, openTime)
                    return (
                      <button
                        key={`${bed}-${i}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSlotClick({ date: today, start: startTime, end: endTime, bed })
                        }}
                        className="absolute top-0.5 bottom-0.5 hover:bg-rose/10 transition-colors cursor-pointer z-[5]"
                        style={{ left: i * SLOT_WIDTH_PX, width: SLOT_WIDTH_PX - 2 }}
                      />
                    )
                  })}
                  {/* 予約ブロック */}
                  {reservations
                    .filter(r => (!r.bed_id && bed === (beds[0] || 'A')) || r.bed_id === bed)
                    .filter(r => r.status === 'confirmed' || r.status === 'rescheduled' || r.status === 'visited' || r.status === 'no_show')
                    .map((r) => {
                      const colIdx = Math.max(0, timeToSlotIndex(r.start_time || openTime, openTime))
                      const durationSlots = r.duration_minutes
                        ? Math.max(1, Math.floor(r.duration_minutes / 15))
                        : getDurationSlots(r.start_time || openTime, r.end_time || openTime)
                      const width = Math.min(durationSlots * SLOT_WIDTH_PX - 4, (slotCount - colIdx) * SLOT_WIDTH_PX - 4)
                      const bg = STATUS_COLORS[r.status] || 'bg-blue-500'
                      return (
                        <div
                          key={r.id}
                          onClick={(e) => { e.stopPropagation(); onReservationClick(r) }}
                          className={`absolute rounded-lg px-2 py-1 text-white text-xs font-medium shadow-sm cursor-pointer hover:ring-2 hover:ring-white/80 z-10 ${bg}`}
                          style={{
                            left: colIdx * SLOT_WIDTH_PX + 2,
                            width,
                            minWidth: 48,
                            top: 4,
                            height: ROW_HEIGHT - 8,
                          }}
                        >
                          <p className="font-semibold truncate">{r.customer_name}様</p>
                          <p className="text-white/90 truncate">{r.menu || '-'}</p>
                          {r.staff_name && <p className="text-white/80 truncate text-[10px]">担当: {r.staff_name}</p>}
                        </div>
                      )
                    })}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type KpiItem = { label: string; value: string; sub: string; rate: number; diff: number; diffUp: boolean }

export default function DashboardPage() {
  const today = todayJstString()
  const [todayStaff, setTodayStaff] = useState<{ id: string; name: string; color: string; start_time: string; end_time: string }[]>([])

  useEffect(() => {
    fetch(`/api/shifts?date=${today}`)
      .then(r => r.json())
      .then(j => {
        const todayShifts = j.shifts || []
        setTodayStaff(todayShifts.map((s: { staff?: { id: string; name: string; color: string } | { id: string; name: string; color: string }[]; start_time: string; end_time: string }) => {
          const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff
          return {
            id: staff?.id ?? '',
            name: staff?.name ?? '',
            color: staff?.color ?? '#C4728A',
            start_time: s.start_time?.slice(0, 5) ?? '09:00',
            end_time: s.end_time?.slice(0, 5) ?? '18:00',
          }
        }))
      })
  }, [today])
  const {
    reservations: todayReservations,
    loading: reservationsLoading,
    refresh,
    handleVisit,
    handleNoShow,
    handleStatusChange,
  } = useReservations({ date: today })

  const [kpiData, setKpiData] = useState<KpiItem[]>([
    { label: '今月売上', value: '¥-', sub: '目標 ¥-', rate: 0, diff: 0, diffUp: true },
    { label: '来店数', value: '-名', sub: '目標 -名', rate: 0, diff: 0, diffUp: true },
    { label: '客単価', value: '¥-', sub: '目標 ¥-', rate: 0, diff: 0, diffUp: true },
    { label: '再来店率', value: '-%', sub: '目標 75%', rate: 0, diff: 0, diffUp: true },
  ])
  const [manualTasks, setManualTasksState] = useState<ManualTask[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [reservationDetailModal, setReservationDetailModal] = useState<Reservation | null>(null)
  const [courseAlerts, setCourseAlerts] = useState<{ id: string; type: string; text: string; action: string }[]>([])
  const [salesSummary, setSalesSummary] = useState<{ cashSales: number; consumeSales: number; serviceLiability: number } | null>(null)
  const [todaySales, setTodaySales] = useState(0)
  const [rescheduleTarget, setRescheduleTarget] = useState<Reservation | null>(null)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [detailModal, setDetailModal] = useState<'cash' | 'consume' | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; start: string; end: string; bed: string } | null>(null)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [beds, setBeds] = useState<string[]>(['A', 'B'])
  const [salonTargets, setSalonTargets] = useState({ sales: 0, visits: 0, avgPrice: 0 })
  const [businessHours, setBusinessHours] = useState({ openTime: '10:00', closeTime: '21:00' })
  const [panelAnnouncements, setPanelAnnouncements] = useState<{ id: string; title: string; type: string; body: string; is_read: boolean }[]>([])
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0)
  const [productExpiryAlerts, setProductExpiryAlerts] = useState<
    {
      id: string
      customer_name: string
      product_name: string
      sold_at: string
      expires_at: string
      days_left: number
      line_user_id: string | null
      is_notified: boolean
    }[]
  >([])
  const [productExpiryLoading, setProductExpiryLoading] = useState(true)
  const [expiryNotifySending, setExpiryNotifySending] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => {
        setBeds(j.beds || ['A', 'B'])
        if (j.targets) {
          setSalonTargets({
            sales: j.targets.sales || 0,
            visits: j.targets.visits || 0,
            avgPrice: j.targets.avgPrice || 0,
          })
        }
        if (j.business_hours) {
          setBusinessHours({
            openTime: j.business_hours.openTime || '10:00',
            closeTime: j.business_hours.closeTime || '21:00',
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/tickets/check-expiry', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then((d) => {
        const list = d.announcements || []
        setPanelAnnouncements(list.slice(0, 3))
        setAnnouncementsUnreadCount(typeof d.unread_count === 'number' ? d.unread_count : list.filter((a: { is_read: boolean }) => !a.is_read).length)
      })
      .catch(() => {})
  }, [])

  const loadProductExpiryAlerts = () => {
    setProductExpiryLoading(true)
    fetch('/api/products/expiry-alerts?include_notified=1')
      .then(r => r.json())
      .then((d) => setProductExpiryAlerts(Array.isArray(d.alerts) ? d.alerts : []))
      .catch(() => setProductExpiryAlerts([]))
      .finally(() => setProductExpiryLoading(false))
  }

  useEffect(() => {
    loadProductExpiryAlerts()
  }, [])

  useEffect(() => {
    fetchTasks().then(setManualTasksState).catch(() => {})
    Promise.all([fetchExpiringSoonTickets(14), fetchExpiredTickets()]).then(([expiring, expired]) => {
      const alerts: { id: string; type: string; text: string; action: string }[] = []
      if (expired.length > 0) {
        alerts.push({
          id: 'course-expired',
          type: 'alert',
          text: `${expired.length}件の回数券が期限切れ（残り回数あり）`,
          action: '確認する',
        })
      }
      if (expiring.length > 0 && alerts.length === 0) {
        alerts.push({
          id: 'course-expiring',
          type: 'alert',
          text: `${expiring.length}件の回数券が14日以内に期限`,
          action: '確認する',
        })
      }
      setCourseAlerts(alerts)
    })
  }, [])

  useEffect(() => {
    const { year, month } = jstNow()
    const { start, end } = jstMonthRange(year, month)
    const todayStr = todayJstString()
    Promise.all([
      fetch(`/api/kpi/sales?start=${start}&end=${end}`),
      fetch(`/api/kpi/summary?start=${start}&end=${end}`),
      fetch(`/api/kpi/sales?start=${todayStr}&end=${todayStr}`),
    ])
      .then(([salesRes, summaryRes, todayRes]) => Promise.all([salesRes.json(), summaryRes.json(), todayRes.json()]))
      .then(([salesJson, summaryJson, todayJson]) => {
        const sales = salesJson.sales || []
        const todaySalesList = todayJson.sales || []
        setTodaySales(todaySalesList.reduce((sum: number, s: { amount: number }) => sum + s.amount, 0))
        const totalSales = sales.reduce((sum: number, sale: { amount: number }) => sum + sale.amount, 0)
        const visits = sales.length
        const avgPrice = visits > 0 ? Math.round(totalSales / visits) : 0
        const salesRate = getAchievementRate(totalSales, salonTargets.sales)
        const visitsRate = getAchievementRate(visits, salonTargets.visits)
        const avgRate = getAchievementRate(avgPrice, salonTargets.avgPrice)
        setKpiData([
          { label: '今月売上', value: `¥${totalSales.toLocaleString()}`, sub: `目標 ¥${salonTargets.sales.toLocaleString()}`, rate: salesRate, diff: 0, diffUp: true },
          { label: '来店数', value: `${visits}名`, sub: `目標 ${salonTargets.visits}名`, rate: visitsRate, diff: 0, diffUp: true },
          { label: '客単価', value: `¥${avgPrice.toLocaleString()}`, sub: `目標 ¥${salonTargets.avgPrice.toLocaleString()}`, rate: avgRate, diff: 0, diffUp: true },
          { label: '再来店率', value: '-%', sub: '目標 75%', rate: 0, diff: 0, diffUp: true },
        ])
        setSalesSummary(summaryJson.cashSales != null ? {
          cashSales: summaryJson.cashSales ?? 0,
          consumeSales: summaryJson.consumeSales ?? 0,
          serviceLiability: summaryJson.serviceLiability ?? 0,
        } : null)
      })
      .catch(() => {})
  }, [salonTargets])

  const toggleTaskDone = async (id: string, currentDone: boolean) => {
    const next = manualTasks.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    setManualTasksState(next)
    await toggleTask(id, !currentDone).catch(() => {})
  }

  const addTaskHandler = async () => {
    if (!newTaskText.trim()) return
    try {
      const task = await addTask({
        text: newTaskText.trim(),
        source: 'manual',
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        done: false,
      })
      setManualTasksState(prev => [task, ...prev])
      setNewTaskText('')
      setNewTaskPriority('medium')
      setNewTaskDueDate('')
      setTaskModalOpen(false)
    } catch { }
  }

  const deleteTaskHandler = async (id: string) => {
    setManualTasksState(prev => prev.filter(t => t.id !== id))
    await deleteTask(id).catch(() => {})
  }

  const { year, month } = jstNow()
  const workingDays = getWorkingDaysInMonth(year, month)
  const dailyTarget = getDailyTarget(salonTargets.sales, workingDays)
  const dailyRate = getAchievementRate(todaySales, dailyTarget)

  const staffShifts = todayStaff.map(s => ({
    name: s.name,
    initial: s.name[0] || '',
    color: s.color,
    start: s.start_time,
    end: s.end_time,
    bookings: 0,
    free: '-',
  }))

  // 顧客管理に存在する予約のみ（customer_id あり）、開始時刻でソート
  const visitorsFromReservations = todayReservations
    .filter((r): r is Reservation & { customer_id: string } => !!r.customer_id)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      confirmed: '来店待ち',
      rescheduled: '来店待ち',
      visited: '来店済',
      completed: '施術完了',
      no_show: '無断キャンセル',
      cancelled: 'キャンセル',
    }
    return map[status] ?? status
  }

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* レジバナー + お知らせパネル（lg以上で横2列、スマホは縦積み） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Link
          href="/sales"
          className="block rounded-2xl overflow-hidden card-shadow hover:opacity-95 transition-opacity h-full min-h-[160px] flex flex-col"
        >
          <div className="bg-gradient-to-r from-rose to-lavender p-6 sm:p-8 flex items-center justify-between gap-4 flex-1">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div>
                <p className="text-white text-xl sm:text-2xl font-bold font-dm-sans">レジ・売上登録</p>
                <p className="text-white/90 text-sm sm:text-base mt-0.5">メニュー選択・決済・売上管理</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white shrink-0">
              <Receipt className="w-6 h-6 sm:w-7 sm:h-7" />
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-2xl card-shadow border border-gray-100 overflow-hidden flex flex-col h-full min-h-[160px]">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender shrink-0" />
          <div className="p-5 sm:p-6 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-5 h-5 text-rose shrink-0" />
                <h2 className="font-dm-sans font-bold text-lg text-text-main truncate">お知らせ</h2>
                {announcementsUnreadCount > 0 && (
                  <span
                    className="shrink-0 text-xs font-bold bg-rose text-white px-2 py-0.5 rounded-full min-w-[1.25rem] text-center"
                    title={`未読 ${announcementsUnreadCount}件`}
                  >
                    {announcementsUnreadCount > 99 ? '99+' : announcementsUnreadCount}
                  </span>
                )}
              </div>
            </div>

            {panelAnnouncements.length === 0 ? (
              <p className="text-sm text-text-sub flex-1 flex items-center justify-center py-8 text-center">
                新しいお知らせはありません
              </p>
            ) : (
              <ul className="space-y-2 flex-1 min-h-0">
                {panelAnnouncements.map((a) => {
                  const typeBorder = a.type === 'important' ? 'border-l-red-400'
                    : a.type === 'update' ? 'border-l-emerald-400'
                      : a.type === 'maintenance' ? 'border-l-amber-400'
                        : 'border-l-sky-400'
                  return (
                    <li key={a.id}>
                      <Link
                        href="/announcements"
                        className={`block rounded-xl border border-gray-100 pl-3 pr-3 py-2.5 hover:bg-light-lav/60 transition-colors border-l-4 ${typeBorder}`}
                      >
                        <div className="flex items-start gap-2">
                          {!a.is_read && (
                            <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-rose ring-2 ring-rose/30" aria-label="未読" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-text-main line-clamp-1">{a.title}</p>
                            {a.body ? (
                              <p className="text-xs text-text-sub mt-0.5 line-clamp-2">{a.body}</p>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <h3 className="font-dm-sans font-bold text-sm text-text-main">⚠️ 消費期限アラート</h3>
              </div>
              {productExpiryLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-rose animate-spin" />
                </div>
              ) : productExpiryAlerts.length === 0 ? (
                <p className="text-xs text-text-sub py-2">該当する物販の期限アラートはありません</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {productExpiryAlerts.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs"
                    >
                      <p className="font-semibold text-text-main">
                        {a.customer_name} ／ {a.product_name}
                      </p>
                      <p className="text-text-sub mt-0.5">
                        販売 {a.sold_at} · 期限 {a.expires_at}
                        <span className={`ml-2 font-bold ${a.days_left <= 3 ? 'text-red-600' : 'text-amber-800'}`}>
                          残り{a.days_left}日
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {a.is_notified ? (
                          <span className="text-emerald-700 font-medium">送信済み✅</span>
                        ) : a.line_user_id ? (
                          <button
                            type="button"
                            disabled={expiryNotifySending === a.id}
                            onClick={async () => {
                              setExpiryNotifySending(a.id)
                              try {
                                const res = await fetch(`/api/products/expiry-notify/${a.id}`, {
                                  method: 'POST',
                                })
                                const j = await res.json().catch(() => ({}))
                                if (!res.ok) throw new Error(j.error || '送信に失敗しました')
                                loadProductExpiryAlerts()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : '送信に失敗しました')
                              } finally {
                                setExpiryNotifySending(null)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#06C755] text-white text-xs font-bold disabled:opacity-50"
                          >
                            {expiryNotifySending === a.id ? '送信中…' : 'LINEを送る'}
                          </button>
                        ) : (
                          <span className="text-text-sub">LINE未連携</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              href="/announcements"
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-rose hover:text-rose/80 transition-colors"
            >
              すべて見る
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ① 月間KPIカード ×4 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="font-dm-sans text-lg font-bold text-rose">月間KPI</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiData.map((k) => {
            const rateColor = getAchievementColor(k.rate)
            const barColor = getAchievementBgColor(k.rate)
            return (
            <div
              key={k.label}
              className="bg-white rounded-2xl p-5 card-shadow overflow-hidden"
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
              <p className="text-xs text-text-sub font-dm-sans mb-1">{k.label}</p>
              <p className="text-3xl font-bold font-dm-sans mb-2 text-rose-500">{k.value}</p>
              <p className="text-xs text-text-sub mb-2">{k.sub} / 達成率 <span className={rateColor}>{k.rate}%</span></p>
              <div className="h-1.5 bg-light-lav rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all`}
                  style={{ width: `${Math.min(k.rate, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {k.diffUp ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> 前月比 +{k.diff}%
                  </span>
                ) : (
                  <span className="text-xs text-rose-400 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> 前月比 -{k.diff}%
                  </span>
                )}
              </div>
            </div>
          )})}
        </div>
        {salesSummary && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setDetailModal('cash')}
              className="bg-white rounded-xl p-4 card-shadow border border-[#BAE6FD] text-left hover:border-rose/50 hover:shadow-md transition-all cursor-pointer group"
              title="クリックで明細を見る"
            >
              <p className="text-xs text-text-sub mb-1">💰 着金売上</p>
              <p className="text-lg font-bold text-[#1A202C]">¥{salesSummary.cashSales.toLocaleString()}</p>
              <p className="text-xs text-text-sub mt-0.5 group-hover:text-rose">クリックで明細を見る</p>
            </button>
            <button
              type="button"
              onClick={() => setDetailModal('consume')}
              className="bg-white rounded-xl p-4 card-shadow border border-[#BAE6FD] text-left hover:border-rose/50 hover:shadow-md transition-all cursor-pointer group"
              title="クリックで明細を見る"
            >
              <p className="text-xs text-text-sub mb-1">✅ 消化売上</p>
              <p className="text-lg font-bold text-rose">¥{salesSummary.consumeSales.toLocaleString()}</p>
              <p className="text-xs text-text-sub mt-0.5 group-hover:text-rose">クリックで明細を見る</p>
            </button>
            <div className="bg-white rounded-xl p-4 card-shadow border border-[#BAE6FD]">
              <p className="text-xs text-text-sub mb-1">📋 役務残（前受金残高）</p>
              <p className="text-lg font-bold text-lavender">¥{salesSummary.serviceLiability.toLocaleString()}</p>
              <p className="text-xs text-text-sub mt-0.5">未消化回数券の残価値</p>
            </div>
          </div>
        )}
      </section>

      {/* ② 今日の日割り目標 + ③ 今日のタスク */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="font-dm-sans text-lg font-bold text-rose">今日の日割り目標</span>
          </div>
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <div className="flex justify-center mb-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#F8F5FF"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={dailyRate >= 100 ? '#34D399' : dailyRate >= 80 ? '#A78BFA' : dailyRate >= 50 ? '#FBBF24' : '#F472B6'}
                    strokeWidth="3"
                    strokeDasharray={`${Math.min(dailyRate, 100)}, 100`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#C4728A" />
                      <stop offset="100%" stopColor="#9B8EC4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold font-dm-sans ${getAchievementColor(dailyRate)}`}>{dailyRate}%</span>
                  <span className="text-xs text-text-sub">達成率</span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-text-main font-dm-sans">
              現在 ¥{todaySales.toLocaleString()} / 目標 ¥{dailyTarget.toLocaleString()}
            </p>
            <p className="text-center text-sm text-rose font-semibold mt-1">
              残り ¥{Math.max(0, dailyTarget - todaySales).toLocaleString()} で達成！
            </p>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="font-dm-sans text-lg font-bold text-rose">今日のタスク</span>
          </div>
          <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden max-h-[320px] overflow-y-auto">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
            <div className="space-y-3">
              <Link
                href="/customer-delight"
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-rose/10 to-lavender/10 border border-rose/20 hover:border-rose/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-rose/20 flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 text-rose" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-main">感動体験の提案</p>
                  <p className="text-xs text-text-sub">AIが顧客に合わせた感動施策を提案</p>
                </div>
                <ArrowRight className="w-4 h-4 text-rose shrink-0" />
              </Link>
              {courseAlerts.map((t) => (
                <Link
                  key={t.id}
                  href="/courses"
                  className="flex items-center gap-3 p-3 rounded-xl bg-light-lav/50 border-l-4 border-rose block"
                >
                  <span className="text-rose">🎫</span>
                  <p className="flex-1 text-sm text-text-main">{t.text}</p>
                  <span className="text-xs font-semibold text-rose flex items-center gap-1 shrink-0">
                    {t.action}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
              {TASKS_AUTO_BASE.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-light-lav/50 border-l-4 border-rose"
                >
                  {t.type === 'alert' && <span className="text-rose">🚨</span>}
                  {t.type === 'birthday' && <span>✨</span>}
                  {t.type === 'consult' && <span>📊</span>}
                  <p className="flex-1 text-sm text-text-main">{t.text}</p>
                  <Link
                    href={t.type === 'consult' ? '/leo' : '#'}
                    className="text-xs font-semibold text-rose hover:text-lavender flex items-center gap-1 shrink-0"
                  >
                    {t.action}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
              {manualTasks.map((t) => (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${t.done ? 'bg-gray-50 border-gray-100 opacity-60' : t.priority === 'high' ? 'bg-red-50 border-red-200' : t.priority === 'low' ? 'bg-gray-50 border-gray-200' : 'bg-light-lav/50 border-lavender/30'}`}>
                  <div onClick={() => toggleTaskDone(t.id, t.done)} className="flex-shrink-0">
                    <CheckSquare className={`w-5 h-5 ${t.done ? 'text-text-sub' : t.priority === 'high' ? 'text-red-500' : 'text-rose'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.done ? 'line-through text-text-sub' : 'text-text-main'}`}>{t.text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.source === 'leo' && <span className="text-xs text-blue-500 font-medium">LEO提案</span>}
                      {t.source === 'customer_delight' && <span className="text-xs text-purple-500 font-medium">感動体験</span>}
                      {t.priority === 'high' && <span className="text-xs text-red-500 font-medium">優先度：高</span>}
                      {t.due_date && <span className="text-xs text-text-sub">{t.due_date}まで</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteTaskHandler(t.id)} className="flex-shrink-0 p-1 text-text-sub hover:text-red-500 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setTaskModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-text-sub hover:text-rose border border-dashed border-text-sub/30 rounded-xl hover:border-rose/50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                タスクを追加
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ④ 今日の予約表（タイムライン形式） */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="font-dm-sans text-lg font-bold text-rose">今日の予約表</span>
          <Link href="/reservations" className="text-sm text-rose hover:underline ml-auto">予約管理へ →</Link>
        </div>
        <TimelineSchedule
          today={today}
          beds={beds}
          reservations={todayReservations}
          loading={reservationsLoading}
          openTime={businessHours.openTime}
          closeTime={businessHours.closeTime}
          onSlotClick={(slot) => { setSelectedSlot(slot); setShowReservationModal(true) }}
          onReservationClick={(r) => setReservationDetailModal(r)}
        />
      </section>

      {/* ⑤ 今日の来店客一覧（約70%） + ⑥ 出勤スタッフ（約30%） */}
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
        <section className="min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="font-dm-sans text-lg font-bold text-rose">今日の来店客一覧</span>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden card-shadow">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-light-lav/50">
                    <th className="text-left p-3 text-text-sub font-medium">予約時間</th>
                    <th className="text-left p-3 text-text-sub font-medium">顧客名</th>
                    <th className="text-left p-3 text-text-sub font-medium">施術メニュー</th>
                    <th className="text-left p-3 text-text-sub font-medium">担当スタッフ</th>
                    <th className="text-left p-3 text-text-sub font-medium">感動タスク</th>
                    <th className="text-left p-3 text-text-sub font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationsLoading ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-text-sub">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        読み込み中...
                      </td>
                    </tr>
                  ) : visitorsFromReservations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-text-sub">
                        今日の来店予約はありません（顧客管理に登録済みの予約のみ表示）
                      </td>
                    </tr>
                  ) : (
                    visitorsFromReservations.map((r, i) => {
                      const task = r.memo || (r.customers?.memo ?? '') || ''
                      const statusClass =
                        r.status === 'visited' || r.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'no_show'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      return (
                        <tr
                          key={r.id}
                          className={`${i % 2 === 0 ? 'bg-off-white' : 'bg-white'} cursor-pointer hover:bg-rose/5`}
                          onClick={() => setReservationDetailModal(r)}
                        >
                          <td className="p-3 text-text-main">
                            {typeof r.start_time === 'string' ? r.start_time.slice(0, 5) : '-'}
                            {r.end_time ? `〜${typeof r.end_time === 'string' ? r.end_time.slice(0, 5) : ''}` : ''}
                          </td>
                          <td className="p-3">
                            <Link
                              href={r.customer_id ? `/chart/${r.customer_id}` : `/chart?name=${encodeURIComponent(r.customer_name)}`}
                              className="font-medium text-text-main hover:text-rose hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.customer_name}様
                            </Link>
                          </td>
                          <td className="p-3 text-text-sub">{r.menu || '-'}</td>
                          <td className="p-3 text-text-sub">{r.staff_name || '-'}</td>
                          <td className="p-3">
                            {task ? (
                              <span className="text-xs bg-lavender/20 text-lavender px-2 py-0.5 rounded line-clamp-2">{task}</span>
                            ) : (
                              <span className="text-text-sub">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${statusClass}`}>
                              {getStatusLabel(r.status)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="font-dm-sans text-lg font-bold text-rose">今日の出勤スタッフ</span>
          </div>
          <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
            <div className="space-y-4">
              {staffShifts.length === 0 ? (
                <p className="text-sm text-text-sub text-center py-6">出勤スタッフの登録がありません</p>
              ) : (
                staffShifts.map((s) => (
                <div key={s.name} className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-main">{s.name}</p>
                    <p className="text-xs text-text-sub">
                      {s.start}〜{s.end} · 予約{s.bookings}件
                    </p>
                    <div className="mt-1 h-2 bg-light-lav rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: '85%', backgroundColor: s.color }}
                      />
                    </div>
                    <p className="text-xs text-text-sub mt-0.5">空き: {s.free}</p>
                  </div>
                </div>
              )))}
            </div>
          </div>
        </section>
      </div>

      {/* タスク追加モーダル */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">タスクを追加</h3>
              <button onClick={() => setTaskModalOpen(false)} className="p-2 text-text-sub hover:text-text-main rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              placeholder="例: 予約確認の電話"
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none mb-4"
              onKeyDown={e => e.key === 'Enter' && addTaskHandler()}
            />
            <div className="flex gap-2 mt-3">
              {[
                { value: 'high', label: '高', color: 'bg-red-100 text-red-700 border-red-300' },
                { value: 'medium', label: '中', color: 'bg-amber-100 text-amber-700 border-amber-300' },
                { value: 'low', label: '低', color: 'bg-gray-100 text-gray-700 border-gray-300' },
              ].map(p => (
                <button key={p.value} onClick={() => setNewTaskPriority(p.value as 'high' | 'medium' | 'low')}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${newTaskPriority === p.value ? p.color : 'bg-white text-text-sub border-gray-200'}`}>
                  優先度：{p.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs text-text-sub block mb-1">期限（任意）</label>
              <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose" />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setTaskModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={addTaskHandler}
                disabled={!newTaskText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 売上明細モーダル */}
      {detailModal && (
        <SalesDetailModal
          type={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}

      {/* 予約詳細モーダル（クリックで表示） */}
      {reservationDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-main">予約詳細</h3>
              <button onClick={() => setReservationDetailModal(null)} className="p-2 text-text-sub hover:text-text-main rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <p><span className="text-xs text-text-sub">顧客名</span> <span className="font-medium">{reservationDetailModal.customer_name}様</span></p>
              {reservationDetailModal.customer_phone && <p><span className="text-xs text-text-sub">電話番号</span> {reservationDetailModal.customer_phone}</p>}
              <p><span className="text-xs text-text-sub">施術メニュー</span> {reservationDetailModal.menu || '-'}</p>
              <p><span className="text-xs text-text-sub">担当スタッフ</span> {reservationDetailModal.staff_name || '-'}</p>
              <p><span className="text-xs text-text-sub">予約時間</span> {reservationDetailModal.start_time?.slice(0, 5)}{reservationDetailModal.end_time ? `〜${reservationDetailModal.end_time.slice(0, 5)}` : ''}</p>
              {reservationDetailModal.memo && <p><span className="text-xs text-text-sub">メモ</span> {reservationDetailModal.memo}</p>}
            </div>
            <ReservationActionCard
              reservation={reservationDetailModal}
              onVisit={(id) => { handleVisit(id); setReservationDetailModal(null) }}
              onReschedule={(r) => { setRescheduleTarget(r); setReservationDetailModal(null) }}
              onNoShow={(id) => { handleNoShow(id); setReservationDetailModal(null) }}
              onEdit={(r) => { setEditTarget(r); setReservationDetailModal(null) }}
              onCancel={(id) => { handleStatusChange(id, 'cancelled'); setReservationDetailModal(null) }}
            />
          </div>
        </div>
      )}

      {showReservationModal && selectedSlot && (
        <ReservationFormModal
          defaultDate={selectedSlot.date}
          defaultStartTime={selectedSlot.start}
          staffList={todayStaff.map(s => ({ name: s.name, color: s.color }))}
          defaultEndTime={(() => {
            const [h = 10, m = 0] = selectedSlot.start.slice(0, 5).split(':').map(Number)
            const total = h * 60 + m + 60
            return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
          })()}
          defaultBed={selectedSlot.bed}
          beds={beds}
          onClose={() => { setShowReservationModal(false); setSelectedSlot(null) }}
          onSaved={() => { setShowReservationModal(false); setSelectedSlot(null); refresh() }}
        />
      )}
      {rescheduleTarget && (
        <RescheduleModal
          reservation={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={() => { refresh(); setRescheduleTarget(null) }}
        />
      )}
      {editTarget && (
        <EditReservationModal
          reservation={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { refresh(); setEditTarget(null) }}
        />
      )}
    </div>
  )
}

function SalesDetailModal({ type, onClose }: { type: 'cash' | 'consume'; onClose: () => void }) {
  const today = todayJstString()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ sales: Array<Record<string, unknown>>; total: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/kpi/daily-detail?date=${today}&type=${type}`)
      .then(res => res.json())
      .then(json => {
        setData({ sales: json.sales || [], total: json.total ?? 0 })
      })
      .catch(() => setData({ sales: [], total: 0 }))
      .finally(() => setLoading(false))
  }, [type, today])

  const formatTime = (createdAt: unknown) => {
    if (!createdAt || typeof createdAt !== 'string') return '-'
    try {
      const d = new Date(createdAt)
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return '-'
    }
  }

  const getSaleTypeLabel = (st: unknown) => {
    const s = String(st ?? '')
    if (s === 'ticket_consume') return '回数券'
    if (s === 'subscription_consume') return 'サブスク'
    if (s === 'cash') return '現金'
    if (s === 'card') return 'カード'
    if (s === 'online') return 'オンライン'
    if (s === 'loan') return 'ローン'
    if (s === 'product') return '物販'
    return s || '-'
  }

  const getPaymentLabel = (pm: unknown) => {
    const s = String(pm ?? '')
    if (s === 'cash') return '現金'
    if (s === 'card') return 'カード'
    if (s === 'online') return 'オンライン'
    if (s === 'loan') return 'ローン'
    return s || '-'
  }

  const title = type === 'cash' ? '本日の着金売上明細' : '本日の消化売上明細'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col card-shadow">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-text-main">{title}</h3>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-text-main rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
            </div>
          ) : data && data.sales.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                {type === 'cash' ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-light-lav/50">
                        <th className="text-left p-3 text-text-sub font-medium">顧客名</th>
                        <th className="text-left p-3 text-text-sub font-medium">メニュー/商品名</th>
                        <th className="text-left p-3 text-text-sub font-medium">種別</th>
                        <th className="text-right p-3 text-text-sub font-medium">金額</th>
                        <th className="text-left p-3 text-text-sub font-medium">支払方法</th>
                        <th className="text-left p-3 text-text-sub font-medium">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((s, i) => (
                        <tr key={String(s.id ?? i)} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
                          <td className="p-3 text-text-main">{String(s.customer_name ?? '-')}</td>
                          <td className="p-3 text-text-main">{String(s.menu ?? '-')}</td>
                          <td className="p-3 text-text-sub">{getSaleTypeLabel(s.sale_type)}</td>
                          <td className="p-3 text-right font-medium">¥{Number(s.amount ?? 0).toLocaleString()}</td>
                          <td className="p-3 text-text-sub">{getPaymentLabel(s.payment_method)}</td>
                          <td className="p-3 text-text-sub">{formatTime(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-light-lav/50">
                        <th className="text-left p-3 text-text-sub font-medium">顧客名</th>
                        <th className="text-left p-3 text-text-sub font-medium">回数券/サブスク名</th>
                        <th className="text-left p-3 text-text-sub font-medium">残回数</th>
                        <th className="text-right p-3 text-text-sub font-medium">消化単価</th>
                        <th className="text-left p-3 text-text-sub font-medium">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((s, i) => (
                        <tr key={String(s.id ?? i)} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>
                          <td className="p-3 text-text-main">{String(s.customer_name ?? '-')}</td>
                          <td className="p-3 text-text-main">{String(s.menu ?? '-')}</td>
                          <td className="p-3 text-text-sub">{s.remaining_sessions !== undefined && s.remaining_sessions !== '-' ? String(s.remaining_sessions) : '-'}</td>
                          <td className="p-3 text-right font-medium">¥{Number(s.amount ?? 0).toLocaleString()}</td>
                          <td className="p-3 text-text-sub">{formatTime(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-rose/20 flex justify-end">
                <p className="text-lg font-bold text-rose">合計: ¥{data.total.toLocaleString()}</p>
              </div>
            </>
          ) : (
            <p className="text-center py-12 text-text-sub">本日の明細はありません</p>
          )}
        </div>
      </div>
    </div>
  )
}

