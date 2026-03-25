'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Coffee, LogIn, LogOut, Timer, Users, ChevronRight } from 'lucide-react'

type Status = 'not_started' | 'working' | 'on_break' | 'finished'

type StaffRow = { id: string; name: string; color?: string | null }

type TodayPayload = {
  error?: string
  date?: string
  staff_name?: string | null
  status?: Status
  record?: Record<string, unknown> | null
  shift?: { start_time?: string; end_time?: string } | null
  history?: { label: string; at: string }[]
}

const STATUS_LABEL: Record<Status, string> = {
  not_started: '未出勤',
  working: '出勤中',
  on_break: '休憩中',
  finished: '退勤済み',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

export default function AttendancePage() {
  const [phase, setPhase] = useState<'pick' | 'punch'>('pick')
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState('')

  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null)

  const [data, setData] = useState<TodayPayload | null>(null)
  const [todayLoading, setTodayLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  useEffect(() => {
    let cancelled = false
    setStaffLoading(true)
    setStaffError('')
    fetch('/api/staff')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.error) {
          setStaffError(j.error)
          setStaffList([])
          return
        }
        setStaffList((j.staff || []) as StaffRow[])
      })
      .catch(() => {
        if (!cancelled) {
          setStaffError('スタッフ一覧の取得に失敗しました')
          setStaffList([])
        }
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadToday = useCallback(async (staffId: string) => {
    setTodayLoading(true)
    try {
      const res = await fetch(`/api/attendance/today?staff_id=${encodeURIComponent(staffId)}`)
      const json = (await res.json()) as TodayPayload
      setData(json)
    } catch {
      setData({ error: '読み込みに失敗しました' })
    } finally {
      setTodayLoading(false)
    }
  }, [])

  useEffect(() => {
    if (phase === 'punch' && selectedStaff?.id) {
      loadToday(selectedStaff.id)
    }
  }, [phase, selectedStaff?.id, loadToday])

  function selectStaff(s: StaffRow) {
    setSelectedStaff(s)
    setData(null)
    setPhase('punch')
  }

  function switchStaff() {
    setPhase('pick')
    setSelectedStaff(null)
    setData(null)
  }

  async function post(path: string) {
    if (!selectedStaff?.id) return
    setActing(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: selectedStaff.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'エラーが発生しました')
        return
      }
      showToast('打刻しました')
      await loadToday(selectedStaff.id)
    } catch {
      showToast('通信エラー')
    } finally {
      setActing(false)
    }
  }

  if (phase === 'pick') {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-text-main font-serif-jp flex items-center gap-2">
            <Users className="w-6 h-6 text-rose" />
            タイムカード
          </h1>
          <p className="text-sm text-gray-500 mt-1">打刻するスタッフを選択してください</p>
        </div>

        {staffLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-rose animate-spin" />
          </div>
        ) : staffError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{staffError}</p>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">在籍スタッフがいません</p>
        ) : (
          <ul className="grid gap-3">
            {staffList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => selectStaff(s)}
                  className="w-full flex items-center gap-4 min-h-[72px] rounded-2xl border-2 border-[#E8E0F0] bg-white p-4 text-left card-shadow active:scale-[0.99] transition-transform hover:border-rose/40"
                >
                  <span
                    className="w-12 h-12 rounded-full shrink-0 border-2 border-white shadow-inner"
                    style={{ backgroundColor: s.color || '#C4728A' }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-text-main truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">タップして打刻画面へ</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (todayLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-rose animate-spin" />
        <p className="text-sm text-gray-500">読み込み中…</p>
      </div>
    )
  }

  if (data?.error && !data.status) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="text-xl font-bold text-text-main font-serif-jp">タイムカード</h1>
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{data.error}</p>
        <button
          type="button"
          onClick={switchStaff}
          className="w-full min-h-[52px] rounded-2xl border-2 border-[#9B8EC4] text-[#6B5B8C] font-semibold"
        >
          別のスタッフに切り替え
        </button>
      </div>
    )
  }

  const status = (data?.status || 'not_started') as Status
  const shift = data?.shift

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-main font-serif-jp">タイムカード</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-semibold text-text-main">{selectedStaff?.name || data?.staff_name}</span>
            <span className="mx-1">·</span>
            {data?.date}
          </p>
        </div>
        <button
          type="button"
          onClick={switchStaff}
          className="shrink-0 text-xs font-medium text-[#6B5B8C] px-3 py-2 rounded-xl border border-[#E8E0F0] bg-white"
        >
          別のスタッフに切り替え
        </button>
      </div>

      <div className="rounded-2xl border border-[#E8E0F0] bg-white p-6 card-shadow text-center">
        <p className="text-xs text-gray-500 uppercase tracking-wide">本日の状態</p>
        <p className="text-2xl font-bold text-rose mt-2 font-serif-jp">{STATUS_LABEL[status]}</p>
        {shift?.start_time && shift?.end_time && (
          <p className="text-xs text-gray-500 mt-3">
            本日のシフト {shift.start_time}〜{shift.end_time}
            <span className="block mt-1">遅刻・早退はシフトと比較して自動記録されます</span>
          </p>
        )}
        {!shift?.start_time && <p className="text-xs text-amber-700 mt-3">シフト未登録の日は遅刻・早退は付きません</p>}
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          disabled={acting || status !== 'not_started'}
          onClick={() => post('/api/attendance/clock-in')}
          className="flex items-center justify-center gap-3 min-h-[56px] rounded-2xl bg-rose text-white text-lg font-bold shadow-md disabled:opacity-40 disabled:shadow-none"
        >
          <LogIn className="w-6 h-6" />
          出勤
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={acting || status !== 'working'}
            onClick={() => post('/api/attendance/break-start')}
            className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl border-2 border-[#9B8EC4] text-[#6B5B8C] font-semibold disabled:opacity-40"
          >
            <Coffee className="w-5 h-5" />
            休憩入り
          </button>
          <button
            type="button"
            disabled={acting || status !== 'on_break'}
            onClick={() => post('/api/attendance/break-end')}
            className="flex items-center justify-center gap-2 min-h-[52px] rounded-2xl border-2 border-[#9B8EC4] text-[#6B5B8C] font-semibold disabled:opacity-40"
          >
            <Timer className="w-5 h-5" />
            休憩戻り
          </button>
        </div>

        <button
          type="button"
          disabled={acting || status === 'not_started' || status === 'finished'}
          onClick={() => post('/api/attendance/clock-out')}
          className="flex items-center justify-center gap-3 min-h-[56px] rounded-2xl bg-deep text-white text-lg font-bold disabled:opacity-40"
        >
          <LogOut className="w-6 h-6" />
          退勤
        </button>
      </div>

      <div className="rounded-2xl border border-[#E8E0F0] bg-white p-5 card-shadow">
        <h2 className="font-bold text-text-main text-sm mb-3">本日の打刻履歴</h2>
        {(data?.history?.length || 0) === 0 ? (
          <p className="text-sm text-gray-500">まだ打刻がありません</p>
        ) : (
          <ul className="space-y-2">
            {data?.history?.map((h) => (
              <li
                key={`${h.label}-${h.at}`}
                className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0"
              >
                <span className="text-text-main">{h.label}</span>
                <span className="text-gray-600 tabular-nums">{fmtTime(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
        {data?.record && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            {(data.record as { is_late?: boolean }).is_late && <p>遅刻として記録されています</p>}
            {(data.record as { is_early_leave?: boolean }).is_early_leave && <p>早退として記録されています</p>}
            {(data.record as { actual_work_minutes?: number }).actual_work_minutes != null &&
              (data.record as { clock_out?: string }).clock_out && (
                <p>実労働: {(data.record as { actual_work_minutes: number }).actual_work_minutes} 分</p>
              )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-deep text-white text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
