'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function ChartPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-gray-100">
        <Link href="/counseling" className="p-2 -ml-2 text-[#3D3D3D]">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-[#3D3D3D]">カルテ</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 p-4">
        <p className="text-sm text-gray-500">顧客ID: {id}</p>
        <p className="text-sm text-gray-500 mt-2">カルテ詳細は準備中です。</p>
      </main>
    </div>
  )
}
