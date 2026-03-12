'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const DEMO_SALON_ID = 'de000000-0000-0000-0000-000000000001'

export default function DemoPage() {
  const router = useRouter()
  const [status, setStatus] = useState('デモ環境を準備中...')

  useEffect(() => {
    const setup = async () => {
      try {
        await fetch('/api/demo/setup', { method: 'POST' })
        // cookieにデモモードとsalon_idをセット
        document.cookie = `demo_mode=true; path=/; max-age=${60 * 60 * 24}`
        document.cookie = `salon_id=${DEMO_SALON_ID}; path=/; max-age=${60 * 60 * 24}`
        setStatus('リダイレクト中...')
        router.push('/dashboard')
      } catch {
        setStatus('エラーが発生しました。再度お試しください。')
      }
    }
    setup()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4]">
      <div className="text-center">
        <h1 className="font-serif-jp text-4xl font-bold text-white mb-4">SOLA</h1>
        <p className="text-white/80 text-sm">{status}</p>
      </div>
    </div>
  )
}
