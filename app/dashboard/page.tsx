'use client'

import Link from 'next/link'
import { Sparkles, Users, Calendar, TrendingUp, ArrowRight, MessageCircle } from 'lucide-react'

const NAV_ITEMS = [
  {
    href: '/leo',
    icon: Sparkles,
    label: 'AI経営会議',
    desc: '経営参謀AIとリアルタイム相談',
    color: 'from-[#C4728A] to-[#9B8EC4]',
    badge: 'LIVE',
  },
  {
    href: '/customers',
    icon: Users,
    label: '顧客管理',
    desc: 'カルテ・来店履歴・CSV移行',
    color: 'from-[#9B8EC4] to-[#C4728A]',
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
    href: '/counseling',
    icon: MessageCircle,
    label: 'SOLA カウンセリング',
    desc: 'AIビューティーカウンセラー・音声対応',
    color: 'from-rose-500 to-pink-600',
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
    <div className="min-h-screen bg-[#F8F5FF] flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[#E8E0F0] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#2C2C2C]">SOLA</h1>
            <p className="text-xs text-[#6B7280]">AI SALON MANAGER</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6B7280]">エステサロン ルミエール</p>
            <p className="text-xs text-[#9B8EC4] font-semibold">PROプラン</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* ウェルカム */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">おはようございます、KOMEIさん</h2>
          <p className="text-[#6B7280] text-sm">今日も一緒に売上を作りましょう。AI経営会議が待っています。</p>
        </div>

        {/* 緊急アラート */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-bold">緊急：</span>3ヶ月未来店の失客が23名います。今月中に手を打てます。
          </p>
          <Link href="/leo" className="ml-auto flex-shrink-0 text-xs text-red-600 hover:text-red-700 font-semibold underline">
            AI経営会議に相談
          </Link>
        </div>

        {/* メニューグリッド */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {NAV_ITEMS.map(({ href, icon: Icon, label, desc, color, badge }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white hover:bg-[#F8F5FF] border border-[#E8E0F0] hover:border-[#9B8EC4]/50 rounded-2xl p-5 transition-all shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  badge === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                    : 'bg-[#F8F5FF] text-[#6B7280] border border-[#E8E0F0]'
                }`}>
                  {badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#2C2C2C] mb-1">{label}</h3>
              <p className="text-xs text-[#6B7280]">{desc}</p>
              <div className="flex items-center gap-1 mt-3 text-xs text-[#9B8EC4] group-hover:text-[#C4728A] transition-colors">
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
