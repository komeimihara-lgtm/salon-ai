'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock,
  User, Check, X, AlertCircle, Loader2, Phone
} from 'lucide-react'
import { Reservation, Customer } from '@/types'
import { fetchCustomerTickets, consumeTicket, isTicketExpired } from '@/lib/tickets'
import {
  fetchCustomerSubscriptions,
  useSubscriptionSession,
  ensureBillingPeriodCurrent,
  getRemainingSessions,
} from '@/lib/subscriptions'

// 週の日付配列を生成
function getWeekDates(baseDate: Date): Date[] {
  const monday = new Date(baseDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日']
const STATUS_MAP = {
  confirmed: { label: '確定', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: '完了', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'キャンセル', color: 'bg-slate-500/20 text-[#4A5568] border-slate-500/30' },
  no_show: { label: '無断キャンセル', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

// 予約カード
function ReservationCard({
  reservation,
  onStatusChange,
}: {
  reservation: Reservation
  onStatusChange: (id: string, status: Reservation['status']) => void
}) {
  const { label, color } = STATUS_MAP[reservation.status]
  return (
    <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#4A5568]" />
            {reservation.customer_id ? (
              <Link
                href={`/chart/${reservation.customer_id}`}
                className="text-sm font-bold text-[#1A202C] hover:text-[#0891B2] hover:underline"
              >
                {reservation.customer_name}
              </Link>
            ) : (
              <Link
                href={`/chart?name=${encodeURIComponent(reservation.customer_name)}`}
                className="text-sm font-bold text-[#1A202C] hover:text-[#0891B2] hover:underline"
              >
                {reservation.customer_name}
              </Link>
            )}
          </div>
          {reservation.customer_phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-[#4A5568]" />
              <span className="text-xs text-[#4A5568]">{reservation.customer_phone}</span>
            </div>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-[#4A5568]">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{reservation.start_time.slice(0, 5)}{reservation.end_time ? `〜${reservation.end_time.slice(0, 5)}` : ''}</span>
        </div>
        {reservation.menu && <span className="text-[#1A202C]">｜ {reservation.menu}</span>}
        {reservation.staff_name && <span>担当: {reservation.staff_name}</span>}
      </div>

      {reservation.price > 0 && (
        <p className="text-xs text-amber-400 font-semibold">¥{reservation.price.toLocaleString()}</p>
      )}

      {reservation.status === 'confirmed' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onStatusChange(reservation.id, 'completed')}
            className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg py-1.5 text-xs transition-colors"
          >
            <Check className="w-3 h-3" /> 完了
          </button>
          <button
            onClick={() => onStatusChange(reservation.id, 'no_show')}
            className="flex-1 flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg py-1.5 text-xs transition-colors"
          >
            <AlertCircle className="w-3 h-3" /> 無断キャンセル
          </button>
          <button
            onClick={() => onStatusChange(reservation.id, 'cancelled')}
            className="flex items-center justify-center bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-[#4A5568] rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// 新規予約モーダル
function NewReservationModal({
  defaultDate,
  onClose,
  onSaved,
}: {
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '',
    reservation_date: defaultDate,
    start_time: '10:00',
    end_time: '11:00',
    menu: '',
    staff_name: '',
    price: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<Customer[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // デバウンス300msで顧客検索
  useEffect(() => {
    if (!searchQuery.trim()) {
      setCandidates([])
      setShowDropdown(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingCandidates(true)
      setShowDropdown(true)
      try {
        const res = await fetch(`/api/customers/list?search=${encodeURIComponent(searchQuery.trim())}`)
        const data = await res.json()
        setCandidates(data.customers ?? [])
      } catch {
        setCandidates([])
      } finally {
        setLoadingCandidates(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectCustomer(c: Customer) {
    setForm(prev => ({
      ...prev,
      customer_name: c.name,
      customer_phone: c.phone ?? '',
      customer_id: c.id,
    }))
    setSearchQuery('')
    setCandidates([])
    setShowDropdown(false)
  }

  async function handleSubmit() {
    if (!form.customer_name.trim()) { setError('顧客名は必須です'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id || undefined,
          price: parseInt(form.price) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const MENUS = ['フェイシャル60分', 'フェイシャル90分', 'ボディ60分', 'ボディ90分', '美白コース', 'エイジングケア']
  const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">新規予約</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div ref={dropdownRef} className="relative">
              <label className="text-xs text-[#4A5568] mb-1 block">顧客名 *</label>
              <input
                value={form.customer_name}
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, customer_name: v, customer_id: '' }))
                  setSearchQuery(v)
                }}
                onFocus={() => searchQuery && setShowDropdown(true)}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="名前で検索 or 直接入力"
              />
              {showDropdown && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#BAE6FD] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {loadingCandidates ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-[#4A5568] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      検索中...
                    </div>
                  ) : candidates.length === 0 ? (
                    <p className="px-3 py-3 text-[#4A5568] text-sm">該当する顧客がいません（そのまま入力で新規登録）</p>
                  ) : (
                    <ul className="py-1">
                      {candidates.map(c => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-sm text-[#1A202C] hover:bg-[#BAE6FD] flex items-center justify-between gap-2"
                          >
                            <span>{c.name}</span>
                            {c.phone && <span className="text-[#4A5568] text-xs">{c.phone}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">電話番号</label>
              <input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="090-0000-0000" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">予約日</label>
            <input type="date" value={form.reservation_date} onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">開始時間</label>
              <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">終了時間</label>
              <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メニュー</label>
            <select value={form.menu} onChange={e => setForm(p => ({ ...p, menu: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
              <option value="">選択してください</option>
              {MENUS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">担当スタッフ</label>
              <input value={form.staff_name} onChange={e => setForm(p => ({ ...p, staff_name: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="田中" />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">料金（円）</label>
              <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="15000" />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メモ</label>
            <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={2} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2] resize-none"
              placeholder="アレルギーや注意事項など" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#BAE6FD]">
          <button onClick={onClose} className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm hover:text-[#1A202C] transition-colors">
            キャンセル
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? '保存中...' : '予約を登録'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function ReservationsPage() {
  const [today] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)

  const weekDates = getWeekDates(currentWeek)

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const weekStart = toDateStr(weekDates[0])
      const res = await fetch(`/api/reservations/list?week=${weekStart}`)
      const data = await res.json()
      setReservations(data.reservations || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentWeek])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  async function handleStatusChange(id: string, status: Reservation['status']) {
    const reservation = reservations.find(r => r.id === id)
    try {
      await fetch('/api/reservations/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      // 来店済み（完了）にしたタイミングで回数券・サブスクを自動消化
      if (status === 'completed' && reservation?.customer_name && reservation?.menu) {
        const customerId = reservation.customer_id ?? ''
        const customerName = reservation.customer_name
        const menu = reservation.menu

        const [allTickets, allSubsRaw] = await Promise.all([
          fetchCustomerTickets(customerId || undefined),
          fetchCustomerSubscriptions(customerId || undefined),
        ])
        const allSubs = allSubsRaw
          .filter(s => s.status === 'active')
          .map(s => ensureBillingPeriodCurrent(s))

        const matchingTicket = allTickets.find(
          c =>
            (c.customerId === customerId || c.customerName === customerName) &&
            c.menuName === menu &&
            c.remainingSessions > 0 &&
            !isTicketExpired(c)
        )
        if (matchingTicket) {
          await consumeTicket(matchingTicket.id)
        } else {
          const matchingSub = allSubs.find(
            s =>
              (s.customerId === customerId || s.customerName === customerName) &&
              s.menuName === menu &&
              getRemainingSessions(s) > 0
          )
          if (matchingSub) {
            await useSubscriptionSession(matchingSub.id)
          }
        }
      }
      fetchReservations()
    } catch (err) {
      console.error(err)
    }
  }

  const selectedDateReservations = reservations.filter(r => r.reservation_date === selectedDate)
  const todayStr = toDateStr(today)

  // 週次サマリー
  const weekConfirmed = reservations.filter(r => r.status === 'confirmed').length
  const weekCompleted = reservations.filter(r => r.status === 'completed').length
  const weekRevenue = reservations.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.price, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-rose to-lavender text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> 新規予約
          </button>
        </div>
        {/* 週次サマリー */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '今週の予約', value: `${weekConfirmed}件`, color: 'text-blue-400' },
            { label: '完了済み', value: `${weekCompleted}件`, color: 'text-emerald-400' },
            { label: '今週の売上', value: `¥${(weekRevenue / 10000).toFixed(1)}万`, color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-3 text-center">
              <p className="text-xs text-[#4A5568]">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 週ナビゲーション */}
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#BAE6FD] transition-colors">
              <ChevronLeft className="w-4 h-4 text-[#4A5568]" />
            </button>
            <span className="text-sm font-bold text-[#1A202C]">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
            </span>
            <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#BAE6FD] transition-colors">
              <ChevronRight className="w-4 h-4 text-[#4A5568]" />
            </button>
          </div>

          {/* 7日カレンダー */}
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const dateStr = toDateStr(date)
              const count = reservations.filter(r => r.reservation_date === dateStr && r.status === 'confirmed').length
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const isSat = i === 5
              const isSun = i === 6

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border border-emerald-500/50'
                      : 'hover:bg-[#BAE6FD] border border-transparent'
                  }`}
                >
                  <span className={`text-xs mb-1 ${isSat ? 'text-blue-400' : isSun ? 'text-red-400' : 'text-[#4A5568]'}`}>
                    {DAYS_JP[i]}
                  </span>
                  <span className={`text-sm font-bold ${
                    isToday ? 'text-emerald-400' :
                    isSat ? 'text-blue-300' :
                    isSun ? 'text-red-300' : 'text-[#1A202C]'
                  }`}>
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="mt-1 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 選択日の予約一覧 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#1A202C]">
              {new Date(selectedDate).getMonth() + 1}月{new Date(selectedDate + 'T00:00:00').getDate()}日の予約
              <span className="ml-2 text-[#4A5568] font-normal">({selectedDateReservations.length}件)</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : selectedDateReservations.length === 0 ? (
            <div className="text-center py-10 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl">
              <Calendar className="w-10 h-10 text-[#4A5568] mx-auto mb-2" />
              <p className="text-[#4A5568] text-sm">この日の予約はありません</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 underline"
              >
                予約を追加する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateReservations.map(r => (
                <ReservationCard key={r.id} reservation={r} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>

      {showNewModal && (
        <NewReservationModal
          defaultDate={selectedDate}
          onClose={() => setShowNewModal(false)}
          onSaved={fetchReservations}
        />
      )}
    </div>
  )
}
