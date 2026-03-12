'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  MessageSquare,
  Calendar,
  CalendarDays,
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
  BarChart2,
  BookOpen,
  Package,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'

type NavLink = { type: 'link'; href: string; icon: React.ComponentType<{ className?: string }>; label: string }
type NavGroup = {
  type: 'group'
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: { href: string; label: string }[]
}
type NavItem = NavLink | NavGroup

const NAV_ITEMS: NavItem[] = [
  { type: 'link', href: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { type: 'link', href: '/customers', icon: Users, label: '顧客管理' },
  { type: 'link', href: '/chart', icon: FileText, label: 'カルテ' },
  { type: 'link', href: '/customer-delight', icon: Heart, label: '感動体験' },
  { type: 'link', href: '/counseling', icon: MessageSquare, label: 'SOLAカウンセリング' },
  { type: 'link', href: '/leo', icon: MessageCircle, label: '経営会議' },
  { type: 'link', href: '/messages', icon: MessageSquare, label: 'メッセージ' },
  { type: 'link', href: '/reservations', icon: Calendar, label: '予約管理' },
  { type: 'link', href: '/follow', icon: Send, label: '自動フォロー' },
  { type: 'link', href: '/sales', icon: ShoppingCart, label: '売上・レジ' },
  { type: 'link', href: '/sales-analysis', icon: TrendingUp, label: '売上分析' },
  { type: 'link', href: '/management', icon: BarChart2, label: '経営管理' },
  { type: 'link', href: '/daily-report', icon: BookOpen, label: 'AI日報' },
  {
    type: 'group',
    key: 'sns',
    label: 'AI-SNS生成',
    icon: Megaphone,
    children: [
      { href: '/sns/compose', label: '投稿作成' },
      { href: '/sns/posts', label: '投稿管理' },
      { href: '/sns/calendar', label: '投稿カレンダー' },
      { href: '/sns/analytics', label: '投稿分析' },
    ],
  },
  { type: 'link', href: '/menu', icon: List, label: 'メニュー設定' },
  { type: 'link', href: '/products', icon: Package, label: '商品管理' },
  { type: 'link', href: '/courses', icon: Ticket, label: '回数券管理' },
  { type: 'link', href: '/subscriptions', icon: Repeat, label: 'サブスク管理' },
  { type: 'link', href: '/staff', icon: Clock, label: 'スタッフ管理' },
  { type: 'link', href: '/settings', icon: Settings, label: 'サロン設定' },
]

const BOTTOM_NAV_ITEMS = [
  { href: '/announcements', icon: Bell, label: 'お知らせ' },
  { href: '/qa-chat', icon: HelpCircle, label: 'Q&Aチャット' },
]

function getAllNavLabels(): { href: string; label: string }[] {
  const result: { href: string; label: string }[] = []
  for (const item of NAV_ITEMS) {
    if (item.type === 'link') result.push({ href: item.href, label: item.label })
    else for (const c of item.children) result.push({ href: c.href, label: c.label })
  }
  return result
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [snsExpanded, setSnsExpanded] = useState(false)
  const isSnsExpanded = pathname.startsWith('/sns') || snsExpanded
  const [unreadCount, setUnreadCount] = useState(0)
  const [salonName, setSalonName] = useState('サロン名未設定')

  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(d => setUnreadCount(d.unread_count || 0))
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => setSalonName(j.name || 'サロン名未設定'))
      .catch(() => {})
  }, [])

  // ルートのリダイレクト時はシェルを表示しない
  if (pathname === '/') return <>{children}</>

  // レジ画面は全画面（サイドバー非表示）
  if (pathname === '/sales') {
    return (
      <div className="min-h-screen flex flex-col bg-off-white">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* サイドバー - PC */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:fixed lg:inset-y-0 bg-deep z-30">
        <div className="flex flex-col justify-center h-16 px-6 border-b border-white/10">
          <span className="font-serif-jp text-xl font-bold text-white">SOLA</span>
          <span className="text-[10px] text-white/80 tracking-wider">AI SALON MANAGER</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            if (item.type === 'link') {
              const { href, icon: Icon, label } = item
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
            }
            const { key, label, icon: Icon, children } = item
            const expanded = key === 'sns' ? isSnsExpanded : false
            const onToggle = key === 'sns' ? () => setSnsExpanded(prev => !prev) : undefined
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={onToggle}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors w-full text-left text-white/60 hover:text-white hover:bg-white/5"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>
                {expanded && (
                  <div className="ml-4 pl-4 border-l border-white/10 space-y-0.5">
                    {children.map((c) => {
                      const isActive = pathname === c.href || pathname.startsWith(c.href + '/')
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-rose/20 text-rose'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span>{c.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
          <p className="text-xs text-white/80 truncate">{salonName}</p>
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
          {NAV_ITEMS.map((item) => {
            if (item.type === 'link') {
              const { href, icon: Icon, label } = item
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
            }
            const { key, label, icon: Icon, children } = item
            const expanded = key === 'sns' ? isSnsExpanded : false
            const onToggle = key === 'sns' ? () => setSnsExpanded(prev => !prev) : undefined
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={onToggle}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors w-full text-left text-white/60 hover:text-white hover:bg-white/5"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>
                {expanded && (
                  <div className="ml-4 pl-4 border-l border-white/10 space-y-0.5">
                    {children.map((c) => {
                      const isActive = pathname === c.href || pathname.startsWith(c.href + '/')
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-rose/20 text-rose'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span>{c.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
          <p className="text-xs text-white/80 truncate">{salonName}</p>
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
              {[...getAllNavLabels(), ...BOTTOM_NAV_ITEMS].find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label ?? 'ダッシュボード'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-sub font-dm-sans hidden sm:inline">
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <Link href="/announcements" className="relative p-2 text-text-sub hover:text-text-main rounded-lg hover:bg-light-lav">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
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
