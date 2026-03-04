'use client'

import Link from 'next/link'
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
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/customers', icon: Users, label: '顧客管理' },
  { href: '/leo', icon: Sparkles, label: '経営会議' },
  { href: '/reservations', icon: Calendar, label: '予約管理' },
  { href: '/follow', icon: Send, label: '自動フォロー' },
  { href: '/kpi', icon: TrendingUp, label: '売上分析' },
  { href: '/marketing', icon: Megaphone, label: 'AI集客' },
  { href: '/counseling', icon: MessageCircle, label: 'AIカウンセリング' },
  { href: '/menu-settings', icon: UtensilsCrossed, label: 'メニュー設定' },
  { href: '/staff', icon: UserCog, label: 'スタッフ管理' },
  { href: '/settings', icon: Settings, label: 'サロン設定' },
  { href: '/line', icon: Smartphone, label: 'LINE連携' },
  { href: '/qa-chat', icon: MessageSquare, label: 'Q&Aチャット' },
  { href: '/customer-delight', icon: Heart, label: '感動体験' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-[#5A4A6E] flex flex-col shrink-0">
      <div className="p-5 border-b border-[#5A4A6E]/80">
        <Link href="/dashboard" className="block">
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] bg-clip-text text-transparent">
            SOLA
          </h1>
          <p className="text-[10px] text-white/70 mt-0.5 tracking-wider">AI SALON MANAGER</p>
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
                  ? 'bg-[#C4728A]/20 text-[#C4728A] border-l-[3px] border-[#C4728A]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/60 truncate">エステサロン ルミエール</p>
        <p className="text-xs text-[#C4728A] font-medium mt-0.5">KOMEIさん</p>
      </div>
    </aside>
  )
}
