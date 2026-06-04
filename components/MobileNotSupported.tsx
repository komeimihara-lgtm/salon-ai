'use client'

import Link from 'next/link'
import { Monitor, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

/** C群（PC専用画面）にスマホでアクセスした場合に表示する案内 */
export default function MobileNotSupported({ currentPath }: { currentPath?: string }) {
  const router = useRouter()
  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center bg-off-white px-6 py-12">
      <div className="bg-white rounded-2xl card-shadow p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-rose to-lavender flex items-center justify-center">
          <Monitor className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-dm-sans font-bold text-lg text-text-main mb-2">
          この画面はPC・タブレット推奨です
        </h2>
        <p className="text-sm text-text-sub leading-relaxed mb-6">
          こちらの機能は操作が複雑なため、
          <br />
          PC または iPad などのタブレットでの
          <br />
          ご利用をお願いいたします。
        </p>
        {currentPath ? (
          <p className="text-xs text-text-sub bg-light-lav/40 rounded-lg py-2 px-3 mb-6 font-mono break-all">
            {currentPath}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full py-2.5 rounded-xl border border-rose text-rose font-medium text-sm flex items-center justify-center gap-2 hover:bg-rose/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            前の画面に戻る
          </button>
          <Link
            href="/dashboard"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
  )
}
