'use client'

import Link from 'next/link'
import { Home } from 'lucide-react'

/** お客様向け画面用レイアウト（サロン管理メニュー非表示） */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-20 flex items-center h-14 px-4 bg-white border-b border-gray-200 shadow-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose/10 text-rose hover:bg-rose/20 font-semibold transition-colors"
        >
          <Home className="w-5 h-5" />
          Home
        </Link>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
