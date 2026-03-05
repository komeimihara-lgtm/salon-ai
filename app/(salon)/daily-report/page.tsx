'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen,
  Calendar,
  Loader2,
  Sparkles,
  Save,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type Report = {
  id: string
  report_date: string
  kpi_data: Record<string, unknown>
  ai_content: string | null
  edited_content: string | null
  created_at: string
}

type KpiData = {
  cashSales: number
  consumeSales: number
  serviceLiability: number
  visitors: number
  unitPrice: number
  newVisitors: number
  newReservations: number
  totalReservations: number
  completedReservations: number
  taskCompletionRate: number
}

export default function DailyReportPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [aiContent, setAiContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<Report[]>([])

  const fetchKpiAndReport = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiRes, reportRes] = await Promise.all([
        fetch(`/api/daily-report/kpi?date=${selectedDate}`),
        fetch(`/api/daily-report?date=${selectedDate}`),
      ])
      const kpiJson = await kpiRes.json()
      const reportJson = await reportRes.json()

      if (kpiJson.error) throw new Error(kpiJson.error)
      setKpiData(kpiJson)

      const r = reportJson.report
      setReport(r || null)
      setEditedContent(r?.edited_content || r?.ai_content || '')
      setAiContent(r?.ai_content || '')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/daily-report')
    const json = await res.json()
    setHistory(json.reports || [])
  }, [])

  useEffect(() => {
    fetchKpiAndReport()
  }, [fetchKpiAndReport])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleGenerateAi = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/daily-report/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiContent(json.advice || '')
      setEditedContent(json.advice || '')
    } catch (e) {
      setEditedContent('AI日報の生成に失敗しました。')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_date: selectedDate,
          kpi_data: kpiData,
          ai_content: aiContent,
          edited_content: editedContent,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setReport(json.report)
      fetchHistory()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-light-lav"
          >
            <ChevronLeft className="w-5 h-5 text-text-main" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
          />
          <button
            onClick={() => changeDate(1)}
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
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpiData && [
              { label: '着金売上', value: `¥${kpiData.cashSales.toLocaleString()}`, color: 'text-[#1A202C]' },
              { label: '消化売上', value: `¥${kpiData.consumeSales.toLocaleString()}`, color: 'text-rose' },
              { label: '役務残', value: `¥${kpiData.serviceLiability.toLocaleString()}`, color: 'text-lavender' },
              { label: '来店人数', value: `${kpiData.visitors}名`, color: 'text-emerald-600' },
              { label: '施術単価', value: `¥${kpiData.unitPrice.toLocaleString()}`, color: 'text-amber-600' },
              { label: '新規来店', value: `${kpiData.newVisitors}名`, color: 'text-blue-600' },
              { label: '新規予約', value: `${kpiData.newReservations}件`, color: 'text-blue-600' },
              { label: 'タスク完了', value: `${kpiData.completedReservations}/${kpiData.totalReservations} (${kpiData.taskCompletionRate}%)`, color: 'text-text-main' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl p-4 border border-[#E8E0F0] card-shadow">
                <p className="text-xs text-text-sub mb-0.5">{label}</p>
                <p className={`font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E0F0] p-6 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-main flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose" />
                AI日報
              </h3>
              <button
                onClick={handleGenerateAi}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI日報を生成
              </button>
            </div>
            <textarea
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              placeholder="AI日報を生成するか、手動で入力してください"
              rows={12}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-rose outline-none resize-none text-sm"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E0F0] p-6 card-shadow">
            <h3 className="font-bold text-text-main mb-4">過去の日報（直近30日）</h3>
            {history.length === 0 ? (
              <p className="text-sm text-text-sub">日報はまだありません</p>
            ) : (
              <ul className="space-y-2">
                {history.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => setSelectedDate(r.report_date)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-light-lav/50 cursor-pointer border border-transparent hover:border-rose/20"
                  >
                    <span className="font-medium">{r.report_date}</span>
                    <span className="text-xs text-text-sub">
                      {r.edited_content || r.ai_content ? '作成済み' : '未作成'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
