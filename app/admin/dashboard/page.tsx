'use client'

import { useState, useEffect } from 'react'
import { Building2, TrendingUp, DollarSign, UserPlus, UserMinus, Activity, AlertTriangle, Trophy, BarChart3, MessageCircle, Megaphone, Calendar } from 'lucide-react'
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
  days_since_creation: number
  monthly_revenue: { month: string; revenue: number }[]
}

type Stats = {
  totalSalons: number
  mrr: number
  arr: number
  newThisMonth: number
  churnThisMonth: number
  churnRate: number
  planDistribution: { plan: string; count: number; ratio: number }[]
  monthlyReservations: { month: string; count: number }[]
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

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return <div className="text-center text-gray-500 py-16">データの取得に失敗しました</div>
  }

  const summaryCards = [
    { label: '契約サロン数', value: formatNumber(stats.totalSalons), sub: '社', icon: Building2, color: '#1a2744' },
    { label: 'MRR', value: formatCurrency(stats.mrr), sub: '月次収益', icon: DollarSign, color: '#C9A84C' },
    { label: 'ARR', value: formatCurrency(stats.arr), sub: '年次収益', icon: TrendingUp, color: '#2d6a4f' },
    { label: '今月の新規契約', value: formatNumber(stats.newThisMonth), sub: '社', icon: UserPlus, color: '#3b82f6' },
    { label: '今月の解約', value: formatNumber(stats.churnThisMonth), sub: '社', icon: UserMinus, color: '#ef4444' },
    { label: 'チャーン率', value: `${stats.churnRate}%`, sub: '今月', icon: Activity, color: stats.churnRate > 5 ? '#ef4444' : '#22c55e' },
  ]

  const activeSalons = stats.salons.filter(s => s.is_active).length
  const activeRate = stats.totalSalons > 0 ? Math.round((activeSalons / stats.totalSalons) * 100) : 0

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* ヘッダー */}
      <div>
        <div className="w-12 h-[3px] bg-gradient-to-r from-[#1a2744] to-[#C9A84C] mb-3 rounded-full" />
        <h2 className="text-2xl font-bold text-[#1a2744]">SOLA 運営ダッシュボード</h2>
        <p className="text-gray-500 text-sm mt-1">全契約サロンの状況を俯瞰します</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 card-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.color + '15' }}>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
            </div>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[10px] text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 中段: プラン分布 + アクティブ率 + 月別予約推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* プラン別分布 */}
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-[#1a2744] mb-4">プラン別分布</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.planDistribution}
                  dataKey="count"
                  nameKey="plan"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {stats.planDistribution.map((entry) => (
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
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="#C9A84C" strokeWidth="8"
                strokeDasharray={`${activeRate * 2.51} ${251 - activeRate * 2.51}`}
                strokeLinecap="round"
              />
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

        {/* 月別予約推移 */}
        <div className="bg-white rounded-2xl p-6 card-shadow">
          <h3 className="text-sm font-semibold text-[#1a2744] mb-4">月別予約数推移</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyReservations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={v => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(value) => [`${value}件`, '予約数']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#C9A84C' }}
                  activeDot={{ r: 5, fill: '#1a2744' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Level 2: 導入効果 - サロン別月別売上推移 */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1a2744]">導入効果 — サロン別売上推移（直近6ヶ月）</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats.salons.slice(0, 6).map(salon => {
              const totalRevenue = salon.monthly_revenue.reduce((s, m) => s + m.revenue, 0)
              return (
                <div key={salon.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#1a2744] to-[#C9A84C] flex items-center justify-center text-white text-[10px] font-bold">
                        {salon.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{salon.name || '未設定'}</p>
                        <p className="text-[10px] text-gray-400">{salon.plan} • 累計 {formatCurrency(totalRevenue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salon.monthly_revenue}>
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                        <Tooltip formatter={(value) => [formatCurrency(value as number), '売上']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                        <Bar dataKey="revenue" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
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
                  {/* ランク */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-200 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {i + 1}
                  </div>

                  {/* サロン情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{salon.name || '未設定'}</span>
                      <span className="text-xs font-semibold text-[#1a2744] ml-2 shrink-0">{salon.engagement.score}pt</span>
                    </div>
                    {/* スコアバー */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-[#1a2744] to-[#C9A84C]" style={{ width: `${barWidth}%` }} />
                    </div>
                    {/* 内訳 */}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 予約 {salon.engagement.reservations}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> LINE {salon.engagement.line_messages}
                      </span>
                      <span className="flex items-center gap-1">
                        <Megaphone className="w-3 h-3" /> SNS {salon.engagement.sns_posts}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" /> AI {salon.engagement.counseling}
                      </span>
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
      <div className={`rounded-2xl card-shadow overflow-hidden ${
        stats.churnRiskSalons.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-white'
      }`}>
        <div className="px-6 py-4 border-b border-red-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${stats.churnRiskSalons.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <h3 className="text-sm font-semibold text-[#1a2744]">解約リスクアラート</h3>
            </div>
            {stats.churnRiskSalons.length > 0 && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                {stats.churnRiskSalons.length}社 要フォロー
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            過去30日間予約0件 / 機能未使用 / 契約90日以上経過
          </p>
        </div>
        <div className="divide-y divide-red-100">
          {stats.churnRiskSalons.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <Activity className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm text-green-600 font-medium">解約リスクのあるサロンはありません</p>
              <p className="text-xs text-gray-400 mt-1">全サロンが順調に稼働中です</p>
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">{salon.plan}</span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[10px] text-gray-500">契約{salon.days_since_creation}日目</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="text-center">
                        <p className="text-red-500 font-bold">{salon.engagement.reservations}</p>
                        <p className="text-gray-400">予約</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-500 font-bold">{salon.engagement.line_messages}</p>
                        <p className="text-gray-400">LINE</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-500 font-bold">{salon.engagement.sns_posts}</p>
                        <p className="text-gray-400">SNS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-500 font-bold">{salon.engagement.counseling}</p>
                        <p className="text-gray-400">AI</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* サロン一覧テーブル */}
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
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">最終活動</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">予約数</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.salons.map(salon => (
                <tr key={salon.id} className={`hover:bg-gray-50/50 transition-colors ${salon.is_churn_risk ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                        salon.is_churn_risk ? 'bg-red-400' : 'bg-gradient-to-r from-[#1a2744] to-[#C9A84C]'
                      }`}>
                        {salon.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{salon.name || '未設定'}</span>
                        {salon.is_churn_risk && (
                          <span className="ml-2 text-[10px] text-red-500 font-semibold">⚠ 要フォロー</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: (PLAN_COLORS[salon.plan] || '#94a3b8') + '15',
                        color: PLAN_COLORS[salon.plan] || '#94a3b8',
                      }}
                    >
                      {salon.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(salon.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(salon.last_activity).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-700">
                    {formatNumber(salon.reservation_count)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      salon.is_churn_risk
                        ? 'bg-red-100 text-red-600'
                        : salon.is_active
                          ? 'bg-green-50 text-green-600'
                          : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        salon.is_churn_risk ? 'bg-red-500' : salon.is_active ? 'bg-green-500' : 'bg-yellow-400'
                      }`} />
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
