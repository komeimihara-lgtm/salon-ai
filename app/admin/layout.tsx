'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Menu, X, Bell } from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
  { href: '/admin/announcements', icon: Bell, label: 'お知らせ管理' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-[#f5f5f0]">
      {/* サイドバー - PC */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#1a2744] z-30">
        <div className="flex flex-col justify-center h-16 px-6 border-b border-white/10">
          <span className="text-xl font-bold text-[#C9A84C] tracking-wider">SOLA</span>
          <span className="text-[10px] text-white/60 tracking-widest">ADMIN CONSOLE</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#C9A84C]/20 text-[#C9A84C] border-l-[3px] border-[#C9A84C] -ml-[3px] pl-[calc(1rem+3px)]'
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
          <p className="text-xs text-[#C9A84C] truncate">LENARD Inc.</p>
          <p className="text-xs text-white/60 truncate">運営管理者</p>
        </div>
      </aside>

      {/* モバイルオーバーレイ */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* モバイルサイドバー */}
      <aside className={`fixed inset-y-0 left-0 w-[240px] bg-[#1a2744] z-50 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div>
            <span className="text-xl font-bold text-[#C9A84C] tracking-wider">SOLA</span>
            <p className="text-[10px] text-white/60 tracking-widest">ADMIN CONSOLE</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 text-white/80"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                <Icon className="w-5 h-5 shrink-0" /><span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[240px]">
        <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 lg:px-8 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-[#1a2744]">運営者ダッシュボード</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#1a2744] to-[#C9A84C] flex items-center justify-center text-white text-xs font-bold">
              L
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
