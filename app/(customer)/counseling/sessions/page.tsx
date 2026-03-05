'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Loader2, User, Calendar, FileText } from 'lucide-react'

interface Session {
  id: string
  customer_name: string
  customer_id: string | null
  mode: string
  skin_type: string | null
  selected_menu: string | null
  created_at: string
}

export default function CounselingSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/counseling/sessions')
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/counseling" className="p-2 rounded-lg hover:bg-[#F8F5FF] text-text-main">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold text-text-main font-serif-jp">SOLA カウンセリング履歴</h1>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden card-shadow">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender" />
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-10 h-10 text-rose animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-text-sub">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>まだセッションがありません</p>
              <Link href="/counseling?mode=salon" className="mt-4 inline-block text-rose font-medium hover:underline">
                カウンセリングを開始する
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl bg-[#F8F5FF] border border-gray-100 hover:border-rose/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-rose shrink-0" />
                        <span className="font-medium text-text-main">{s.customer_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.mode === 'online' ? 'bg-lavender/30 text-deep' : 'bg-rose/20 text-rose'
                        }`}>
                          {s.mode === 'online' ? 'オンライン' : 'サロン'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-text-sub">
                        {s.skin_type && <span>肌: {s.skin_type}</span>}
                        {s.selected_menu && <span>メニュー: {s.selected_menu}</span>}
                      </div>
                      <p className="text-xs text-text-sub mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(s.created_at)}
                      </p>
                    </div>
                    {s.customer_id && (
                      <Link
                        href={`/chart/${s.customer_id}`}
                        className="shrink-0 text-sm font-medium text-rose hover:underline"
                      >
                        カルテへ →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/counseling?mode=salon"
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium text-center"
        >
          サロンでカウンセリング
        </Link>
        <Link
          href="/counseling?mode=online"
          className="flex-1 py-3 rounded-xl border border-rose text-rose font-medium text-center hover:bg-rose/5"
        >
          オンライン用URL
        </Link>
      </div>
    </div>
  )
}
