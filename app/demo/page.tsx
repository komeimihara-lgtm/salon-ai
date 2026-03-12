'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoPage() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/demo/setup', { method: 'POST' })
      .finally(() => {
        document.cookie = 'demo_mode=true; path=/'
        document.cookie = 'salon_id=de000000-0000-0000-0000-000000000001; path=/'
        router.push('/dashboard')
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-100 to-purple-100">
      <div className="text-center space-y-4">
        <p className="text-2xl font-bold text-gray-700">SOLA</p>
        <p className="text-gray-500">デモ環境を準備中...</p>
      </div>
    </div>
  )
}
