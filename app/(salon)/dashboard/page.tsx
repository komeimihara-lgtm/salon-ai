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
} from 'lucide-react'
import { useTodayShifts } from '@/lib/staff-shifts'
import { getManualTasks, setManualTasks, type ManualTask } from '@/lib/dashboard-tasks'
import {
  getDashboardReservations,
  setDashboardReservations,
  type DashboardReservation,
} from '@/lib/dashboard-reservations'
import { getSalonSettings } from '@/lib/salon-settings'
import {
  getExpiringSoon,
  getExpired,
  getCustomerCourses,
  consumeCourse,
  isExpired,
} from '@/lib/courses'
import {
  getCustomerSubscriptions,
  useSubscriptionSession,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
} from '@/lib/subscriptions'

const STORAGE_MENUS = 'sola_menus'

const TASKS_AUTO_BASE = [
  { id: 1, type: 'alert', text: '田中様（92日未来店）に失客防止メッセージを送る', action: '送信する' },
  { id: 2, type: 'birthday', text: '山田様の誕生日まで7日。特典クーポンを送る', action: '送信する' },
  { id: 3, type: 'consult', text: '今月の達成率53%。経営会議に戦略を相談する', action: '相談する' },
]

function loadMenus(): { id: string; name: string; duration: number; price: number }[] {
  if (typeof window === 'undefined') return [{ id: '1', name: 'フェイシャル', duration: 60, price: 8000 }]
  try {
    const raw = localStorage.getItem(STORAGE_MENUS)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: '1', name: 'フェイシャル', duration: 60, price: 8000 }]
    }
  } catch (_) {}
  return [{ id: '1', name: 'フェイシャル', duration: 60, price: 8000 }]
}

const VISITORS = [
  { time: '10:00', name: '山田 花子', count: 12, menu: 'フェイシャル', staff: '田中', status: '施術中', task: '施術後フォロー予定' },
  { time: '11:30', name: '佐藤 美咲', count: 5, menu: 'ボディケア', staff: '鈴木', status: '来店前', task: '' },
  { time: '14:00', name: '高橋 恵', count: 3, menu: 'フェイシャル', staff: '田中', status: '来店前', task: '誕生日特典送付' },
  { time: '15:30', name: '伊藤 さくら', count: 8, menu: 'フルコース', staff: '鈴木', status: '来店前', task: '' },
]

const FALLBACK_STAFF = [
  { name: '田中', initial: '田', color: '#C4728A', start: '09:00', end: '18:00', bookings: 5, free: '12:00-13:00' },
  { name: '鈴木', initial: '鈴', color: '#9B8EC4', start: '10:00', end: '19:00', bookings: 4, free: '14:00-14:30' },
]

type KpiItem = { label: string; value: string; sub: string; rate: number; diff: number; diffUp: boolean }

