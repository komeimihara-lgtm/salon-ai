'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2
} from 'lucide-react'
import type { Reservation } from '@/types'
import ReservationActionCard from '@/components/ReservationActionCard'
import { RescheduleModal, EditReservationModal } from '@/components/ReservationModals'
import ReservationFormModal from '@/components/ReservationFormModal'
import { useReservations } from '@/hooks/useReservations'
import { getSalonSettings } from '@/lib/salon-settings'

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

// ============================================================
// メインページ
// ============================================================
export default function ReservationsPage() {
  const [today] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [showNewModal, setShowNewModal] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Reservation | null>(null)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)

  const weekDates = getWeekDates(currentWeek)
  const weekStart = toDateStr(weekDates[0])
  const {
    reservations,
    loading,
    refresh,
    handleVisit,
    handleNoShow,
    handleStatusChange,
  } = useReservations({ week: weekStart })

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
                <ReservationActionCard
                  key={r.id}
                  reservation={r}
                  onVisit={handleVisit}
                  onReschedule={r => setRescheduleTarget(r)}
                  onNoShow={handleNoShow}
                  onEdit={r => setEditTarget(r)}
                  onCancel={id => handleStatusChange(id, 'cancelled')}
                />
              ))}
            </div>
          )}
        </div>

      {showNewModal && (
        <ReservationFormModal
          defaultDate={selectedDate}
          beds={getSalonSettings().beds.length > 0 ? getSalonSettings().beds : ['A', 'B']}
          onClose={() => setShowNewModal(false)}
          onSaved={refresh}
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
