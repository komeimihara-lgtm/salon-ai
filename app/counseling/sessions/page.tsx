'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function CounselingSessionsPage() {
  const [sessions, setSessions] = useState<{ id: string; customer_name: string; created_at: string }[]>([])

  useEffect(() => {
    // TODO: Fetch from API when counseling_sessions list endpoint exists
    setSessions([])
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center h-14 px-4 border-b border-gray-100">
        <Link href="/counseling" className="p-2 -ml-2 text-[#3D3D3D]">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="flex-1 text-center text-sm font-bold text-[#3D3D3D]">カウンセリングセッション</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 p-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">セッションはまだありません</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="p-4 rounded-xl border border-gray-200">
                <p className="font-medium text-[#3D3D3D]">{s.customer_name}</p>
                <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString('ja-JP')}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
