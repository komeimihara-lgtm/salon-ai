'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  BarChart2,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { getSalonSettings } from '@/lib/salon-settings'
import { getDailyTarget, getWorkingDaysInMonth, getAchievementRate, getAchievementColor } from '@/lib/goals'

type DailyRow = {
  date: string
  dayOfWeek: string
  cashSales: number
  consumeSales: number
  productSales: number
  serviceLiability: number
  visitors: number
  unitPrice: number
  newVisitors: number
  newReservations: number
}

type MonthlyRow = {
  month: number
  monthLabel: string
  cashSales: number
  consumeSales: number
  productSales: number
  serviceLiability: number
  visitors: number
  unitPrice: number
  newVisitors: number
  newReservations: number
  achievementRate: number
}

function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function printToPDF(title: string) {
  const printContent = document.getElementById('print-area')
  if (!printContent) return
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>${title}</title>
    <style>
      body{font-family:sans-serif;padding:20px;font-size:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#f5f5f5}
      .total{font-weight:bold;background:#f0f0f0}
    </style>
    </head>
    <body>${printContent.innerHTML}</body>
    </html>
  `)
  win.document.close()
  win.print()
  win.close()
}

export default function ManagementPage() {
  const now = new Date()
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [dailyData, setDailyData] = useState<{
    rows: DailyRow[]
    totals: Record<string, number>
    monthlyTarget: number
    achievementRate: number
  } | null>(null)
  const [yearlyData, setYearlyData] = useState<{
    rows: MonthlyRow[]
    totals: Record<string, number>
    monthlyTarget: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [advice, setAdvice] = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)

  const settings = getSalonSettings()
  const monthlyTarget = settings.targets.sales || 3000000
  const workingDays = getWorkingDaysInMonth(year, month)
  const dailyTarget = getDailyTarget(monthlyTarget, workingDays)

  const fetchDaily = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/management/monthly?year=${year}&month=${month}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setDailyData({
        rows: json.rows,
        totals: json.totals,
        monthlyTarget: json.monthlyTarget || monthlyTarget,
        achievementRate: json.achievementRate ?? 0,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, month, monthlyTarget])

  const fetchYearly = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/management/yearly?year=${year}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setYearlyData({
        rows: json.rows,
        totals: json.totals,
        monthlyTarget: json.monthlyTarget || monthlyTarget,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, monthlyTarget])

  useEffect(() => {
    if (tab === 'daily') fetchDaily()
    else fetchYearly()
  }, [tab, fetchDaily, fetchYearly])

  const handleAdvice = async () => {
    setAdviceLoading(true)
    setAdvice('')
    try {
      const data = tab === 'daily' ? dailyData : yearlyData
      if (!data) return
      const targets = {
        sales: settings.targets.sales,
        visits: settings.targets.visits,
        avgPrice: settings.targets.avgPrice,
        productSales: settings.targets.productSales,
        newCustomers: settings.targets.newCustomers,
        newReservations: settings.targets.newReservations,
      }
      const payload = tab === 'daily'
        ? { type: 'monthly', data: { year, month, rows: (data as { rows: DailyRow[] }).rows, totals: data.totals, monthlyTarget: data.monthlyTarget, targets } }
        : { type: 'yearly', data: { year, rows: (data as { rows: MonthlyRow[] }).rows, totals: data.totals, monthlyTarget: data.monthlyTarget, targets } }
      const res = await fetch('/api/management/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAdvice(json.advice || '')
    } catch (e) {
      setAdvice('アドバイスの生成に失敗しました。')
    } finally {
      setAdviceLoading(false)
    }
  }

  const exportDailyCSV = () => {
    if (!dailyData) return
    const headers = ['日付', '曜日', '着金売上', '消化売上', '物販売上', '役務残', '来店人数', '施術単価', '新規来店', '新規予約']
    const rows = dailyData.rows.map(r => [
      r.date,
      r.dayOfWeek,
      String(r.cashSales),
      String(r.consumeSales),
      String(r.productSales),
      String(r.serviceLiability),
      String(r.visitors),
      String(r.unitPrice),
      String(r.newVisitors),
      String(r.newReservations),
    ])
    rows.push(['合計', '', String(dailyData.totals.cashSales ?? 0), String(dailyData.totals.consumeSales ?? 0), String(dailyData.totals.productSales ?? 0), '', String(dailyData.totals.visitors ?? 0), '', String(dailyData.totals.newVisitors ?? 0), String(dailyData.totals.newReservations ?? 0)])
    downloadCSV(headers, rows, `経営管理_${year}年${month}月.csv`)
  }

  const exportYearlyCSV = () => {
    if (!yearlyData) return
    const headers = ['月', '着金売上', '消化売上', '物販売上', '役務残', '来店人数', '施術単価', '新規来店', '新規予約', '目標達成率']
    const rows = yearlyData.rows.map(r => [
      r.monthLabel,
      String(r.cashSales),
      String(r.consumeSales),
      String(r.productSales),
      String(r.serviceLiability),
      String(r.visitors),
      String(r.unitPrice),
      String(r.newVisitors),
      String(r.newReservations),
      `${r.achievementRate}%`,
    ])
    const t = yearlyData.totals
    rows.push(['年間合計', String(t.cashSales ?? 0), String(t.consumeSales ?? 0), String(t.productSales ?? 0), '', String(t.visitors ?? 0), String(t.avgUnitPrice ?? 0), String(t.newVisitors ?? 0), String(t.newReservations ?? 0), `${t.avgAchievementRate ?? 0}%`])
    downloadCSV(headers, rows, `経営管理_${year}年.csv`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('daily')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'daily' ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-white border border-gray-200 text-text-main hover:bg-light-lav'
            }`}
          >
            日次一覧
          </button>
          <button
            onClick={() => setTab('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'monthly' ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-white border border-gray-200 text-text-main hover:bg-light-lav'
            }`}
          >
            月報
          </button>
        </div>

        <div className="flex items-center gap-3">
          {tab === 'daily' ? (
            <>
              <button
                onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
              >
                <ChevronLeft className="w-5 h-5 text-text-main" />
              </button>
              <span className="text-sm font-bold text-text-main min-w-[120px] text-center">
                {year}年{month}月
              </span>
              <button
                onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
              >
                <ChevronRight className="w-5 h-5 text-text-main" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setYear(y => y - 1)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
              >
                <ChevronLeft className="w-5 h-5 text-text-main" />
              </button>
              <span className="text-sm font-bold text-text-main min-w-[80px] text-center">{year}年</span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
              >
                <ChevronRight className="w-5 h-5 text-text-main" />
              </button>
            </>
          )}
          <button
            onClick={tab === 'daily' ? exportDailyCSV : exportYearlyCSV}
            disabled={loading || (tab === 'daily' ? !dailyData : !yearlyData)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav text-sm"
          >
            <FileDown className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => printToPDF(tab === 'daily' ? `${year}年${month}月 経営データ` : `${year}年 経営データ`)}
            disabled={loading || (tab === 'daily' ? !dailyData : !yearlyData)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav text-sm"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E0F0] overflow-hidden card-shadow">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
        <div className="p-4 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-rose animate-spin" />
            </div>
          ) : tab === 'daily' && dailyData ? (
            <div id="print-area">
              <div className="mb-4 p-3 rounded-xl bg-light-lav/50 text-sm">
                <p className="text-text-sub">日次目標（月間目標÷営業日数）: ¥{dailyTarget.toLocaleString()} / 営業日数: {workingDays}日</p>
              </div>
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-light-lav/50">
                    <th className="p-2 text-left font-medium text-text-sub">日付</th>
                    <th className="p-2 text-left font-medium text-text-sub">曜日</th>
                    <th className="p-2 text-right font-medium text-text-sub">着金売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">消化売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">物販売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">役務残</th>
                    <th className="p-2 text-right font-medium text-text-sub">来店人数</th>
                    <th className="p-2 text-right font-medium text-text-sub">施術単価</th>
                    <th className="p-2 text-right font-medium text-text-sub">新規来店</th>
                    <th className="p-2 text-right font-medium text-text-sub">新規予約</th>
                    <th className="p-2 text-right font-medium text-text-sub">月間達成率</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.rows.map((r, i) => (
                    <tr key={r.date} className={i % 2 === 0 ? 'bg-white' : 'bg-off-white'}>
                      <td className="p-2">{r.date.slice(8)}</td>
                      <td className="p-2">{r.dayOfWeek}</td>
                      <td className="p-2 text-right">¥{r.cashSales.toLocaleString()}</td>
                      <td className="p-2 text-right">¥{r.consumeSales.toLocaleString()}</td>
                      <td className="p-2 text-right">¥{r.productSales.toLocaleString()}</td>
                      <td className="p-2 text-right">¥{r.serviceLiability.toLocaleString()}</td>
                      <td className="p-2 text-right">{r.visitors}</td>
                      <td className="p-2 text-right">¥{r.unitPrice.toLocaleString()}</td>
                      <td className="p-2 text-right">{r.newVisitors}</td>
                      <td className="p-2 text-right">{r.newReservations}</td>
                      <td className="p-2 text-right">-</td>
                    </tr>
                  ))}
                  <tr className="total bg-rose/5 font-semibold">
                    <td className="p-2" colSpan={2}>合計・平均</td>
                    <td className="p-2 text-right">¥{(dailyData.totals.cashSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">¥{(dailyData.totals.consumeSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">¥{(dailyData.totals.productSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">¥{dailyData.rows[0]?.serviceLiability.toLocaleString() ?? 0}</td>
                    <td className="p-2 text-right">{dailyData.totals.visitors ?? 0} <span className="text-xs font-normal">/ 目標{settings.targets.visits}</span></td>
                    <td className="p-2 text-right">
                      ¥{((dailyData.totals.visitors ?? 0) > 0 ? Math.round((dailyData.totals.consumeSales ?? 0) / (dailyData.totals.visitors ?? 1)) : 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right">{dailyData.totals.newVisitors ?? 0} <span className="text-xs font-normal">/ {settings.targets.newCustomers ?? 0}</span></td>
                    <td className="p-2 text-right">{dailyData.totals.newReservations ?? 0} <span className="text-xs font-normal">/ {settings.targets.newReservations ?? 0}</span></td>
                    <td className={`p-2 text-right ${getAchievementColor(dailyData.achievementRate)}`}>目標対比 {dailyData.achievementRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : tab === 'monthly' && yearlyData ? (
            <div id="print-area">
              <div className="mb-4 p-3 rounded-xl bg-light-lav/50 text-sm flex flex-wrap gap-4">
                <span className="text-text-sub">月間目標: ¥{monthlyTarget.toLocaleString()}</span>
                <span className="text-text-sub">年間目標: ¥{(monthlyTarget * 12).toLocaleString()}</span>
                <span className={getAchievementColor(getAchievementRate((yearlyData.totals.totalSales ?? 0), monthlyTarget * 12))}>
                  年間実績: ¥{(yearlyData.totals.totalSales ?? 0).toLocaleString()}（達成率 {getAchievementRate((yearlyData.totals.totalSales ?? 0), monthlyTarget * 12)}%）
                </span>
              </div>
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-light-lav/50">
                    <th className="p-2 text-left font-medium text-text-sub">月</th>
                    <th className="p-2 text-right font-medium text-text-sub">着金売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">消化売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">物販売上</th>
                    <th className="p-2 text-right font-medium text-text-sub">役務残</th>
                    <th className="p-2 text-right font-medium text-text-sub">来店人数</th>
                    <th className="p-2 text-right font-medium text-text-sub">施術単価</th>
                    <th className="p-2 text-right font-medium text-text-sub">新規来店</th>
                    <th className="p-2 text-right font-medium text-text-sub">新規予約</th>
                    <th className="p-2 text-right font-medium text-text-sub">目標達成率</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyData.rows.map((r, i) => (
                    <tr key={r.month} className={i % 2 === 0 ? 'bg-white' : 'bg-off-white'}>
                      <td className="p-2">{r.monthLabel}</td>
                      <td className="p-2 text-right">¥{r.cashSales.toLocaleString()} <span className="text-xs text-text-sub">/ ¥{monthlyTarget.toLocaleString()}</span></td>
                      <td className="p-2 text-right">¥{r.consumeSales.toLocaleString()}</td>
                      <td className="p-2 text-right">¥{r.productSales.toLocaleString()} <span className="text-xs text-text-sub">/ ¥{(settings.targets.productSales ?? 0).toLocaleString()}</span></td>
                      <td className="p-2 text-right">¥{r.serviceLiability.toLocaleString()}</td>
                      <td className="p-2 text-right">{r.visitors} <span className="text-xs text-text-sub">/ {settings.targets.visits}</span></td>
                      <td className="p-2 text-right">¥{r.unitPrice.toLocaleString()} <span className="text-xs text-text-sub">/ ¥{(settings.targets.avgPrice ?? 0).toLocaleString()}</span></td>
                      <td className="p-2 text-right">{r.newVisitors} <span className="text-xs text-text-sub">/ {settings.targets.newCustomers ?? 0}</span></td>
                      <td className="p-2 text-right">{r.newReservations} <span className="text-xs text-text-sub">/ {settings.targets.newReservations ?? 0}</span></td>
                      <td className={`p-2 text-right ${getAchievementColor(r.achievementRate)}`}>{r.achievementRate}%</td>
                    </tr>
                  ))}
                  <tr className="total bg-rose/5 font-semibold">
                    <td className="p-2">年間合計・平均</td>
                    <td className="p-2 text-right">¥{(yearlyData.totals.cashSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">¥{(yearlyData.totals.consumeSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">¥{(yearlyData.totals.productSales ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">-</td>
                    <td className="p-2 text-right">{yearlyData.totals.visitors ?? 0}</td>
                    <td className="p-2 text-right">¥{(yearlyData.totals.avgUnitPrice ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right">{yearlyData.totals.newVisitors ?? 0}</td>
                    <td className="p-2 text-right">{yearlyData.totals.newReservations ?? 0}</td>
                    <td className={`p-2 text-right ${getAchievementColor(getAchievementRate((yearlyData.totals.totalSales ?? 0), monthlyTarget * 12))}`}>
                      {getAchievementRate((yearlyData.totals.totalSales ?? 0), monthlyTarget * 12)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E0F0] p-6 card-shadow">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-rose" />
          <h3 className="font-bold text-text-main">AIアドバイス</h3>
        </div>
        <button
          onClick={handleAdvice}
          disabled={adviceLoading || (tab === 'daily' ? !dailyData : !yearlyData)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {adviceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {tab === 'daily' ? '経営会議用アドバイスを生成' : '年間経営レポートを生成'}
        </button>
        {advice && (
          <div className="mt-4 p-4 rounded-xl bg-light-lav/50 border border-rose/20 whitespace-pre-wrap text-sm text-text-main">
            {advice}
          </div>
        )}
      </div>
    </div>
  )
}
