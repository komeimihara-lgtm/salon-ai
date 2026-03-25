'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Calendar,
  Send,
  TrendingUp,
  Megaphone,
  MessageCircle,
  Settings,
  UtensilsCrossed,
  UserCog,
  MessageSquare,
  Heart,
  Smartphone,
  BarChart2,
  BookOpen,
  Timer,
  PieChart,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/customers', icon: Users, label: '顧客管理' },
  { href: '/leo', icon: Sparkles, label: '経営会議' },
  { href: '/reservations', icon: Calendar, label: '予約管理' },
  { href: '/follow', icon: Send, label: '自動フォロー' },
  { href: '/kpi', icon: TrendingUp, label: '売上分析' },
  { href: '/management', icon: BarChart2, label: '経営管理' },
  { href: '/daily-report', icon: BookOpen, label: 'AI日報' },
  { href: '/marketing', icon: Megaphone, label: 'AI集客' },
  { href: '/counseling', icon: MessageCircle, label: 'AIカウンセリング' },
  { href: '/menu', icon: UtensilsCrossed, label: 'メニュー設定' },
  { href: '/staff', icon: UserCog, label: 'スタッフ管理' },
  { href: '/attendance', icon: Timer, label: 'タイムカード' },
  { href: '/attendance/manage', icon: Timer, label: '勤怠管理' },
  { href: '/staff/sales', icon: PieChart, label: 'スタッフ売上' },
  { href: '/settings', icon: Settings, label: 'サロン設定' },
  { href: '/line', icon: Smartphone, label: 'LINE連携' },
  { href: '/qa-chat', icon: MessageSquare, label: 'Q&Aチャット' },
  { href: '/customer-delight', icon: Heart, label: '感動体験' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[#E8E0F0] flex flex-col shrink-0">
      <div className="p-5 border-b border-[#E8E0F0]">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/favicon.png"
            alt="SOLA"
            width={44}
            height={44}
            className="rounded-lg shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] bg-clip-text text-transparent leading-tight">
              SOLA
            </h1>
            <p className="text-[10px] text-[#6B7280] mt-0.5 tracking-wider">AI SALON MANAGER</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#9B8EC4]/15 text-[#9B8EC4] border-l-[3px] border-[#9B8EC4]'
                  : 'text-[#6B7280] hover:text-[#2C2C2C] hover:bg-[#F8F5FF]'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-[#E8E0F0]">
        <p className="text-xs text-[#6B7280] truncate"></p>
        <p className="text-xs text-[#9B8EC4] font-medium mt-0.5"></p>
      </div>
    </aside>
  )
}
