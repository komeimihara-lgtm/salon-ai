'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { formatSignInError } from '@/lib/auth-errors'
import { normalizeOwnerEmail } from '@/lib/normalize-owner-email'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const trimmedEmail = email.trim()
    const supabase = createSupabaseBrowser()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (authError) {
      console.warn('[login] signInWithPassword:', authError.message, authError.status)
      setError(formatSignInError(authError))
      setLoading(false)
      return
    }

    // サロンIDを取得して cookie にセット（API 応答の Set-Cookie + document.cookie の二重で確実に）
    const normalized = normalizeOwnerEmail(trimmedEmail)
    try {
      const res = await fetch('/api/auth/salon-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
        credentials: 'include',
      })
      const payload = (await res.json().catch(() => ({}))) as {
        salon_id?: string | null
        error?: string
      }
      if (!res.ok) {
        console.warn('[login] /api/auth/salon-id failed:', res.status, payload.error)
      }
      if (payload.salon_id) {
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `salon_id=${encodeURIComponent(payload.salon_id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`
      }
    } catch (err) {
      console.error('[login] salon-id fetch:', err)
      // セッションは取得済みのため続行（middleware が owner_email から salon_id を補正する場合あり）
    }

    router.push('/dashboard')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif-jp text-4xl font-bold text-white tracking-wide">SOLA</h1>
          <p className="text-white/80 text-sm mt-1 tracking-widest font-dm-sans">AI SALON MANAGER</p>
          <p className="text-white/70 text-xs mt-3">AIがサロン経営を、まるごと変える。</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-text-main mb-6 text-center">ログイン</h2>
          {registered === '1' && (
            <p className="text-sm text-emerald-600 text-center mb-4 bg-emerald-50 rounded-xl py-2 px-3">
              登録が完了しました。メール認証が必要な場合は、届いたリンクを開いてからログインしてください。
            </p>
          )}

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
        </div>

        <p className="text-center text-white/50 text-xs mt-6">&copy; LENARD Corporation</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4] text-white">
          読み込み中...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
