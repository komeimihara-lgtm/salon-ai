'use client'

import Link from 'next/link'
import {
  TrendingUp,
  Users,
  DollarSign,
  Repeat,
  Target,
  Calendar,
  AlertTriangle,
  Zap,
  Plus,
  ChevronRight,
} from 'lucide-react'

const KPI_CARDS = [
  { label: '今月売上', value: '¥320,000', sub: '目標 ¥600,000 / 達成率 53%', trend: '+8%', color: 'from-[#C4728A] to-[#9B8EC4]' },
  { label: '来店数', value: '38名', sub: '目標 60名 / 達成率 63%', trend: '+12%', color: 'from-[#C4728A] to-[#9B8EC4]' },
  { label: '客単価', value: '¥8,421', sub: '目標 ¥10,000 / 達成率 84%', trend: '+3%', color: 'from-[#C4728A] to-[#9B8EC4]' },
  { label: '再来店率', value: '68%', sub: '目標 75% / 達成率 91%', trend: '+5%', color: 'from-[#C4728A] to-[#9B8EC4]' },
]

export default function DashboardPage() {
  const today = new Date()
  const dateStr = today.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="min-h-screen bg-[#FDFAF7]">
      {/* トップバー */}
      <header className="bg-white border-b border-[#E8E0F0] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#2C2C2C]" style={{ fontFamily: 'var(--font-noto-serif)' }}>
              ダッシュボード
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#6B7280]">エステサロン ルミエール</span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center text-white text-xs font-bold">
              K
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 緊急アラート */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-bold">緊急：</span>3ヶ月未来店の失客が23名います。今月中に手を打てます。
          </p>
          <Link
            href="/leo"
            className="ml-auto flex-shrink-0 text-xs text-red-600 hover:text-red-700 font-semibold underline"
          >
            AI経営会議に相談
          </Link>
        </div>

        {/* レジ・売上登録ボタン（大きめ） */}
        <Link
          href="/sales"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white font-bold text-lg shadow-lg hover:opacity-95 transition-opacity"
        >
          <Plus className="w-6 h-6" />
          レジ・売上登録
        </Link>

        {/* 月間KPIカード×4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl p-5 shadow-sm overflow-hidden"
              style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}
            >
              <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] mb-4" />
              <p className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-1">{card.label}</p>
              <p className="text-2xl font-black text-[#C4728A] mb-1">{card.value}</p>
              <p className="text-xs text-[#6B7280] mb-1">{card.sub}</p>
              <span className="text-xs font-bold text-emerald-600">前月比 {card.trend}</span>
            </div>
          ))}
        </div>

        {/* 今日の日割り目標 + 今日のタスク */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}>
            <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] mb-4" />
            <h2 className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-3">今日の日割り目標</h2>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full border-4 border-[#F8F5FF] flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-[#C4728A] border-t-transparent -rotate-90" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 53%, 0 53%)' }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2C2C2C]">¥19,200</p>
                <p className="text-sm text-[#6B7280]">残り ¥12,000 で達成！</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}>
            <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] mb-4" />
            <h2 className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-3">今日のタスク</h2>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 py-2 border-l-2 border-[#C4728A] pl-3 bg-[#F8F5FF]/50 rounded-r">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm">田中様（92日未来店）に失客防止メッセージを送る</span>
                <Link href="/follow" className="ml-auto text-xs text-[#C4728A] font-medium">送信する</Link>
              </li>
              <li className="flex items-center gap-2 py-2 border-l-2 border-[#C4728A] pl-3 bg-[#F8F5FF]/50 rounded-r">
                <Zap className="w-4 h-4 text-purple-500 shrink-0" />
                <span className="text-sm">山田様の誕生日まで7日。特典クーポンを送る</span>
                <Link href="/follow" className="ml-auto text-xs text-[#C4728A] font-medium">送信する</Link>
              </li>
              <li className="flex items-center gap-2 py-2 pl-3">
                <input type="checkbox" className="rounded text-[#C4728A]" />
                <span className="text-sm text-[#6B7280]">手動タスクを追加</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 今日の予約表 */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4]" />
            <Link href="/reservations" className="text-sm text-[#C4728A] font-medium flex items-center gap-1">
              予約管理へ <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <h2 className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-4">今日の予約表</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[600px] grid grid-cols-5 gap-2">
              {['10:00', '12:00', '14:00', '16:00', '18:00'].map((time) => (
                <div key={time} className="text-center">
                  <p className="text-xs text-[#6B7280] mb-2">{time}</p>
                  <div className="h-16 rounded-lg bg-[#F8F5FF] border border-[#E8E0F0]" />
                  <div className="h-16 rounded-lg bg-[#F8F5FF] border border-[#E8E0F0] mt-2" />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B7280] mt-2">ベッドA・B（10:00〜20:00）</p>
          </div>
        </div>

        {/* 今日の来店客 + 出勤スタッフ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}>
            <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] mb-4" />
            <h2 className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-3">今日の来店客</h2>
            <div className="space-y-2">
              {['山田様 10:00 フェイシャル', '佐藤様 14:00 ボディ'].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#F8F5FF] last:border-0">
                  <span className="text-sm text-[#2C2C2C]">{item}</span>
                  <Link href="/customers" className="text-xs text-[#C4728A]">詳細</Link>
                </div>
              ))}
              <p className="text-xs text-[#6B7280] pt-2">来店予定 2名</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(90,74,110,0.08)' }}>
            <div className="w-12 h-1 rounded-full bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] mb-4" />
            <h2 className="text-[10px] uppercase tracking-widest text-[#C4728A] font-medium mb-3">出勤スタッフ</h2>
            <div className="space-y-2">
              {['田中 10:00〜19:00', '鈴木 11:00〜20:00'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center text-white text-xs font-bold">
                    {item[0]}
                  </div>
                  <span className="text-sm text-[#2C2C2C]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
