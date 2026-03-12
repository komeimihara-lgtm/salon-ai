'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Clock, User, Scissors,
  Loader2, X, CheckCircle2, RotateCcw, Ban, AlertCircle
} from 'lucide-react'
import type { Reservation } from '@/types'
import ReservationFormModal from '@/components/ReservationFormModal'
import { RescheduleModal, EditReservationModal } from '@/components/ReservationModals'

// ============================================================
// 定数
// ============================================================
const DAYS_JP = ['月', '火', '水', '木', '金', '土', '日']
const TIMELINE_START = 9   // 9:00
const TIMELINE_END   = 21  // 21:00
const SLOT_MINUTES   = 15
const SLOTS_COUNT    = ((TIMELINE_END - TIMELINE_START) * 60) / SLOT_MINUTES // 48
const ROW_HEIGHT     = 28  // px per 15min slot
const MIN_BED_WIDTH  = 120 // ベッド列の最小幅(px)
const TIME_COL_WIDTH = 56  // 時間列の幅(px)

// スタッフカラーのフォールバック
const STAFF_COLORS = [
  '#C4728A', '#9B8EC4', '#6AAFCF', '#6EC49B', '#D4A76A',
  '#CF6A8E', '#7A8ED4', '#55BFA5', '#D49B6A', '#8E6ACF',
]

// ============================================================
// ユーティリティ
// ============================================================
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return ((h - TIMELINE_START) * 60 + m) / SLOT_MINUTES
}

