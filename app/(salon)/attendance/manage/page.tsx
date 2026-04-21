'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'

type ByStaff = {
  staff_id: string
  staff_name: string
  work_days: number
  total_minutes: number
  late_count: number
  early_leave_count: number
}

type RecordRow = {
  id: string
  date: string
  staff_id: string
  clock_in: string | null
  clock_out: string | null
  break_start: string | null
  break_end: string | null
  actual_work_minutes: number | null
  is_late: boolean
  is_early_leave: boolean
  note: string | null
  staff?: { id: string; name: string } | null
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function fmtIso(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function fmtClock(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

export default function AttendanceManagePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [byStaff, setByStaff] = useState<ByStaff[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])

  const fetchMonthly = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/attendance/monthly?year=${year}&month=${month}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '取得に失敗しました')
        setByStaff([])
        setRecords([])
        return
      }
      setByStaff(json.byStaff || [])
      setRecords(json.records || [])
    } catch {
      setError('通信エラー')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchMonthly()
  }, [fetchMonthly])

  function downloadCsv() {
    const header = [
      '日付',
      'スタッフ',
      '出勤',
      '退勤',
      '休憩開始',
      '休憩終了',
      '実労働(分)',
      '遅刻',
      '早退',
      'メモ',
    ]
    const lines = [header.join(',')]
    for (const r of records) {
      const name = (r.staff as { name?: string } | undefined)?.name || ''
      lines.push(
        [
          r.date,
          csvEscape(name),
          csvEscape(fmtIso(r.clock_in)),
          csvEscape(fmtIso(r.clock_out)),
          csvEscape(fmtIso(r.break_start)),
          csvEscape(fmtIso(r.break_end)),
          r.actual_work_minutes ?? '',
          r.is_late ? '1' : '',
          r.is_early_leave ? '1' : '',
          csvEscape((r.note || '').replace(/\n/g, ' ')),
        ].join(',')
      )
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `attendance_${year}-${pad(month)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (error && !loading && byStaff.length === 0 && records.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-text-main font-serif-jp">勤怠管理</h1>
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-lg font-bold text-text-main font-serif-jp">勤怠管理（オーナー）</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (month <= 1) {
                setMonth(12)
                setYear((y) => y - 1)
              } else setMonth((m) => m - 1)
            }}
            className="p-2 rounded-lg bg-white border border-gray-200"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {year}年{month}月
          </span>
          <button
            type="button"
            onClick={() => {
              if (month >= 12) {
                setMonth(1)
                setYear((y) => y + 1)
              } else setMonth((m) => m + 1)
            }}
            className="p-2 rounded-lg bg-white border border-gray-200"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!records.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose text-white text-sm font-medium disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-[#E8E0F0] overflow-hidden card-shadow">
            <h2 className="font-bold text-text-main px-4 py-3 border-b border-gray-100 text-sm">スタッフ別集計</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8F5FF] text-left text-gray-600">
                    <th className="px-3 py-2">スタッフ</th>
                    <th className="px-3 py-2">出勤日数</th>
                    <th className="px-3 py-2">総労働(時間)</th>
                    <th className="px-3 py-2">遅刻</th>
                    <th className="px-3 py-2">早退</th>
                  </tr>
                </thead>
                <tbody>
                  {byStaff.map((s) => (
                    <tr key={s.staff_id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{s.staff_name}</td>
                      <td className="px-3 py-2">{s.work_days}</td>
                      <td className="px-3 py-2">{(s.total_minutes / 60).toFixed(1)}</td>
                      <td className="px-3 py-2">{s.late_count}</td>
                      <td className="px-3 py-2">{s.early_leave_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E0F0] overflow-hidden card-shadow">
            <h2 className="font-bold text-text-main px-4 py-3 border-b border-gray-100 text-sm">日別一覧</h2>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-[#F8F5FF] z-10">
                  <tr className="text-left text-gray-600">
                    <th className="px-2 py-2">日付</th>
                    <th className="px-2 py-2">スタッフ</th>
                    <th className="px-2 py-2">出勤</th>
                    <th className="px-2 py-2">退勤</th>
                    <th className="px-2 py-2">実労働</th>
                    <th className="px-2 py-2">遅刻</th>
                    <th className="px-2 py-2">早退</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.date}</td>
                      <td className="px-2 py-1.5">{(r.staff as { name?: string } | undefined)?.name || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtClock(r.clock_in)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtClock(r.clock_out)}</td>
                      <td className="px-2 py-1.5">{r.actual_work_minutes != null ? `${r.actual_work_minutes}分` : '—'}</td>
                      <td className="px-2 py-1.5">{r.is_late ? '○' : ''}</td>
                      <td className="px-2 py-1.5">{r.is_early_leave ? '○' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
