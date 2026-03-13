'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, ChevronRight, ChevronLeft, Plus, Target, AlertTriangle, Check, X, Loader2, Zap, DollarSign, Users, Calendar } from 'lucide-react'

interface KPISummary {
  year: number; month: number; monthly_target: number; monthly_actual: number
  achievement_rate: number; customer_count: number; lost_count: number
  unique_visitors: number; avg_unit_price: number; days_remaining: number
  gap: number; daily_needed: number
}

interface Sale {
  id: string; sale_date: string; amount: number; customer_name?: string
  menu?: string; staff_name?: string; payment_method: string
}

function AchievementGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#10B981' : rate >= 70 ? '#F59E0B' : '#EF4444'
  const clampedRate = Math.min(rate, 100)
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1E2D42" strokeWidth="12" />
        <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${2 * Math.PI * 50}`}
          strokeDashoffset={`${2 * Math.PI * 50 * (1 - clampedRate / 100)}`}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{rate}%</span>
        <span className="text-xs text-[#4A5568]">達成率</span>
      </div>
    </div>
  )
}

function NewSaleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ sale_date: today, amount: '', customer_name: '', menu: '', staff_name: '', payment_method: 'card' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const MENUS = ['フェイシャル60分', 'フェイシャル90分', 'ボディ60分', 'ボディ90分', '美白コース', 'エイジングケア', 'その他']
  const PAYMENTS = [{ value: 'cash', label: '現金' }, { value: 'card', label: 'カード' }, { value: 'paypay', label: 'PayPay' }, { value: 'line_pay', label: 'LINE Pay' }, { value: 'other', label: 'その他' }]
  async function handleSubmit() {
    if (!form.amount) { setError('金額は必須です'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/kpi/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      onSaved(); onClose()
    } catch { setError('保存に失敗しました') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">売上登録</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">日付</label>
              <input type="date" value={form.sale_date} onChange={e => setForm(p => ({ ...p, sale_date: e.target.value }))} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">金額（円） *</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} onFocus={e => e.target.select()} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" placeholder="15000" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">顧客名</label>
            <input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" placeholder="山田 花子" />
          </div>
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メニュー</label>
            <select value={form.menu} onChange={e => setForm(p => ({ ...p, menu: e.target.value }))} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
              <option value="">選択してください</option>
              {MENUS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">担当スタッフ</label>
              <input value={form.staff_name} onChange={e => setForm(p => ({ ...p, staff_name: e.target.value }))} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" placeholder="田中" />
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">支払方法</label>
              <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {PAYMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#BAE6FD]">
          <button onClick={onClose} className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm hover:text-[#1A202C] transition-colors">キャンセル</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? '登録中...' : '売上を登録'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TargetModal({ year, month, onClose, onSaved }: { year: number; month: number; onClose: () => void; onSaved: () => void }) {
  const [targetAmount, setTargetAmount] = useState('')
  const [saving, setSaving] = useState(false)
  async function handleSubmit() {
    if (!targetAmount) return
    setSaving(true)
    try {
      await fetch('/api/kpi/target', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, target_amount: targetAmount }) })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD]">
          <h2 className="text-base font-bold text-[#1A202C]">{year}年{month}月の目標設定</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <label className="text-xs text-[#4A5568] mb-1 block">月次売上目標（円）</label>
          <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} onFocus={e => e.target.select()} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2] mb-4" placeholder="3000000" />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm">キャンセル</button>
            <button onClick={handleSubmit} disabled={saving || !targetAmount} className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              設定する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function KPIPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [kpi, setKpi] = useState<KPISummary | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [salesSummary, setSalesSummary] = useState<{ cashSales: number; consumeSales: number; serviceLiability: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [showTargetModal, setShowTargetModal] = useState(false)

  const fetchData = useCallback(async () => {
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`
    const endStr = new Date(year, month, 0).toISOString().split('T')[0]
    setLoading(true)
    try {
      const [summaryRes, salesRes] = await Promise.all([
        fetch(`/api/kpi/summary?year=${year}&month=${month}`),
        fetch(`/api/kpi/sales?start=${startStr}&end=${endStr}`),
      ])
      const summaryJson = await summaryRes.json()
      setKpi(summaryJson.error ? null : summaryJson)
      setSales((await salesRes.json()).sales || [])
      setSalesSummary(summaryJson.cashSales != null ? { cashSales: summaryJson.cashSales ?? 0, consumeSales: summaryJson.consumeSales ?? 0, serviceLiability: summaryJson.serviceLiability ?? 0 } : null)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowTargetModal(true)} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-rose text-text-main rounded-lg px-3 py-1.5 text-xs transition-all">
            <Target className="w-3.5 h-3.5" /> 目標設定
          </button>
          <button onClick={() => setShowSaleModal(true)} className="flex items-center gap-1.5 bg-gradient-to-r from-rose to-lavender text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> 売上登録
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] hover:border-purple-500/50 transition-colors"><ChevronLeft className="w-4 h-4 text-[#4A5568]" /></button>
          <h2 className="text-lg font-bold text-[#1A202C]">{year}年{month}月</h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] hover:border-purple-500/50 transition-colors"><ChevronRight className="w-4 h-4 text-[#4A5568]" /></button>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
        ) : kpi ? (
          <>
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-5">
              <div className="flex items-center gap-6">
                <AchievementGauge rate={kpi.achievement_rate} />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-[#4A5568]">月次実績</p>
                    <p className="text-2xl font-black text-[#1A202C]">¥{kpi.monthly_actual.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4A5568]">目標</p>
                    <p className="text-lg font-bold text-[#1A202C]">{kpi.monthly_target > 0 ? `¥${kpi.monthly_target.toLocaleString()}` : '未設定'}</p>
                  </div>
                  {kpi.monthly_target > 0 && kpi.gap > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-300">残り<span className="font-bold">{kpi.days_remaining}日</span>で<span className="font-bold"> ¥{kpi.gap.toLocaleString()}</span> 必要（1日 ¥{kpi.daily_needed.toLocaleString()}）</p>
                    </div>
                  )}
                  {kpi.monthly_target > 0 && kpi.gap <= 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-emerald-300 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> 目標達成！</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {salesSummary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-[#BAE6FD] rounded-xl p-3">
                  <p className="text-xs text-[#4A5568] mb-0.5">💰 着金売上</p>
                  <p className="text-base font-bold text-[#1A202C]">¥{salesSummary.cashSales.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-[#BAE6FD] rounded-xl p-3">
                  <p className="text-xs text-[#4A5568] mb-0.5">✅ 消化売上</p>
                  <p className="text-base font-bold text-rose">¥{salesSummary.consumeSales.toLocaleString()}</p>
                </div>
                <div className="bg-white border border-[#BAE6FD] rounded-xl p-3">
                  <p className="text-xs text-[#4A5568] mb-0.5">📋 役務残（前受金残高）</p>
                  <p className="text-base font-bold text-purple-400">¥{salesSummary.serviceLiability.toLocaleString()}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: 'アクティブ顧客', value: `${kpi.customer_count}名`, color: 'text-blue-400' },
                { icon: AlertTriangle, label: '失客', value: `${kpi.lost_count}名`, color: 'text-red-400' },
                { icon: Calendar, label: '当月来店', value: `${kpi.unique_visitors}名`, color: 'text-emerald-400' },
                { icon: DollarSign, label: '平均客単価', value: `¥${kpi.avg_unit_price.toLocaleString()}`, color: 'text-amber-400' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-3 flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                  <div>
                    <p className="text-xs text-[#4A5568]">{label}</p>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {kpi.monthly_target > 0 && kpi.gap > 0 && (
              <Link href="/leo" className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 hover:border-amber-500/60 rounded-xl py-3 transition-all group">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 group-hover:text-amber-300">経営会議に目標達成の戦略を相談する</span>
              </Link>
            )}
            <div>
              <h3 className="text-sm font-bold text-[#1A202C] mb-3">売上履歴 <span className="text-[#4A5568] font-normal">({sales.length}件)</span></h3>
              {sales.length === 0 ? (
                <div className="text-center py-10 bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl">
                  <TrendingUp className="w-10 h-10 text-[#4A5568] mx-auto mb-2" />
                  <p className="text-[#4A5568] text-sm">この月の売上データがありません</p>
                  <button onClick={() => setShowSaleModal(true)} className="mt-3 text-sm text-amber-400 hover:text-amber-300 underline">売上を登録する</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {sales.map(sale => (
                    <div key={sale.id} className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#1A202C]">¥{sale.amount.toLocaleString()}</span>
                          {sale.menu && <span className="text-xs text-[#4A5568]">{sale.menu}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#4A5568]">{sale.sale_date}</span>
                          {sale.customer_name && <span className="text-xs text-[#4A5568]">{sale.customer_name}</span>}
                          {sale.staff_name && <span className="text-xs text-[#4A5568]">/ {sale.staff_name}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-[#4A5568] bg-white rounded-full px-2 py-0.5">
                        {sale.payment_method === 'cash' ? '現金' : sale.payment_method === 'card' ? 'カード' : sale.payment_method === 'paypay' ? 'PayPay' : sale.payment_method === 'line_pay' ? 'LINE Pay' : 'その他'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

      {showSaleModal && <NewSaleModal onClose={() => setShowSaleModal(false)} onSaved={fetchData} />}
      {showTargetModal && <TargetModal year={year} month={month} onClose={() => setShowTargetModal(false)} onSaved={fetchData} />}
    </div>
  )
}