function slotToTime(slot: number): string {
  const totalMin = TIMELINE_START * 60 + slot * SLOT_MINUTES
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface Shift {
  staff_id: string
  date: string
  start_time: string
  end_time: string
  staff?: { id: string; name: string; color: string } | null
}

// ============================================================
// 週カレンダー
// ============================================================
function WeekCalendar({
  weekDates,
  selectedDate,
  todayStr,
  reservationCounts,
  onSelect,
  onPrevWeek,
  onNextWeek,
}: {
  weekDates: Date[]
  selectedDate: string
  todayStr: string
  reservationCounts: Record<string, number>
  onSelect: (d: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sola p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevWeek}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-light-lav transition-colors">
          <ChevronLeft className="w-5 h-5 text-deep" />
        </button>
        <span className="text-sm font-bold text-text-main">
          {weekDates[0].getFullYear()}年{weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </span>
        <button onClick={onNextWeek}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-light-lav transition-colors">
          <ChevronRight className="w-5 h-5 text-deep" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date, i) => {
          const dateStr = toDateStr(date)
          const count = reservationCounts[dateStr] || 0
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const isSat = i === 5
          const isSun = i === 6

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                isSelected
                  ? 'bg-gradient-to-b from-rose/20 to-lavender/20 border-2 border-rose/40'
                  : isToday
                    ? 'bg-rose/5 border border-rose/20'
                    : 'hover:bg-light-lav border border-transparent'
              }`}
            >
              <span className={`text-[10px] mb-0.5 font-medium ${
                isSat ? 'text-blue-500' : isSun ? 'text-red-400' : 'text-text-sub'
              }`}>
                {DAYS_JP[i]}
              </span>
              <span className={`text-sm font-bold ${
                isToday ? 'text-rose' :
                isSat ? 'text-blue-500' :
                isSun ? 'text-red-400' : 'text-text-main'
              }`}>
                {date.getDate()}
              </span>
              {count > 0 && (
                <span className="mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-rose to-lavender text-white text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// タイムラインヘッダー
// ============================================================
function TimelineHeader({ beds, bedWidth }: { beds: string[]; bedWidth: number }) {
  return (
    <div className="flex sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="shrink-0 border-r border-gray-200 bg-gray-50" style={{ width: `${TIME_COL_WIDTH}px` }} />
      {beds.map((bed, i) => (
        <div key={bed}
          className={`text-center py-2 text-xs font-bold text-deep shrink-0 ${i < beds.length - 1 ? 'border-r border-gray-200' : ''} bg-gray-50`}
          style={{ width: `${bedWidth}px` }}
        >
          ベッド{bed}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 予約ブロック
// ============================================================
function ReservationBlock({
  reservation,
  color,
  top,
  height,
  onClick,
}: {
  reservation: Reservation
  color: string
  top: number
  height: number
  onClick: () => void
}) {
  const isCancelled = reservation.status === 'cancelled'
  const isCompleted = reservation.status === 'completed'

  return (
    <button
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-lg shadow-sm border overflow-hidden text-left transition-all hover:shadow-md hover:scale-[1.01] ${
        isCancelled ? 'opacity-40' : ''
      }`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, ROW_HEIGHT)}px`,
        backgroundColor: isCancelled ? '#e5e7eb' : `${color}18`,
        borderColor: isCancelled ? '#d1d5db' : `${color}60`,
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: isCancelled ? '#9ca3af' : color }}
      />
      <div className="pl-2.5 pr-1 py-0.5 h-full flex flex-col justify-center min-h-0">
        <p className={`text-[10px] font-bold truncate ${isCancelled ? 'line-through text-gray-400' : 'text-text-main'}`}>
          {reservation.customer_name}様
        </p>
        {height >= ROW_HEIGHT * 2 && (
          <p className={`text-[9px] truncate ${isCancelled ? 'text-gray-400' : 'text-text-sub'}`}>
            {reservation.menu || '---'}
          </p>
        )}
        {height >= ROW_HEIGHT * 3 && reservation.staff_name && (
          <p className="text-[9px] truncate" style={{ color: isCancelled ? '#9ca3af' : color }}>
            {reservation.staff_name}
          </p>
        )}
        {isCompleted && (
          <CheckCircle2 className="absolute top-0.5 right-0.5 w-3 h-3 text-emerald-500" />
        )}
      </div>
    </button>
  )
}

// ============================================================
// タイムライン本体
// ============================================================
function Timeline({
  beds,
  reservations,
  shifts,
  staffColorMap,
  onSlotClick,
  onReservationClick,
}: {
  beds: string[]
  reservations: Reservation[]
  shifts: Shift[]
  staffColorMap: Map<string, string>
  onSlotClick: (bed: string, time: string) => void
  onReservationClick: (r: Reservation) => void
}) {
  const totalHeight = SLOTS_COUNT * ROW_HEIGHT

  // シフト時間帯をベッド別にマッピング（簡易: 全ベッド共通シフト表示）
  const shiftRanges = useMemo(() => {
    return shifts.map(s => ({
      startSlot: timeToSlot(s.start_time),
      endSlot: timeToSlot(s.end_time),
      staffName: s.staff?.name || '',
      staffColor: s.staff?.color || '#999',
    }))
  }, [shifts])

  // スロットがシフト内か判定
  const isInShift = useCallback((slot: number) => {
    return shiftRanges.some(sr => slot >= sr.startSlot && slot < sr.endSlot)
  }, [shiftRanges])

  // スタッフ名取得
  const getStaffAtSlot = useCallback((slot: number) => {
    const sr = shiftRanges.find(sr => slot >= sr.startSlot && slot < sr.endSlot)
    return sr || null
  }, [shiftRanges])

  // 予約をベッド別に分類
  const reservationsByBed = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    beds.forEach(b => map.set(b, []))
    reservations.forEach(r => {
      const bed = r.bed_id || beds[0]
      if (!map.has(bed)) map.set(bed, [])
      map.get(bed)!.push(r)
    })
    return map
  }, [beds, reservations])

  // ベッド列幅の計算: コンテナに収まる場合は等分、狭すぎる場合は最小幅を保証
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(e.contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const availableWidth = Math.max(containerWidth - TIME_COL_WIDTH, 0)
  const bedWidth = beds.length > 0
    ? Math.max(Math.floor(availableWidth / beds.length), MIN_BED_WIDTH)
    : MIN_BED_WIDTH
  const totalWidth = TIME_COL_WIDTH + bedWidth * beds.length

  return (
    <div className="bg-white rounded-2xl shadow-sola overflow-hidden" ref={containerRef}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-main flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-lavender" />
          タイムライン
        </h2>
        {beds.length > 0 && (
          <span className="text-[10px] text-text-sub">{beds.length}台</span>
        )}
      </div>
      <div className="overflow-auto max-h-[60vh]">
        <div style={{ minWidth: `${totalWidth}px` }}>
          <TimelineHeader beds={beds} bedWidth={bedWidth} />
          <div className="flex relative" style={{ height: `${totalHeight}px` }}>
            {/* 時間ラベル列 */}
            <div className="shrink-0 relative border-r border-gray-200" style={{ width: `${TIME_COL_WIDTH}px` }}>
              {Array.from({ length: TIMELINE_END - TIMELINE_START + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-start justify-end pr-2 text-[10px] text-text-sub"
                  style={{ top: `${i * 4 * ROW_HEIGHT - 6}px` }}
                >
                  {TIMELINE_START + i}:00
                </div>
              ))}
            </div>

            {/* ベッド列 */}
            {beds.map((bed, bedIdx) => {
              const bedReservations = reservationsByBed.get(bed) || []
              return (
                <div
                  key={bed}
                  className={`shrink-0 relative ${bedIdx < beds.length - 1 ? 'border-r border-gray-200' : ''}`}
                  style={{ width: `${bedWidth}px` }}
                >
                {/* グリッド線 + シフト背景 */}
                {Array.from({ length: SLOTS_COUNT }, (_, slot) => {
                  const inShift = isInShift(slot)
                  const staffInfo = getStaffAtSlot(slot)
                  const isHourLine = slot % 4 === 0
                  const isHalfHour = slot % 2 === 0 && !isHourLine
                  return (
                    <div
                      key={slot}
                      onClick={() => {
                        if (inShift) onSlotClick(bed, slotToTime(slot))
                      }}
                      className={`absolute left-0 right-0 ${
                        inShift ? 'cursor-pointer hover:bg-rose/5' : 'bg-gray-100/60'
                      } ${
                        isHourLine ? 'border-t border-gray-200' :
                        isHalfHour ? 'border-t border-gray-100' :
                        'border-t border-gray-50'
                      }`}
                      style={{ top: `${slot * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                    >
                      {/* シフト中スタッフ名を薄く */}
                      {inShift && staffInfo && isHourLine && bedIdx === 0 && (
                        <span className="absolute right-1 top-0 text-[9px] font-medium opacity-25"
                          style={{ color: staffInfo.staffColor }}>
                          {staffInfo.staffName}
                        </span>
                      )}
                    </div>
                  )
                })}

                {/* 予約ブロック */}
                {bedReservations.map(r => {
                  if (!r.start_time) return null
                  const startSlot = timeToSlot(r.start_time)
                  const endSlot = r.end_time ? timeToSlot(r.end_time) : startSlot + 4
                  const top = startSlot * ROW_HEIGHT
                  const height = (endSlot - startSlot) * ROW_HEIGHT
                  const color = staffColorMap.get(r.staff_name || '') || STAFF_COLORS[0]
                  return (
                    <ReservationBlock
                      key={r.id}
                      reservation={r}
                      color={color}
                      top={top}
                      height={height}
                      onClick={() => onReservationClick(r)}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* 現在時刻ライン */}
          <CurrentTimeLine />
        </div>
        </div>
      </div>
    </div>
  )
}

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const h = now.getHours()
  const m = now.getMinutes()
  if (h < TIMELINE_START || h >= TIMELINE_END) return null
  const slot = ((h - TIMELINE_START) * 60 + m) / SLOT_MINUTES
  const top = slot * ROW_HEIGHT

  return (
    <div className="absolute left-12 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
      <div className="relative">
        <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-rose" />
        <div className="h-[2px] bg-rose w-full" />
      </div>
    </div>
  )
}

