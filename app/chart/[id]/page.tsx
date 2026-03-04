'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileText } from 'lucide-react'

export default function ChartPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <div className="min-h-screen bg-[#FDFAF7] flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-[#E8E0F0] bg-white sticky top-0 z-10">
        <Link href="/counseling" className="p-2 -ml-2 text-[#2C2C2C] hover:text-rose">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-[#2C2C2C]">カルテ</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-2xl p-8 card-shadow border border-[#E8E0F0] text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose to-lavender flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#2C2C2C] mb-2">カルテ詳細</h2>
          <p className="text-sm text-[#6B7280] mb-4">顧客ID: {id}</p>
          <p className="text-sm text-[#6B7280]">カウンセリングの記録はセッション一覧からご確認ください。</p>
          <Link
            href="/counseling"
            className="inline-flex items-center gap-2 mt-6 text-sm font-medium text-rose hover:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            カウンセリングに戻る
          </Link>
        </div>
      </main>
    </div>
  )
}
