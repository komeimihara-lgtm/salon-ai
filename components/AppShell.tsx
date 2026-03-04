'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  MessageSquare,
  Calendar,
  Send,
  TrendingUp,
  Megaphone,
  Settings,
  List,
  HelpCircle,
  Clock,
  Bell,
  Menu,
  X,
  Ticket,
  Repeat,
  ShoppingCart,
  Heart,
  FileText,
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/customers', icon: Users, label: '顧客管理' },
  { href: '/chart', icon: FileText, label: 'カルテ' },
  { href: '/customer-delight', icon: Heart, label: '感動体験' },
  { href: '/counseling', icon: MessageSquare, label: 'Solaカウンセリング' },
  { href: '/leo', icon: MessageCircle, label: '経営会議' },
  { href: '/reservations', icon: Calendar, label: '予約管理' },
  { href: '/follow', icon: Send, label: '自動フォロー' },
  { href: '/sales', icon: ShoppingCart, label: '売上・レジ' },
  { href: '/kpi', icon: TrendingUp, label: '売上分析' },
  { href: '/marketing', icon: Megaphone, label: 'AI集客' },
  { href: '/menu-settings', icon: List, label: 'メニュー設定' },
  { href: '/courses', icon: Ticket, label: 'コース管理' },
  { href: '/subscriptions', icon: Repeat, label: 'サブスク管理' },
  { href: '/staff', icon: Clock, label: 'スタッフ管理' },
  { href: '/settings', icon: Settings, label: 'サロン設定' },
]

const BOTTOM_NAV_ITEMS = [
  { href: '/qa-chat', icon: HelpCircle, label: 'Q&Aチャット' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ルートのリダイレクト時はシェルを表示しない
  if (pathname === '/') return <>{children}</>

  return (
    <div className="min-h-screen flex">
      {/* サイドバー - PC */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:fixed lg:inset-y-0 bg-deep z-30">
        <div className="flex flex-col justify-center h-16 px-6 border-b border-white/10">
          <span className="font-serif-jp text-xl font-bold text-white">SOLA</span>
          <span className="text-[10px] text-white/80 tracking-wider">AI SALON MANAGER</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-rose/20 text-rose border-l-[3px] border-rose ml-0 -ml-[3px] pl-[calc(1rem+3px)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
          <div className="my-2 border-t border-white/10" />
          {BOTTOM_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-rose/20 text-rose border-l-[3px] border-rose ml-0 -ml-[3px] pl-[calc(1rem+3px)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/80 truncate">エステサロン ルミエール</p>
          <p className="text-xs text-white/60 truncate">KOMEIさん</p>
        </div>
      </aside>

      {/* モバイルサイドバーオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* モバイルサイドバー ドロワー */}
      <aside
        className={`fixed inset-y-0 left-0 w-[240px] bg-deep z-50 transform transition-transform lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div className="flex flex-col">
            <span className="font-serif-jp text-xl font-bold text-white">SOLA</span>
            <span className="text-[10px] text-white/80 tracking-wider">AI SALON MANAGER</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-rose/20 text-rose border-l-[3px] border-rose ml-0 -ml-[3px] pl-[calc(1rem+3px)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
          <div className="my-2 border-t border-white/10" />
          {BOTTOM_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-rose/20 text-rose border-l-[3px] border-rose ml-0 -ml-[3px] pl-[calc(1rem+3px)]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/80 truncate">エステサロン ルミエール</p>
          <p className="text-xs text-white/60 truncate">KOMEIさん</p>
        </div>
      </aside>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
        {/* トップバー */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 lg:px-8 bg-off-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-text-main hover:bg-light-lav rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-text-main font-serif-jp">
              {[...NAV_ITEMS, ...BOTTOM_NAV_ITEMS].find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label ?? 'ダッシュボード'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-sub font-dm-sans hidden sm:inline">
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <button className="p-2 text-text-sub hover:text-text-main rounded-lg hover:bg-light-lav">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-rose to-lavender flex items-center justify-center text-white text-xs font-bold">
              K
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