// ============================================================
// 予約詳細モーダル
// ============================================================
function ReservationDetailModal({
  reservation,
  onClose,
  onVisit,
  onReschedule,
  onCancel,
  onEdit,
}: {
  reservation: Reservation
  onClose: () => void
  onVisit: () => void
  onReschedule: () => void
  onCancel: () => void
  onEdit: () => void
}) {
  const isCancelled = reservation.status === 'cancelled'
  const isCompleted = reservation.status === 'completed'
  const isConfirmed = reservation.status === 'confirmed'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text-main">予約詳細</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-text-sub" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose to-lavender flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={`font-bold text-text-main ${isCancelled ? 'line-through opacity-50' : ''}`}>
                {reservation.customer_name}様
              </p>
              {reservation.customer_phone && (
                <p className="text-xs text-text-sub">{reservation.customer_phone}</p>
              )}
            </div>
          </div>

          <div className="bg-light-lav rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-sub">日時</span>
              <span className="font-medium text-text-main">
                {reservation.reservation_date} {reservation.start_time}〜{reservation.end_time || '---'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sub">メニュー</span>
              <span className="font-medium text-text-main">{reservation.menu || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sub">担当</span>
              <span className="font-medium text-text-main">{reservation.staff_name || '未指定'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sub">ベッド</span>
              <span className="font-medium text-text-main">{reservation.bed_id ? `ベッド${reservation.bed_id}` : '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sub">金額</span>
              <span className="font-bold text-rose">¥{reservation.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sub">ステータス</span>
              <StatusBadge status={reservation.status} />
            </div>
            {reservation.memo && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-text-sub text-xs">メモ</span>
                <p className="text-text-main text-xs mt-0.5">{reservation.memo}</p>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {isConfirmed && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={onVisit}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" /> 来店処理
              </button>
              <button onClick={onEdit}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">
                <Scissors className="w-4 h-4" /> 編集
              </button>
              <button onClick={onReschedule}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-lavender text-lavender text-sm font-bold">
                <RotateCcw className="w-4 h-4" /> リスケ
              </button>
              <button onClick={onCancel}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-300 text-red-400 text-sm font-bold">
                <Ban className="w-4 h-4" /> キャンセル
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ステータスバッジ
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string }> = {
    confirmed:   { label: '予約確定', class: 'bg-blue-50 text-blue-600 border-blue-200' },
    completed:   { label: '完了',     class: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    visited:     { label: '来店済',   class: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    cancelled:   { label: 'キャンセル', class: 'bg-gray-50 text-gray-400 border-gray-200' },
    no_show:     { label: '無断欠席', class: 'bg-red-50 text-red-500 border-red-200' },
    rescheduled: { label: '変更済',   class: 'bg-amber-50 text-amber-600 border-amber-200' },
  }
  const c = config[status] || { label: status, class: 'bg-gray-50 text-gray-500 border-gray-200' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${c.class}`}>
      {c.label}
    </span>
  )
}

// ============================================================
// 予約一覧（選択日）
// ============================================================
function ReservationList({
  reservations,
  loading,
  selectedDate,
  onVisit,
  onReschedule,
  onCancel,
  onEdit,
  onNewReservation,
}: {
  reservations: Reservation[]
  loading: boolean
  selectedDate: string
  onVisit: (id: string) => void
  onReschedule: (r: Reservation) => void
  onCancel: (id: string) => void
  onEdit: (r: Reservation) => void
  onNewReservation: () => void
}) {
  const sorted = [...reservations].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  const dateParts = selectedDate.split('-')
  const dateLabel = `${Number(dateParts[1])}月${Number(dateParts[2])}日`

  return (
    <div className="bg-white rounded-2xl shadow-sola overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-main">
          {dateLabel}の予約
          <span className="ml-2 text-text-sub font-normal text-xs">({reservations.length}件)</span>
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 text-rose animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10">
          <Calendar className="w-10 h-10 text-lavender/40 mx-auto mb-2" />
          <p className="text-text-sub text-sm">この日の予約はありません</p>
          <button onClick={onNewReservation}
            className="mt-3 text-sm text-rose hover:text-rose/80 font-medium underline underline-offset-2">
            予約を追加する
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sorted.map(r => {
            const isCancelled = r.status === 'cancelled'
            return (
              <div key={r.id} className={`px-4 py-3 ${isCancelled ? 'opacity-50 bg-gray-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="text-center shrink-0 pt-0.5">
                    <p className="text-xs font-bold text-deep">{r.start_time}</p>
                    {r.end_time && <p className="text-[10px] text-text-sub">〜{r.end_time}</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold text-text-main ${isCancelled ? 'line-through' : ''}`}>
                      {r.customer_name}様
                    </p>
                    <p className="text-xs text-text-sub truncate">{r.menu || '---'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {r.staff_name && (
                        <span className="text-[10px] text-lavender font-medium">{r.staff_name}</span>
                      )}
                      <span className="text-[10px] text-rose font-bold">¥{r.price.toLocaleString()}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  {/* アクションボタン */}
                  {r.status === 'confirmed' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onVisit(r.id)} title="来店処理"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onReschedule(r)} title="リスケ"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-lavender/10 hover:bg-lavender/20 text-lavender">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onCancel(r.id)} title="キャンセル"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function ReservationsPage() {
  const [today] = useState(() => new Date())
  const [currentWeek, setCurrentWeek] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()))
  const [beds, setBeds] = useState<string[]>(['A', 'B'])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  // モーダル状態
  const [showNewModal, setShowNewModal] = useState(false)
  const [newModalDefaults, setNewModalDefaults] = useState<{ date: string; time?: string; bed?: string }>({ date: selectedDate })
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Reservation | null>(null)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)

  // スタッフカラーマップ
  const [staffColorMap, setStaffColorMap] = useState<Map<string, string>>(new Map())

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])
  const weekStart = toDateStr(weekDates[0])
  const weekEnd = toDateStr(weekDates[6])
  const todayStr = toDateStr(today)

  // beds取得
  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => { if (j.beds) setBeds(j.beds) })
      .catch(() => {})
  }, [])

  // 週の予約取得
  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reservations/list?start=${weekStart}&end=${weekEnd}`)
      const data = await res.json()
      setReservations(data.reservations || [])

      // スタッフカラー構築
      const map = new Map<string, string>()
      let colorIdx = 0
      for (const r of (data.reservations || [])) {
        if (r.staff_name && !map.has(r.staff_name)) {
          map.set(r.staff_name, STAFF_COLORS[colorIdx % STAFF_COLORS.length])
          colorIdx++
        }
      }
      setStaffColorMap(map)
    } catch {
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [weekStart, weekEnd])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  // 選択日のシフト取得
  useEffect(() => {
    fetch(`/api/shifts?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        setShifts(data.shifts || [])
        // シフトからスタッフカラーも補完
        setStaffColorMap(prev => {
          const next = new Map(prev)
          for (const s of (data.shifts || [])) {
            if (s.staff?.name && !next.has(s.staff.name)) {
              next.set(s.staff.name, s.staff.color || STAFF_COLORS[next.size % STAFF_COLORS.length])
            }
          }
          return next
        })
      })
      .catch(() => setShifts([]))
  }, [selectedDate])

  // 週別予約件数
  const reservationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of reservations) {
      if (r.status !== 'cancelled') {
        counts[r.reservation_date] = (counts[r.reservation_date] || 0) + 1
      }
    }
    return counts
  }, [reservations])

  // 選択日の予約
  const selectedReservations = useMemo(
    () => reservations.filter(r => r.reservation_date === selectedDate),
    [reservations, selectedDate]
  )

  // アクションハンドラ
  const handleVisit = async (id: string) => {
    await fetch('/api/reservations/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'visited' }),
    })
    setDetailTarget(null)
    fetchReservations()
  }

  const handleCancel = async (id: string) => {
    if (!confirm('この予約をキャンセルしますか？')) return
    await fetch('/api/reservations/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cancelled' }),
    })
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
    setDetailTarget(null)
  }

  // 空き枠クリック
  const handleSlotClick = (bed: string, time: string) => {
    setNewModalDefaults({ date: selectedDate, time, bed })
    setShowNewModal(true)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-main">予約管理</h1>
        <button
          onClick={() => {
            setNewModalDefaults({ date: selectedDate })
            setShowNewModal(true)
          }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-rose to-lavender text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sola hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> 新規予約
        </button>
      </div>

      {/* 1. 週カレンダー */}
      <WeekCalendar
        weekDates={weekDates}
        selectedDate={selectedDate}
        todayStr={todayStr}
        reservationCounts={reservationCounts}
        onSelect={setSelectedDate}
        onPrevWeek={() => {
          const d = new Date(currentWeek)
          d.setDate(d.getDate() - 7)
          setCurrentWeek(d)
        }}
        onNextWeek={() => {
          const d = new Date(currentWeek)
          d.setDate(d.getDate() + 7)
          setCurrentWeek(d)
        }}
      />

      {/* 2. タイムライン予約表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl shadow-sola">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : (
        <Timeline
          beds={beds}
          reservations={selectedReservations}
          shifts={shifts}
          staffColorMap={staffColorMap}
          onSlotClick={handleSlotClick}
          onReservationClick={setDetailTarget}
        />
      )}

      {/* 3. 予約一覧 */}
      <ReservationList
        reservations={selectedReservations}
        loading={loading}
        selectedDate={selectedDate}
        onVisit={handleVisit}
        onReschedule={r => { setDetailTarget(null); setRescheduleTarget(r) }}
        onCancel={handleCancel}
        onEdit={r => { setDetailTarget(null); setEditTarget(r) }}
        onNewReservation={() => {
          setNewModalDefaults({ date: selectedDate })
          setShowNewModal(true)
        }}
      />

      {/* モーダル群 */}
      {detailTarget && (
        <ReservationDetailModal
          reservation={detailTarget}
          onClose={() => setDetailTarget(null)}
          onVisit={() => handleVisit(detailTarget.id)}
          onReschedule={() => { setDetailTarget(null); setRescheduleTarget(detailTarget) }}
          onCancel={() => handleCancel(detailTarget.id)}
          onEdit={() => { setDetailTarget(null); setEditTarget(detailTarget) }}
        />
      )}
      {showNewModal && (
        <ReservationFormModal
          defaultDate={newModalDefaults.date}
          defaultStartTime={newModalDefaults.time}
          defaultBed={newModalDefaults.bed}
          beds={beds}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); fetchReservations() }}
        />
      )}
      {rescheduleTarget && (
        <RescheduleModal
          reservation={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={() => { setRescheduleTarget(null); fetchReservations() }}
        />
      )}
      {editTarget && (
        <EditReservationModal
          reservation={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchReservations() }}
        />
      )}
    </div>
  )
}
