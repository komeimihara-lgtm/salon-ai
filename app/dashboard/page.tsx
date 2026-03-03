import Link from 'next/link'
import { Sparkles, Users, Calendar, TrendingUp, ArrowRight } from 'lucide-react'

const NAV_ITEMS = [
  {
    href: '/leo',
    icon: Sparkles,
    label: 'LEO GRANT 経営会議',
    desc: '経営参謀AIとリアルタイム相談',
    color: 'from-amber-500 to-orange-600',
    badge: 'LIVE',
  },
  {
    href: '/customers',
    icon: Users,
    label: '顧客管理',
    desc: 'カルテ・来店履歴・CSV移行',
    color: 'from-blue-500 to-indigo-600',
    badge: 'LIVE',
  },
  {
    href: '/reservations',
    icon: Calendar,
    label: '予約管理',
    desc: 'カレンダー・リマインド自動送信',
    color: 'from-emerald-500 to-teal-600',
    badge: 'LIVE',
  },
  {
    href: '/kpi',
    icon: TrendingUp,
    label: 'KPI・売上管理',
    desc: '予実管理・達成アラート',
    color: 'from-purple-500 to-violet-600',
    badge: '準備中',
  },
]

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0F1923] flex flex-col">
      {/* ヘッダー */}
      <header className="bg-[#1A2535] border-b border-[#2E3F5C] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">SALON AI</h1>
            <p className="text-xs text-slate-400">by LENARD Corporation</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">エステサロン ルミエール</p>
            <p className="text-xs text-amber-400 font-semibold">PROプラン</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* ウェルカム */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">おはようございます、KOMEIさん</h2>
          <p className="text-slate-400 text-sm">今日も一緒に売上を作りましょう。LEOが待っています。</p>
        </div>

        {/* 緊急アラート */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-bold">緊急：</span>3ヶ月未来店の失客が23名います。今月中に手を打てます。
          </p>
          <Link href="/leo" className="ml-auto flex-shrink-0 text-xs text-red-400 hover:text-red-300 font-semibold underline">
            LEOに相談
          </Link>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {NAV_ITEMS.map(({ href, icon: Icon, label, desc, color, badge }) => (
            <Link
              key={href}
              href={href}
              className="group bg-[#1A2535] hover:bg-[#1E2D42] border border-[#2E3F5C] hover:border-[#3E5080] rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  badge === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{label}</h3>
              <p className="text-xs text-slate-400">{desc}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                <span>開く</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
