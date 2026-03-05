'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { getSalonSettings } from '@/lib/salon-settings'
import { getAchievementRate, getAchievementColor } from '@/lib/goals'

type MonthlyRow = {
  month: number
  monthLabel: string
  cashSales: number
  consumeSales: number
  productSales: number
  totalSales: number
  achievementRate: number
}

export default function SalesAnalysisPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState<{ rows: MonthlyRow[]; totals: Record<string, number>; monthlyTarget: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const settings = getSalonSettings()
  const monthlyTarget = settings.targets.sales || 3000000

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/management/yearly?year=${year}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const rows = (json.rows || []).map((r: { cashSales: number; consumeSales: number; productSales: number }) => ({
        ...r,
        totalSales: r.cashSales + r.consumeSales + r.productSales,
      }))
      setData({
        rows,
        totals: json.totals || {},
        monthlyTarget: json.monthlyTarget || monthlyTarget,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, monthlyTarget])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const chartData = data?.rows.map(r => ({
    name: r.monthLabel,
    売上: r.cashSales + r.consumeSales + r.productSales,
    目標: monthlyTarget,
  })) ?? []

  const achievementData = data ? [
    { label: '売上', actual: data.totals.totalSales ?? 0, target: monthlyTarget * 12, rate: getAchievementRate(data.totals.totalSales ?? 0, monthlyTarget * 12) },
    { label: '物販', actual: data.totals.productSales ?? 0, target: (settings.targets.productSales || 0) * 12, rate: getAchievementRate(data.totals.productSales ?? 0, (settings.targets.productSales || 0) * 12) },
    { label: '来店数', actual: data.totals.visitors ?? 0, target: (settings.targets.visits || 0) * 12, rate: getAchievementRate(data.totals.visitors ?? 0, (settings.targets.visits || 0) * 12) },
    { label: '新規来店', actual: data.totals.newVisitors ?? 0, target: (settings.targets.newCustomers || 0) * 12, rate: getAchievementRate(data.totals.newVisitors ?? 0, (settings.targets.newCustomers || 0) * 12) },
    { label: '新規予約', actual: data.totals.newReservations ?? 0, target: (settings.targets.newReservations || 0) * 12, rate: getAchievementRate(data.totals.newReservations ?? 0, (settings.targets.newReservations || 0) * 12) },
  ].filter(d => d.target > 0) : []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-main font-serif-jp">売上分析</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
          >
            <ChevronLeft className="w-5 h-5 text-text-main" />
          </button>
          <span className="text-sm font-medium text-text-main min-w-[80px] text-center">{year}年</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
          >
            <ChevronRight className="w-5 h-5 text-text-main" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : data ? (
        <>
          <div className="bg-white rounded-2xl border border-[#E8E0F0] p-6 card-shadow">
            <h3 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rose" />
              月間売上推移（目標ライン付き）
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v: number | undefined) => v != null ? `¥${v.toLocaleString()}` : ''} labelFormatter={l => `${l}`} />
                  <Legend />
                  <ReferenceLine y={monthlyTarget} stroke="#C4728A" strokeDasharray="5 5" label={{ value: '月間目標', position: 'right' }} />
                  <Line type="monotone" dataKey="売上" stroke="#C4728A" strokeWidth={2} dot={{ fill: '#C4728A' }} name="実績" />
                  <Line type="monotone" dataKey="目標" stroke="#9B8EC4" strokeDasharray="5 5" strokeWidth={1.5} name="目標" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E0F0] p-6 card-shadow">
            <h3 className="font-bold text-text-main mb-4">項目別達成率（年間）</h3>
            {achievementData.length === 0 ? (
              <p className="text-sm text-text-sub">目標が設定されていません。サロン設定で目標を設定してください。</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={achievementData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E0F0" />
                    <XAxis type="number" domain={[0, 120]} tickFormatter={v => `${v}%`} stroke="#6B7280" />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} stroke="#6B7280" width={70} />
                    <Tooltip formatter={(v: number | undefined) => v != null ? `${v}%` : ''} />
                    <Bar dataKey="rate" name="達成率" radius={[0, 4, 4, 0]}>
                      {achievementData.map((_, i) => (
                        <Cell key={i} fill={achievementData[i].rate >= 100 ? '#10B981' : achievementData[i].rate >= 80 ? '#3B82F6' : achievementData[i].rate >= 50 ? '#F59E0B' : '#EF4444'} />
                      ))}
                    </Bar>
                    <ReferenceLine x={100} stroke="#9B8EC4" strokeDasharray="3 3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-[#E8E0F0] card-shadow">
              <p className="text-xs text-text-sub mb-0.5">年間売上</p>
              <p className="font-bold text-text-main">¥{(data.totals.totalSales ?? 0).toLocaleString()}</p>
              <p className="text-xs text-text-sub mt-0.5">目標 ¥{(monthlyTarget * 12).toLocaleString()}</p>
              <p className={`text-sm font-medium ${getAchievementColor(getAchievementRate(data.totals.totalSales ?? 0, monthlyTarget * 12))}`}>
                {getAchievementRate(data.totals.totalSales ?? 0, monthlyTarget * 12)}%達成
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E8E0F0] card-shadow">
              <p className="text-xs text-text-sub mb-0.5">月間目標</p>
              <p className="font-bold text-rose">¥{monthlyTarget.toLocaleString()}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
