'use client'

import Link from 'next/link'
import { ChevronLeft, MessageSquare } from 'lucide-react'

export default function QaChatPage() {
  return (
    <div className="min-h-screen bg-[#F8F5FF] flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-[#E8E0F0] bg-white">
        <Link href="/dashboard" className="p-2 -ml-2 text-[#2C2C2C]">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-[#2C2C2C]">Q&Aチャット</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#2C2C2C] mb-2">Q&Aチャット</h2>
          <p className="text-[#6B7280] text-sm text-center">よくある質問へのAI回答</p>
          <p className="text-[#6B7280] text-xs mt-4">準備中です</p>
        </div>
      </main>
    </div>
  )
}
