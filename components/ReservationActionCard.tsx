'use client'

import Link from 'next/link'
import { User, Clock, Phone, Check, Calendar, AlertCircle, X } from 'lucide-react'
import type { Reservation } from '@/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '確定', color: 'bg-gray-500/20 text-gray-600 border-gray-500/30' },
  visited: { label: '来店済み', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  completed: { label: '来店済み', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  rescheduled: { label: 'リスケ', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'キャンセル', color: 'bg-slate-500/20 text-[#4A5568] border-slate-500/30' },
  no_show: { label: '無断キャンセル', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export interface ReservationActionCardProps {
  reservation: Reservation
  onVisit: (id: string) => void
  onReschedule: (r: Reservation) => void
  onNoShow: (id: string) => void
  onEdit: (r: Reservation) => void
  onCancel?: (id: string) => void
}

export default function ReservationActionCard({
  reservation,
  onVisit,
  onReschedule,
  onNoShow,
  onEdit,
  onCancel,
}: ReservationActionCardProps) {
  const { label, color } = STATUS_MAP[reservation.status] ?? STATUS_MAP.confirmed
  const canAct = reservation.status === 'confirmed' || reservation.status === 'rescheduled'

  return (
    <div className="bg-white rounded-xl p-4 border border-[#E8E0F0] card-shadow space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-text-sub" />
            {reservation.customer_id ? (
              <Link
                href={`/chart/${reservation.customer_id}`}
                className="text-sm font-bold text-text-main hover:text-rose hover:underline"
              >
                {reservation.customer_name}
              </Link>
            ) : (
              <Link
                href={`/chart?name=${encodeURIComponent(reservation.customer_name)}`}
                className="text-sm font-bold text-text-main hover:text-rose hover:underline"
              >
                {reservation.customer_name}
              </Link>
            )}
          </div>
          {reservation.customer_phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-text-sub" />
              <span className="text-xs text-text-sub">{reservation.customer_phone}</span>
            </div>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-sub">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{reservation.start_time?.slice(0, 5)}{reservation.end_time ? `〜${reservation.end_time.slice(0, 5)}` : ''}</span>
        </div>
        {reservation.menu && <span className="text-text-main">｜ {reservation.menu}</span>}
        {reservation.staff_name && <span>担当: {reservation.staff_name}</span>}
      </div>

      {reservation.price > 0 && (
        <p className="text-xs text-amber-600 font-semibold">¥{reservation.price.toLocaleString()}</p>
      )}

      {canAct && (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => onVisit(reservation.id)}
            className="flex items-center justify-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 rounded-lg py-1.5 px-2 text-xs transition-colors"
          >
            <Check className="w-3 h-3" /> 来店処理
          </button>
          <button
            onClick={() => onReschedule(reservation)}
            className="flex items-center justify-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 rounded-lg py-1.5 px-2 text-xs transition-colors"
          >
            <Calendar className="w-3 h-3" /> リスケ
          </button>
          <button
            onClick={() => onNoShow(reservation.id)}
            className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 rounded-lg py-1.5 px-2 text-xs transition-colors"
          >
            <AlertCircle className="w-3 h-3" /> 無断キャンセル
          </button>
          <button
            onClick={() => onEdit(reservation)}
            className="flex items-center justify-center gap-1 bg-rose/10 hover:bg-rose/20 border border-rose/30 text-rose rounded-lg py-1.5 px-2 text-xs transition-colors"
          >
            編集
          </button>
          {onCancel && (
            <button
              onClick={() => onCancel(reservation.id)}
              className="flex items-center justify-center bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 text-slate-600 rounded-lg px-2 py-1.5 text-xs transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
