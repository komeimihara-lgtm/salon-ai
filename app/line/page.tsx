'use client'

import Link from 'next/link'
import { ChevronLeft, MessageCircle } from 'lucide-react'

export default function LinePage() {
  return (
    <div className="min-h-screen bg-[#0F1923] flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-[#2E3F5C]">
        <Link href="/dashboard" className="p-2 -ml-2 text-white">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-white">LINE連携</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">LINE連携</h2>
          <p className="text-slate-400 text-sm text-center">LINE公式アカウント連携・メッセージ配信</p>
          <p className="text-slate-500 text-xs mt-4">準備中です</p>
        </div>
      </main>
    </div>
  )
}
