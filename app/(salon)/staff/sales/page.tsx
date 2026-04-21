'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Summary = {
  new_customer_sales: number
  repeat_sales: number
  course_sales: number
  subscription_sales: number
  product_sales: number
  consume_sales: number
  cash_sales: number
  total_sales: number
}

type StaffOpt = { id: string; name: string }

function monthBounds(y: number, m: number) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}

const CHART_KEYS = [
  { key: 'new_customer_sales', label: '新規' },
  { key: 'repeat_sales', label: 'リピート' },
  { key: 'course_sales', label: 'コース' },
  { key: 'subscription_sales', label: 'サブスク' },
  { key: 'product_sales', label: '物販' },
  { key: 'consume_sales', label: '消化' },
] as const

const COLORS = ['#C4728A', '#9B8EC4', '#6B8EAD', '#E8A598', '#8FBC8F', '#D4A574']

export default function StaffSalesPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [staffList, setStaffList] = useState<StaffOpt[]>([])
  const [staffId, setStaffId] = useState<string>('') // '' = 全員比較
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [singleSummary, setSingleSummary] = useState<Summary | null>(null)
  const [compareRows, setCompareRows] = useState<{ staff_name: string; summary: Summary }[]>([])

  const { start, end } = monthBounds(year, month)

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff')
    const json = await res.json()
    setStaffList(json.staff || [])
  }, [])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({ start, end })
      if (staffId) q.set('staff_id', staffId)
      const res = await fetch(`/api/staff/sales-summary?${q}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '取得に失敗しました')
        setSingleSummary(null)
        setCompareRows([])
        return
      }
      if (json.summary) {
        setSingleSummary(json.summary as Summary)
        setCompareRows([])
      } else {
        setSingleSummary(null)
        const rows = (json.byStaff || []).map((r: { staff_name: string; summary: Summary }) => ({
          staff_name: r.staff_name,
          summary: r.summary,
        }))
        setCompareRows(rows)
      }
    } catch {
      setError('通信エラー')
    } finally {
      setLoading(false)
    }
  }, [start, end, staffId])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const chartDataSingle =
    singleSummary != null
      ? CHART_KEYS.map(({ key, label }) => ({
          name: label,
          金額: singleSummary[key as keyof Summary] as number,
        }))
      : []

  const chartDataCompare = compareRows.map((r) => ({
    name: r.staff_name.length > 8 ? `${r.staff_name.slice(0, 8)}…` : r.staff_name,
    ...CHART_KEYS.reduce(
      (acc, { key, label }) => {
        acc[label] = r.summary[key as keyof Summary]
        return acc
      },
      {} as Record<string, number>
    ),
  }))

  if (error && !loading && !singleSummary && compareRows.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-text-main font-serif-jp flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-rose" />
          スタッフ別売上
        </h1>
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-bold text-text-main font-serif-jp flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-rose" />
          スタッフ別売上（オーナー）
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">スタッフ</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]"
          >
            <option value="">全員比較</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
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
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2">
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
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : (
        <>
          {singleSummary && (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[#E8E0F0] bg-white p-4">
                <p className="text-gray-500 text-xs">合計売上</p>
                <p className="text-xl font-bold text-rose">¥{singleSummary.total_sales.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-[#E8E0F0] bg-white p-4">
                <p className="text-gray-500 text-xs">着金売上</p>
                <p className="text-lg font-semibold">¥{singleSummary.cash_sales.toLocaleString()}</p>
              </div>
              {CHART_KEYS.map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-gray-100 bg-[#FAFAFA] px-3 py-2 flex justify-between">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium tabular-nums">¥{singleSummary[key as keyof Summary].toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="h-80 bg-white rounded-2xl border border-[#E8E0F0] p-4 card-shadow">
            <ResponsiveContainer width="100%" height="100%">
              {staffId ? (
                <BarChart data={chartDataSingle} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? `¥${v.toLocaleString()}` : '')} />
                  <Bar dataKey="金額" name="金額" radius={[4, 4, 0, 0]}>
                    {chartDataSingle.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={chartDataCompare} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? `¥${v.toLocaleString()}` : '')} />
                  <Legend />
                  {CHART_KEYS.map(({ label }, i) => (
                    <Bar key={label} dataKey={label} stackId="a" fill={COLORS[i % COLORS.length]} name={label} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {!staffId && compareRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8E0F0] overflow-hidden card-shadow">
              <h2 className="font-bold text-text-main px-4 py-3 border-b text-sm">数値一覧（全員）</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#F8F5FF] text-left text-gray-600">
                      <th className="px-2 py-2">スタッフ</th>
                      {CHART_KEYS.map(({ label }) => (
                        <th key={label} className="px-2 py-2 whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                      <th className="px-2 py-2">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((r) => (
                      <tr key={r.staff_name} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-medium">{r.staff_name}</td>
                        {CHART_KEYS.map(({ key }) => (
                          <td key={key} className="px-2 py-1.5 tabular-nums">
                            ¥{r.summary[key as keyof Summary].toLocaleString()}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 tabular-nums font-semibold">¥{r.summary.total_sales.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
