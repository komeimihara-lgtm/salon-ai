'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

const PLANS = [
  { value: 'lite', label: 'LITE', desc: '小規模サロン向け' },
  { value: 'pro', label: 'PRO', desc: 'スタンダード（推奨）' },
  { value: 'max', label: 'MAX', desc: '大規模・多店舗向け' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    salonName: '',
    ownerName: '',
    email: '',
    password: '',
    plan: 'pro',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 1. Supabase Auth でユーザー作成
    const supabase = createSupabaseBrowser()
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. サーバーAPI経由でsalonsテーブルに新規レコード作成（admin clientでRLSバイパス）
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salonName: form.salonName,
        ownerName: form.ownerName,
        email: form.email,
        plan: form.plan,
      }),
    })

    if (!res.ok) {
      const { error: regError } = await res.json()
      setError(regError || 'サロン登録に失敗しました')
      setLoading(false)
      return
    }

    const { salon_id } = await res.json()

    // 3. salon_id を cookie にセット（サーバー側でもセット済みだがクライアント側でも確実に）
    if (salon_id) {
      document.cookie = `salon_id=${salon_id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4728A] via-[#b07aaa] to-[#9B8EC4] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif-jp text-4xl font-bold text-white tracking-wide">SOLA</h1>
          <p className="text-white/80 text-sm mt-1 tracking-widest font-dm-sans">AI SALON MANAGER</p>
        </div>

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-text-main mb-6 text-center">新規登録</h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-text-sub mb-1">サロン名</label>
              <input
                type="text"
                value={form.salonName}
                onChange={e => update('salonName', e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="例: エステサロン ルミエール"
              />
            </div>
            <div>
              <label className="block text-sm text-text-sub mb-1">オーナー名</label>
              <input
                type="text"
                value={form.ownerName}
                onChange={e => update('ownerName', e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="例: 田中 花子"
              />
            </div>
            <div>
              <label className="block text-sm text-text-sub mb-1">メールアドレス</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="salon@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-text-sub mb-1">パスワード</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose/30 focus:border-rose outline-none text-sm"
                placeholder="6文字以上"
              />
            </div>

            {/* プラン選択 */}
            <div>
              <label className="block text-sm text-text-sub mb-2">プラン</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update('plan', p.value)}
                    className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                      form.plan === p.value
                        ? 'border-rose bg-rose/5 text-rose'
                        : 'border-gray-200 text-text-sub hover:border-lavender/50'
                    }`}
                  >
                    <div className="font-bold text-sm">{p.label}</div>
                    <div className="text-[10px] mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '登録中...' : 'SOLAを始める'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-lavender hover:underline">
              アカウントをお持ちの方
            </Link>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">&copy; LENARD Corporation</p>
      </div>
    </div>
  )
}