export default function DashboardPage() {
  const todayShifts = useTodayShifts()
  const [kpiData, setKpiData] = useState<KpiItem[]>([
    { label: '今月売上', value: '¥-', sub: '目標 ¥-', rate: 0, diff: 0, diffUp: true },
    { label: '来店数', value: '-名', sub: '目標 -名', rate: 0, diff: 0, diffUp: true },
    { label: '客単価', value: '¥-', sub: '目標 ¥-', rate: 0, diff: 0, diffUp: true },
    { label: '再来店率', value: '-%', sub: '目標 75%', rate: 0, diff: 0, diffUp: true },
  ])
  const [manualTasks, setManualTasksState] = useState<ManualTask[]>([])
  const [reservations, setReservationsState] = useState<DashboardReservation[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [reservationModalOpen, setReservationModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ bed: string; time: string } | null>(null)
  const [reservationDetail, setReservationDetail] = useState<DashboardReservation | null>(null)
  const [menus, setMenus] = useState<{ id: string; name: string }[]>([])
  const [staff, setStaff] = useState<{ name: string }[]>([])
  const [beds, setBeds] = useState<string[]>(['A', 'B'])
  const [courseAlerts, setCourseAlerts] = useState<{ id: string; type: string; text: string; action: string }[]>([])

  useEffect(() => {
    const s = getSalonSettings()
    // Supabaseから今月の売上を取得
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    fetch(`/api/kpi/sales?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(json => {
        const sales = json.sales || []
        const totalSales = sales.reduce((sum: number, sale: { amount: number }) => sum + sale.amount, 0)
        const visits = sales.length
        const avgPrice = visits > 0 ? Math.round(totalSales / visits) : 0
        const salesRate = Math.round((totalSales / s.targets.sales) * 100)
        const visitsRate = Math.round((visits / s.targets.visits) * 100)
        const avgRate = Math.round((avgPrice / s.targets.avgPrice) * 100)
        setKpiData([
          { label: '今月売上', value: `¥${totalSales.toLocaleString()}`, sub: `目標 ¥${s.targets.sales.toLocaleString()}`, rate: salesRate, diff: 0, diffUp: true },
          { label: '来店数', value: `${visits}名`, sub: `目標 ${s.targets.visits}名`, rate: visitsRate, diff: 0, diffUp: true },
          { label: '客単価', value: `¥${avgPrice.toLocaleString()}`, sub: `目標 ¥${s.targets.avgPrice.toLocaleString()}`, rate: avgRate, diff: 0, diffUp: true },
          { label: '再来店率', value: '68%', sub: '目標 75%', rate: 91, diff: 5, diffUp: true },
        ])
      })
      .catch(() => {})
    setManualTasksState(getManualTasks())
    setReservationsState(getDashboardReservations())
    setMenus(loadMenus().map(m => ({ id: m.id, name: m.name })))
    setStaff(s.staff.map(x => ({ name: x.name })))
    setBeds(s.beds.length > 0 ? s.beds : ['A', 'B'])
    const expiring = getExpiringSoon(14)
    const expired = getExpired()
    const alerts: { id: string; type: string; text: string; action: string }[] = []
    if (expired.length > 0) {
      alerts.push({
        id: 'course-expired',
        type: 'alert',
        text: `${expired.length}件のコースが期限切れ（残り回数あり）`,
        action: '確認する',
      })
    }
    if (expiring.length > 0 && alerts.length === 0) {
      alerts.push({
        id: 'course-expiring',
        type: 'alert',
        text: `${expiring.length}件のコースが14日以内に期限`,
        action: '確認する',
      })
    }
    setCourseAlerts(alerts)
  }, [])

  const toggleTaskDone = (id: string) => {
    const next = manualTasks.map(t => (t.id === id ? { ...t, done: !t.done } : t))
    setManualTasksState(next)
    setManualTasks(next)
  }

  const addTask = () => {
    if (!newTaskText.trim()) return
    const task: ManualTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      done: false,
    }
    const next = [...manualTasks, task]
    setManualTasksState(next)
    setManualTasks(next)
    setNewTaskText('')
    setTaskModalOpen(false)
  }

  const openAddReservation = (bed: string, time: string) => {
    setSelectedSlot({ bed, time })
    setReservationDetail(null)
    setReservationModalOpen(true)
  }

  const openReservationDetail = (r: DashboardReservation) => {
    setReservationDetail(r)
    setSelectedSlot(null)
    setReservationModalOpen(true)
  }

  const saveReservation = (form: { name: string; menu: string; staff: string }) => {
    if (!selectedSlot || !form.name.trim()) return
    const r: DashboardReservation = {
      id: Date.now().toString(),
      time: selectedSlot.time,
      bed: selectedSlot.bed,
      name: form.name.trim(),
      menu: form.menu || menus[0]?.name || 'フェイシャル',
      staff: form.staff || staff[0]?.name || '田中',
    }
    const next = [...reservations, r]
    setReservationsState(next)
    setDashboardReservations(next)
    setReservationModalOpen(false)
    setSelectedSlot(null)
  }

  const removeReservation = (id: string) => {
    const next = reservations.filter(r => r.id !== id)
    setReservationsState(next)
    setDashboardReservations(next)
    setReservationModalOpen(false)
    setReservationDetail(null)
  }
  const staffShifts = todayShifts.length > 0
    ? todayShifts.map(s => ({
        name: s.staffName,
        initial: s.staffName[0],
        color: s.staffColor,
        start: s.start,
        end: s.end,
        bookings: s.bookings ?? 0,
        free: s.freeSlots ?? '-',
      }))
    : FALLBACK_STAFF
  const dailyTarget = 30000
  const dailyCurrent = 18500
  const dailyRate = Math.round((dailyCurrent / dailyTarget) * 100)

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* レジ・売上登録ボタン（大きめ） */}
      <Link
        href="/sales"
        className="block w-full rounded-2xl overflow-hidden card-shadow hover:opacity-95 transition-opacity"
      >
        <div className="bg-gradient-to-r from-rose to-lavender p-6 sm:p-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div>
              <p className="text-white text-xl sm:text-2xl font-bold font-dm-sans">レジ・売上登録</p>
              <p className="text-white/90 text-sm sm:text-base mt-0.5">メニュー選択・決済・売上管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7" />
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </Link>

      {/* ① 月間KPIカード ×4 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans text-2xl font-bold text-text-main">月間KPI</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiData.map((k) => (
            <div
              key={k.label}
              className="bg-white rounded-2xl p-5 card-shadow overflow-hidden"
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
              <p className="text-xs text-text-sub font-dm-sans mb-1">{k.label}</p>
              <p className="text-3xl font-bold text-rose font-dm-sans mb-2">{k.value}</p>
              <p className="text-xs text-text-sub mb-2">{k.sub} / 達成率 {k.rate}%</p>
              <div className="h-1.5 bg-light-lav rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose to-lavender rounded-full transition-all"
                  style={{ width: `${Math.min(k.rate, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {k.diffUp ? (
                  <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> 前月比 +{k.diff}%
                  </span>
                ) : (
                  <span className="text-xs text-red-600 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> 前月比 -{k.diff}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ② 今日の日割り目標 + ③ 今日のタスク */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans text-2xl font-bold text-text-main">今日の日割り目標</span>
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
                    stroke="url(#ringGradient)"
                    strokeWidth="3"
                    strokeDasharray={`${dailyRate}, 100`}
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
                  <span className="text-2xl font-bold text-rose font-dm-sans">{dailyRate}%</span>
                  <span className="text-xs text-text-sub">達成率</span>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-text-main font-dm-sans">
              現在 ¥{dailyCurrent.toLocaleString()} / 目標 ¥{dailyTarget.toLocaleString()}
            </p>
            <p className="text-center text-sm text-rose font-semibold mt-1">
              残り ¥{(dailyTarget - dailyCurrent).toLocaleString()} で達成！
            </p>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans text-2xl font-bold text-text-main">今日のタスク</span>
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
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-light-lav/30 cursor-pointer group"
                  onClick={() => toggleTaskDone(t.id)}
                >
                  <CheckSquare className={`w-5 h-5 shrink-0 ${t.done ? 'text-text-sub' : 'text-rose'}`} />
                  <p className={`flex-1 text-sm ${t.done ? 'text-text-sub line-through' : 'text-text-main'}`}>
                    {t.text}
                  </p>
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

      {/* ④ 今日の予約表 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans text-2xl font-bold text-text-main">今日の予約表</span>
        </div>
        <div className="bg-white rounded-2xl overflow-hidden card-shadow overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[60px_repeat(20,1fr)] bg-light-lav border-b border-gray-200">
              <div className="p-2 text-xs font-dm-sans text-text-sub" />
              {Array.from({ length: 20 }, (_, i) => 10 + i * 0.5).map((h) => (
                <div key={h} className="p-2 text-center text-xs font-dm-sans text-text-sub border-l border-gray-200">
                  {Math.floor(h)}:{(h % 1 ? '30' : '00')}
                </div>
              ))}
            </div>
            {beds.map((bed) => (
              <div key={bed} className="grid grid-cols-[60px_repeat(20,1fr)] border-b border-gray-100 last:border-b-0">
                <div className="p-3 bg-deep text-white text-sm font-medium flex items-center justify-center">
                  ベッド{bed}
                </div>
                <div className="col-span-20 flex relative min-h-[60px]">
                  {Array.from({ length: 20 }, (_, i) => {
                    const time = `${10 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`
                    const existing = reservations.find(r => r.bed === bed && r.time === time)
                    if (existing) {
                      const [h, m] = existing.time.split(':').map(Number)
                      const col = (h - 10) * 2 + (m || 0) / 30
                      return (
                        <div
                          key={`${existing.id}`}
                          onClick={() => openReservationDetail(existing)}
                          className="absolute rounded-lg px-2 py-1 text-white text-xs font-medium shadow-sm cursor-pointer hover:ring-2 hover:ring-rose/50 z-10"
                          style={{
                            left: `${col * 5}%`,
                            width: '10%',
                            minWidth: 48,
                            background: 'linear-gradient(135deg, #C4728A, #9B8EC4)',
                          }}
                        >
                          <p className="font-semibold truncate">{existing.name}</p>
                          <p className="text-white/90 truncate">{existing.menu}</p>
                          <p className="text-white/80 truncate text-[10px]">{existing.staff}</p>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={`${bed}-${time}`}
                        onClick={() => openAddReservation(bed, time)}
                        className="absolute rounded border border-dashed border-gray-200 hover:border-rose/50 hover:bg-rose/5 cursor-pointer transition-colors"
                        style={{
                          left: `${i * 5}%`,
                          width: '5%',
                          height: 'calc(100% - 4px)',
                          top: 2,
                        }}
                        title={`${time} 空き枠をクリックして予約追加`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ 今日の来店客一覧 + ⑥ 出勤スタッフ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans text-2xl font-bold text-text-main">今日の来店客一覧</span>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden card-shadow">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-light-lav/50">
                    <th className="text-left p-3 text-text-sub font-medium">時間</th>
                    <th className="text-left p-3 text-text-sub font-medium">顧客名</th>
                    <th className="text-left p-3 text-text-sub font-medium">施術</th>
                    <th className="text-left p-3 text-text-sub font-medium">担当</th>
                    <th className="text-left p-3 text-text-sub font-medium">フォロータスク</th>
                    <th className="text-left p-3 text-text-sub font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {VISITORS.map((v, i) => (
                    <tr key={v.name} className={i % 2 === 0 ? 'bg-off-white' : 'bg-white'}>

                      <td className="p-3 text-text-main">{v.time}</td>
                      <td className="p-3">
                        <Link href={`/chart?name=${encodeURIComponent(v.name)}`} className="font-medium text-text-main hover:text-rose hover:underline">
                          {v.name}様
                        </Link>
                        <span className="ml-1 text-xs text-text-sub bg-light-lav px-1.5 py-0.5 rounded">{v.count}回目</span>
                      </td>
                      <td className="p-3 text-text-sub">{v.menu}</td>
                      <td className="p-3 text-text-sub">{v.staff}</td>
                      <td className="p-3">
                        {v.task ? (
                          <span className="text-xs bg-lavender/20 text-lavender px-2 py-0.5 rounded">{v.task}</span>
                        ) : (
                          <span className="text-text-sub">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            v.status === '施術中'
                              ? 'bg-gradient-to-r from-rose/20 to-lavender/20 text-rose'
                              : v.status === '施術完了'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-text-sub'
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans text-2xl font-bold text-text-main">今日の出勤スタッフ</span>
          </div>
          <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
            <div className="space-y-4">
              {staffShifts.map((s) => (
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
              ))}
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
              onKeyDown={e => e.key === 'Enter' && addTask()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTaskModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予約追加・詳細モーダル */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main">
                {reservationDetail ? '予約詳細' : `予約を追加 ${selectedSlot ? `（ベッド${selectedSlot.bed} ${selectedSlot.time}）` : ''}`}
              </h3>
              <button
                onClick={() => {
                  setReservationModalOpen(false)
                  setReservationDetail(null)
                  setSelectedSlot(null)
                }}
                className="p-2 text-text-sub hover:text-text-main rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {reservationDetail ? (
              <ReservationDetailContent
                reservation={reservationDetail}
                onRemove={() => {
                  removeReservation(reservationDetail.id)
                }}
                onConsumed={() => {
                  setReservationsState(getDashboardReservations())
                  setReservationModalOpen(false)
                  setReservationDetail(null)
                }}
              />
            ) : selectedSlot ? (
              <AddReservationForm
                slot={selectedSlot}
                menus={menus}
                staff={staff}
                onSave={saveReservation}
                onCancel={() => {
                  setReservationModalOpen(false)
                  setSelectedSlot(null)
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function ReservationDetailContent({
  reservation,
  onRemove,
  onConsumed,
}: {
  reservation: DashboardReservation
  onRemove: () => void
  onConsumed: () => void
}) {
  const allCourses = getCustomerCourses()
  const matchingCourse = allCourses.find(
    c =>
      c.customerName === reservation.name &&
      c.menuName === reservation.menu &&
      c.remainingSessions > 0 &&
      !isExpired(c)
  )

  const allSubs = getCustomerSubscriptions()
    .filter(s => s.status === 'active')
    .map(s => ensureBillingPeriodCurrent(s))
  const matchingSub = allSubs.find(
    s =>
      s.customerName === reservation.name &&
      s.menuName === reservation.menu &&
      getRemainingSessions(s) > 0
  )

  const handleConsume = () => {
    if (!matchingCourse) return
    consumeCourse(matchingCourse.id)
    onConsumed()
  }

  const handleSubUse = () => {
    if (!matchingSub) return
    useSubscriptionSession(matchingSub.id)
    onConsumed()
  }

  return (
    <div className="space-y-3">
      <p>
        <span className="text-text-sub text-sm">顧客名</span>{' '}
        <Link href={`/chart?name=${encodeURIComponent(reservation.name)}`} className="font-medium text-rose hover:underline">
          {reservation.name}
        </Link>
      </p>
      <p><span className="text-text-sub text-sm">メニュー</span> {reservation.menu}</p>
      <p><span className="text-text-sub text-sm">担当</span> {reservation.staff}</p>
      <p><span className="text-text-sub text-sm">時間</span> {reservation.time} ベッド{reservation.bed}</p>
      {matchingCourse && (
        <button
          onClick={handleConsume}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium"
        >
          回数券で1回消化（{matchingCourse.courseName} 残{matchingCourse.remainingSessions}回）
        </button>
      )}
      {matchingSub && (
        <button
          onClick={handleSubUse}
          className="w-full py-2.5 rounded-xl bg-lavender text-white font-medium"
        >
          サブスクで1回利用（{matchingSub.planName} 残{getRemainingSessions(matchingSub)}回）
        </button>
      )}
      <button
        onClick={onRemove}
        className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
      >
        予約を削除
      </button>
    </div>
  )
}

function AddReservationForm({
  slot,
  menus,
  staff,
  onSave,
  onCancel,
}: {
  slot: { bed: string; time: string }
  menus: { id: string; name: string }[]
  staff: { name: string }[]
  onSave: (form: { name: string; menu: string; staff: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [menu, setMenu] = useState(menus[0]?.name ?? '')
  const [staffName, setStaffName] = useState(staff[0]?.name ?? '')
  useEffect(() => {
    setMenu(menus[0]?.name ?? '')
    setStaffName(staff[0]?.name ?? '')
  }, [menus, staff])
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">顧客名</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="山田 花子"
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">メニュー</label>
        <select
          value={menu}
          onChange={e => setMenu(e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
        >
          {menus.map(m => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">担当スタッフ</label>
        <select
          value={staffName}
          onChange={e => setStaffName(e.target.value)}
          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
        >
          {staff.map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 mt-6">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-text-main hover:bg-gray-50">
          キャンセル
        </button>
        <button
          onClick={() => onSave({ name, menu, staff: staffName })}
          disabled={!name.trim()}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          追加
        </button>
      </div>
    </div>
  )
}
