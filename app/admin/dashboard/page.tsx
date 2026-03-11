'use client'

import { useState, useEffect } from 'react'
import { Building2, TrendingUp, TrendingDown, DollarSign, UserPlus, UserMinus, Activity, AlertTriangle, Trophy, BarChart3, MessageCircle, Megaphone, Calendar, Bot } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'

type Engagement = {
  counseling: number
  line_messages: number
  sns_posts: number
  reservations: number
  score: number
}

type SalonDetail = {
  id: string
  name: string
  plan: string
  created_at: string
  last_activity: string
  reservation_count: number
  recent_reservations: number
  is_active: boolean
  engagement: Engagement
  is_churn_risk: boolean
  risk_reasons: string[]
  days_since_creation: number
  mrr_contribution: number
  monthly_revenue: { month: string; revenue: number }[]
}

type Stats = {
  error?: string
  totalSalons: number
  mrr: number
  arr: number
  newThisMonth: number
  churnThisMonth: number
  churnRate: number
  planDistribution: { plan: string; count: number; ratio: number }[]
  monthlyReservations: { month: string; count: number; revenue: number }[]
  salons: SalonDetail[]
  engagementRanking: SalonDetail[]
  churnRiskSalons: SalonDetail[]
}

const PLAN_COLORS: Record<string, string> = {
  LITE: '#64748b',
  PRO: '#C9A84C',
  MAX: '#1a2744',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n)
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('ja-JP').format(n)
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async r => {
        if (!r.ok) {
          const text = await r.text().catch(() => '')
          throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`)
        }
        return r.json()
      })
      .then(d => {
        if (d.error) {
          setErrorMsg(d.error)
        } else {
          setStats(d)
        }
      })
      .catch(e => {
        console.error('Admin stats fetch error:', e)
        setErrorMsg(e.message || 'ネットワークエラー')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats || !stats.salons) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">データの取得に失敗しました</p>
        {errorMsg && <p className="text-xs text-red-400 mt-2">{errorMsg}</p>}
      </div>
    )
  }

  const summaryCards = [
    { label: '契約サロン数', value: formatNumber(stats.totalSalons), sub: '社', icon: Building2, color: '#1a2744' },
    { label: 'MRR', value: formatCurrency(stats.mrr), sub: '月次収益', icon: DollarSign, color: '#C9A84C' },
    { label: 'ARR', value: formatCurrency(stats.arr), sub: '年次収益', icon: TrendingUp, color: '#2d6a4f' },
    { label: 'チャーン率', value: `${stats.churnRate}%`, sub: `解約 ${stats.churnThisMonth}社 / 新規 ${stats.newThisMonth}社`, icon: Activity, color: stats.churnRate > 5 ? '#ef4444' : '#22c55e' },
  ]

  const activeSalons = stats.salons.filter(s => s.is_active).length
  const activeRate = stats.totalSalons > 0 ? Math.round((activeSalons / stats.totalSalons) * 100) : 0

  // 売上トップ5（前月比付き）
  const revenueTop5 = [...stats.salons]
    .map(s => {
      const rev = s.monthly_revenue
      const current = rev[rev.length - 1]?.revenue || 0
      const prev = rev[rev.length - 2]?.revenue || 0
      const diff = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0
      return { ...s, currentRevenue: current, prevRevenue: prev, revenueDiff: diff }
    })
    .sort((a, b) => b.currentRevenue - a.currentRevenue)
    .slice(0, 5)

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* ヘッダー */}
      <div>
        <div className="w-12 h-[3px] bg-gradient-to-r from-[#1a2744] to-[#C9A84C] mb-3 rounded-full" />
        <h2 className="text-2xl font-bold text-[#1a2744]">SOLA 運営ダッシュボード</h2>
        <p className="text-gray-500 text-sm mt-1">全契約サロンの状況を俯瞰します</p>
      </div>

      {/* Level 1: サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-5 card-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.color + '15' }}>
                <c.icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[11px] text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* プラン分布 + アクティブ率 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* プラン別分布 */}
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-[#1a2744] mb-4">プラン別分布</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.planDistribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70} innerRadius={40} strokeWidth={2} stroke="#fff">
                  {stats.planDistribution.map(entry => (
                    <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}社`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {stats.planDistribution.map(p => (
              <div key={p.plan} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.plan] || '#94a3b8' }} />
                  <span className="text-gray-600">{p.plan}</span>
                </div>
                <span className="font-medium text-[#1a2744]">{p.count}社 ({p.ratio}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* アクティブ率 */}
        <div className="bg-white rounded-2xl p-6 card-shadow flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-[#1a2744] mb-4">アクティブ率</h3>
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#C9A84C" strokeWidth="8"
                strokeDasharray={`${activeRate * 2.51} ${251 - activeRate * 2.51}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#1a2744]">{activeRate}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            <span className="font-semibold text-[#C9A84C]">{activeSalons}</span> / {stats.totalSalons} サロン
          </p>
          <p className="text-xs text-gray-400 mt-1">過去30日以内に予約あり</p>
        </div>

        {/* 月別予約数・売上推移（2軸） */}
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-[#1a2744] mb-4">月別予約数・売上推移</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyReservations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `${Math.round(v / 10000)}万`} />
                <Tooltip formatter={(value, name) => [name === 'revenue' ? formatCurrency(value as number) : `${value}件`, name === 'revenue' ? '売上' : '予約数']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3, fill: '#C9A84C' }} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#1a2744" strokeWidth={2} dot={{ r: 3, fill: '#1a2744' }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#C9A84C] inline-block" /> 予約数</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#1a2744] inline-block border-dashed" /> 売上</span>
          </div>
        </div>
      </div>

      {/* Level 2: 導入効果トップ5 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1a2744]">導入効果 — 売上トップ5サロン（今月）</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {revenueTop5.map((salon, i) => (
            <div key={salon.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{salon.name || '未設定'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: (PLAN_COLORS[salon.plan] || '#94a3b8') + '15', color: PLAN_COLORS[salon.plan] }}>{salon.plan}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#1a2744]">{formatCurrency(salon.currentRevenue)}</p>
                  <div className="flex items-center gap-1 justify-end">
                    {salon.revenueDiff > 0 ? (
                      <span className="text-[10px] text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{salon.revenueDiff}%</span>
                    ) : salon.revenueDiff < 0 ? (
                      <span className="text-[10px] text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{salon.revenueDiff}%</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">±0%</span>
                    )}
                    <span className="text-[10px] text-gray-400">vs先月</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Level 3: 機能エンゲージメントランキング */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1a2744]">機能エンゲージメントランキング（直近30日）</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.engagementRanking.map((salon, i) => {
            const maxScore = stats.engagementRanking[0]?.engagement.score || 1
            const barWidth = Math.max(5, (salon.engagement.score / maxScore) * 100)
            return (
              <div key={salon.id} className="px-6 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{salon.name || '未設定'}</span>
                      <span className="text-xs font-semibold text-[#1a2744] ml-2 shrink-0">{salon.engagement.score}pt</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-[#1a2744] to-[#C9A84C]" style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 予約 {salon.engagement.reservations}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> LINE {salon.engagement.line_messages}</span>
                      <span className="flex items-center gap-1"><Megaphone className="w-3 h-3" /> SNS {salon.engagement.sns_posts}</span>
                      <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> AI {salon.engagement.counseling}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {stats.engagementRanking.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">データがありません</div>
          )}
        </div>
      </div>

      {/* Level 4: 解約リスクアラート */}
      <div className={`rounded-2xl card-shadow overflow-hidden ${stats.churnRiskSalons.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
        <div className="px-6 py-4 border-b border-red-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${stats.churnRiskSalons.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <h3 className="text-sm font-semibold text-[#1a2744]">解約リスクアラート</h3>
            </div>
            {stats.churnRiskSalons.length > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">{stats.churnRiskSalons.length}社 要フォロー</span>
            )}
          </div>
        </div>
        <div className="divide-y divide-red-100">
          {stats.churnRiskSalons.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm text-green-600 font-medium">解約リスクのあるサロンはありません</p>
            </div>
          ) : (
            stats.churnRiskSalons.map(salon => (
              <div key={salon.id} className="px-6 py-4 hover:bg-red-100/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-200 flex items-center justify-center text-red-600 text-sm font-bold">
                      {salon.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{salon.name || '未設定'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {salon.risk_reasons.map((reason, ri) => (
                          <span key={ri} className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{reason}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-500">{salon.plan} • 契約{salon.days_since_creation}日</p>
                    <p className="text-xs font-medium text-gray-600">{formatCurrency(salon.mrr_contribution)}/月</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 全サロン一覧テーブル */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-[#1a2744]">契約サロン一覧</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">サロン名</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">プラン</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">契約日</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">MRR貢献</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">予約数</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">スコア</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.salons.map(salon => (
                <tr key={salon.id} className={`hover:bg-gray-50/50 transition-colors ${salon.is_churn_risk ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${salon.is_churn_risk ? 'bg-red-400' : 'bg-gradient-to-r from-[#1a2744] to-[#C9A84C]'}`}>
                        {salon.name?.charAt(0) || 'S'}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{salon.name || '未設定'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: (PLAN_COLORS[salon.plan] || '#94a3b8') + '15', color: PLAN_COLORS[salon.plan] || '#94a3b8' }}>
                      {salon.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(salon.created_at).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{formatCurrency(salon.mrr_contribution)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">{formatNumber(salon.reservation_count)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold text-[#1a2744]">{salon.engagement.score}pt</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      salon.is_churn_risk ? 'bg-red-100 text-red-600' : salon.is_active ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${salon.is_churn_risk ? 'bg-red-500' : salon.is_active ? 'bg-green-500' : 'bg-yellow-400'}`} />
                      {salon.is_churn_risk ? '要フォロー' : salon.is_active ? 'アクティブ' : '非アクティブ'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
