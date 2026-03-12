'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Users, Calendar, MessageSquare, Settings, TrendingUp,
  ShoppingCart, Clock, Send, List, Package, Ticket, Repeat, Heart,
  FileText, BarChart2, BookOpen, Megaphone, Bell, HelpCircle, Menu, X,
  RefreshCw, AlertTriangle
} from 'lucide-react'

const DEMO_SALON_ID = 'demo0000-0000-0000-0000-000000000001'

const NAV_ITEMS = [
  { href: '/demo/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/customers', icon: Users, label: '顧客管理' },
  { href: '/chart', icon: FileText, label: 'カルテ' },
  { href: '/customer-delight', icon: Heart, label: '感動体験' },
  { href: '/counseling', icon: MessageSquare, label: 'SOLAカウンセリング' },
  { href: '/messages', icon: MessageSquare, label: 'メッセージ' },
  { href: '/reservations', icon: Calendar, label: '予約管理' },
  { href: '/follow', icon: Send, label: '自動フォロー' },
  { href: '/sales', icon: ShoppingCart, label: '売上・レジ' },
  { href: '/sales-analysis', icon: TrendingUp, label: '売上分析' },
  { href: '/management', icon: BarChart2, label: '経営管理' },
  { href: '/daily-report', icon: BookOpen, label: 'AI日報' },
  { href: '/menu', icon: List, label: 'メニュー設定' },
  { href: '/products', icon: Package, label: '商品管理' },
  { href: '/courses', icon: Ticket, label: '回数券管理' },
  { href: '/subscriptions', icon: Repeat, label: 'サブスク管理' },
  { href: '/staff', icon: Clock, label: 'スタッフ管理' },
  { href: '/settings', icon: Settings, label: 'サロン設定' },
]

export default function DemoDashboardPage() {
  const [resetting, setResetting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<{
    customers: number; reservations: number; todaySales: number; staff: number
  }>({ customers: 0, reservations: 0, todaySales: 0, staff: 0 })

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/demo/setup`)
      // Stats are loaded via individual API calls in production; here show demo counts
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleReset = async () => {
    setResetting(true)
    await fetch('/api/demo/setup', { method: 'POST' })
    setResetting(false)
    window.location.reload()
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
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = href === '/demo/dashboard'
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-rose/20 text-rose'
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
          <p className="text-xs text-white/80 truncate">デモサロン SOLA</p>
          <p className="text-xs text-white/60 truncate">デモユーザー</p>
        </div>
      </aside>

      {/* モバイルオーバーレイ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* モバイルサイドバー */}
      <aside className={`fixed inset-y-0 left-0 w-[240px] bg-deep z-50 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div className="flex flex-col">
            <span className="font-serif-jp text-xl font-bold text-white">SOLA</span>
            <span className="text-[10px] text-white/80 tracking-wider">AI SALON MANAGER</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-white/80"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5">
              <Icon className="w-5 h-5 shrink-0" /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
        {/* デモバナー */}
        <div className="bg-amber-400 text-amber-900 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          これはデモ環境です
          <button
            onClick={handleReset}
            disabled={resetting}
            className="ml-4 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'リセット中...' : 'デモデータをリセット'}
          </button>
        </div>

        {/* トップバー */}
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 lg:px-8 bg-off-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-text-main hover:bg-light-lav rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-text-main font-serif-jp">ダッシュボード</h1>
          </div>
          <span className="text-sm text-text-sub font-dm-sans hidden sm:inline">
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </header>

        {/* コンテンツ */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: '機能一覧', count: '20+', sub: 'すべての機能をお試しください', color: 'from-rose to-lavender' },
              { label: '顧客管理', count: 'AI搭載', sub: '顧客カルテ・ステータス管理', color: 'from-blue-400 to-blue-600' },
              { label: '予約管理', count: 'タイムライン', sub: 'ドラッグ&ドロップ対応', color: 'from-emerald-400 to-emerald-600' },
              { label: '経営分析', count: 'リアルタイム', sub: 'KPI・売上・スタッフ分析', color: 'from-amber-400 to-amber-600' },
            ].map((card, i) => (
              <div key={i} className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white shadow-lg`}>
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.count}</p>
                <p className="text-xs opacity-70 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-base font-semibold mb-4">主な機能</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {NAV_ITEMS.filter(n => n.href !== '/demo/dashboard').map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-rose/30 hover:bg-rose/5 transition-colors">
                  <Icon className="w-5 h-5 text-rose shrink-0" />
                  <span className="text-sm text-text-main">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
