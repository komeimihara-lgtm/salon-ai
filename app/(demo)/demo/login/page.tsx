'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DemoLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try {
      await fetch('/api/demo/setup', { method: 'POST' })
      router.push('/demo/dashboard')
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4] px-4">
      <div className="w-full max-w-md text-center">
        {/* ロゴ */}
        <div className="mb-10">
          <h1 className="font-serif-jp text-5xl font-bold text-white tracking-wide">SOLA</h1>
          <p className="text-white/80 text-sm mt-2 tracking-widest font-dm-sans">AI SALON MANAGER</p>
          <div className="w-12 h-[2px] bg-white/40 mx-auto mt-4" />
          <p className="text-white/90 text-base mt-6 font-medium">
            AIがサロン経営を、まるごと変える。
          </p>
        </div>

        {/* カード */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-8">
          <p className="text-text-sub text-sm mb-6">
            デモ環境では全機能をお試しいただけます。<br />
            データはいつでもリセットできます。
          </p>

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
          >
            {loading ? 'デモ環境を準備中...' : 'デモを開始する'}
          </button>
        </div>

        <p className="text-white/50 text-xs mt-8">&copy; LENARD Corporation</p>
      </div>
    </div>
  )
}
