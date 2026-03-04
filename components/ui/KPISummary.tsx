'use client'

import { SalonKPI } from '@/types'

interface KPISummaryProps {
  kpi: SalonKPI
  salonName: string
}

export default function KPISummary({ kpi, salonName }: KPISummaryProps) {
  const achievementRate = Math.round((kpi.monthly_actual / kpi.monthly_target) * 100)
  const gap = kpi.monthly_target - kpi.monthly_actual
  const dailyNeeded = Math.round(gap / kpi.days_remaining)

  const rateColor =
    achievementRate >= 90 ? 'text-emerald-600' :
    achievementRate >= 70 ? 'text-amber-600' :
    'text-red-600'

  const cards = [
    {
      label: '月次達成率',
      value: `${achievementRate}%`,
      sub: `目標 ¥${(kpi.monthly_target / 10000).toFixed(0)}万`,
      color: rateColor,
    },
    {
      label: '月次実績',
      value: `¥${(kpi.monthly_actual / 10000).toFixed(0)}万`,
      sub: `ギャップ ¥${(gap / 10000).toFixed(0)}万`,
      color: 'text-[#9B8EC4]',
    },
    {
      label: '残日数・必要日商',
      value: `残${kpi.days_remaining}日`,
      sub: `1日 ¥${(dailyNeeded / 10000).toFixed(1)}万必要`,
      color: 'text-[#9B8EC4]',
    },
    {
      label: '失客アラート',
      value: `${kpi.lost_customers}名`,
      sub: '3ヶ月未来店',
      color: 'text-red-600',
    },
  ]

  return (
    <div className="bg-white border border-[#E8E0F0] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-[#6B7280] font-medium">{salonName} — リアルタイムKPI</span>
        </div>
        <span className="text-xs text-[#6B7280]">AI経営会議が監視中</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#F8F5FF] border border-[#E8E0F0] rounded-lg p-3">
            <p className="text-xs text-[#6B7280] mb-1">{card.label}</p>
            <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-[#6B7280] mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
