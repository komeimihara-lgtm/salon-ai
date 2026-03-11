'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Info, Zap, AlertTriangle, Wrench, X } from 'lucide-react'

type Announcement = {
  id: string
  title: string
  body: string
  type: 'info' | 'update' | 'maintenance' | 'important'
  target_plan: string
  published_at: string
  is_read: boolean
}

const TYPE_CONFIG = {
  info: { label: 'お知らせ', icon: Info, bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', badgeColor: 'bg-blue-100 text-blue-700' },
  update: { label: 'アップデート', icon: Zap, bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700', badgeColor: 'bg-green-100 text-green-700' },
  maintenance: { label: 'メンテナンス', icon: Wrench, bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-700', badgeColor: 'bg-yellow-100 text-yellow-700' },
  important: { label: '重要', icon: AlertTriangle, bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700', badgeColor: 'bg-red-100 text-red-700' },
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Announcement | null>(null)

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements')
      const data = await res.json()
      setAnnouncements(data.announcements || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const markAsRead = async (a: Announcement) => {
    if (a.is_read) {
      setSelected(a)
      return
    }
    await fetch(`/api/announcements/${a.id}/read`, { method: 'POST' })
    setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, is_read: true } : x))
    setSelected({ ...a, is_read: true })
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <div className="gradient-line mb-3" />
        <h2 className="text-2xl font-bold text-text-main font-serif-jp">お知らせ</h2>
        <p className="text-text-sub text-sm mt-1">SOLAからのお知らせ一覧</p>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-rose/30 border-t-rose rounded-full animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">お知らせはありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {announcements.map(a => {
              const config = TYPE_CONFIG[a.type] || TYPE_CONFIG.info
              return (
                <button
                  key={a.id}
                  onClick={() => markAsRead(a)}
                  className={`w-full text-left px-6 py-4 hover:bg-gray-50/50 transition-colors ${!a.is_read ? 'bg-light-lav/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}>
                      <config.icon className={`w-4 h-4 ${config.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                          {config.label}
                        </span>
                        {!a.is_read && <span className="w-2 h-2 bg-rose rounded-full shrink-0" />}
                      </div>
                      <p className={`text-sm ${!a.is_read ? 'font-bold text-text-main' : 'text-gray-600'}`}>{a.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(a.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg card-shadow">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_CONFIG[selected.type]?.badgeColor}`}>
                  {TYPE_CONFIG[selected.type]?.label}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(selected.published_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-text-main mb-3">{selected.title}</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm bg-gradient-to-r from-rose to-lavender text-white rounded-xl hover:opacity-90">閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
