'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function KPIPage() {
  return (
    <div className="min-h-screen bg-[#0F1923] flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-[#2E3F5C]">
        <Link href="/dashboard" className="p-2 -ml-2 text-white">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-white">KPI・売上管理</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <p className="text-slate-400 text-sm">準備中です</p>
      </main>
    </div>
  )
}
