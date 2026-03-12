'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4] px-4">
      <div className="w-full max-w-md">
        {/* ロゴ・キャッチコピー */}
        <div className="text-center mb-8">
          <h1 className="font-serif-jp text-4xl font-bold text-white tracking-wide">SOLA</h1>
          <p className="text-white/80 text-sm mt-1 tracking-widest font-dm-sans">AI SALON MANAGER</p>
          <p className="text-white/70 text-xs mt-3">AIがサロン経営を、まるごと変える。</p>
        </div>

        {/* ログインカード */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-text-main mb-6 text-center">ログイン</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-text-sub mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="salon@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-sub mb-1">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="********"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/register" className="text-sm text-lavender hover:underline">
              新規登録はこちら
            </Link>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-text-sub">または</span></div>
          </div>

          <Link
            href="/demo/login"
            className="block w-full py-3 border-2 border-lavender text-lavender rounded-xl font-semibold text-sm text-center hover:bg-lavender/5 transition-colors"
          >
            デモを試す
          </Link>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">&copy; LENARD Corporation</p>
      </div>
    </div>
  )
}
