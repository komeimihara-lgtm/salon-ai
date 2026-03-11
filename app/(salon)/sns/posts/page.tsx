'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  content: string
  platform: string
  status: string
  hashtags: string[]
  ai_generated: boolean
  scheduled_at: string | null
  created_at: string
  is_archived?: boolean
  archive_memo?: string
  archive_metrics?: { likes?: string; saves?: string; bookings?: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'スケジュール済み', color: 'bg-blue-100 text-blue-700' },
  published: { label: '公開済み', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '失敗', color: 'bg-red-100 text-red-600' },
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  x: 'bg-gray-100 text-gray-700',
  tiktok: 'bg-black text-white',
  line: 'bg-green-100 text-green-700',
}

export default function SnsPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState<string>('all')
  const [archiveModal, setArchiveModal] = useState<Post | null>(null)
  const [archiveMemo, setArchiveMemo] = useState('')
  const [archiveMetrics, setArchiveMetrics] = useState({ likes: '', saves: '', bookings: '' })
  const [archiving, setArchiving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/sns/posts'
      if (activeStatus === 'archived') {
        url = '/api/sns/posts?archived=true'
      } else if (activeStatus !== 'all') {
        url = `/api/sns/posts?status=${activeStatus}`
      }
      const res = await fetch(url)
      const json = await res.json()
      setPosts(json.posts || [])
    } catch { }
    finally { setLoading(false) }
  }, [activeStatus])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return
    await fetch(`/api/sns/posts/${id}`, { method: 'DELETE' })
    fetchPosts()
  }

  const handleArchive = async () => {
    if (!archiveModal) return
    setArchiving(true)
    try {
      await fetch(`/api/sns/posts/${archiveModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_archived: true,
          archive_memo: archiveMemo,
          archive_metrics: archiveMetrics,
        }),
      })
      setArchiveModal(null)
      setArchiveMemo('')
      setArchiveMetrics({ likes: '', saves: '', bookings: '' })
      fetchPosts()
      showToast('アーカイブしました✨')
    } catch {
      showToast('失敗しました')
    } finally { setArchiving(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans text-base font-bold text-text-main">SNS投稿管理</span>
        </div>
        <Link href="/sns/compose"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">
          <Plus className="w-4 h-4" />AI投稿を作成
        </Link>
      </div>

      {/* タブ */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'scheduled', 'published', 'archived'].map(s => (
          <button key={s} onClick={() => setActiveStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeStatus === s ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
            {s === 'all' ? '全て' : s === 'archived' ? '⭐ アーカイブ' : STATUS_LABELS[s]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-10 h-10 text-rose animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-text-sub">
          <p className="font-medium">投稿がありません</p>
          <Link href="/sns/compose" className="text-rose text-sm mt-2 block">AI投稿を作成する →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-2xl p-4 card-shadow border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[post.platform] || 'bg-gray-100 text-gray-600'}`}>
                      {post.platform}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[post.status]?.color}`}>
                      {STATUS_LABELS[post.status]?.label}
                    </span>
                    {post.ai_generated && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">AI生成</span>
                    )}
                  </div>
                  <p className="font-bold text-text-main text-sm mb-1">{post.title}</p>
                  <p className="text-xs text-text-sub line-clamp-2">{post.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!post.is_archived && (
                    <button onClick={() => setArchiveModal(post)}
                      className="p-2 text-text-sub hover:text-amber-500 rounded-xl transition-all shrink-0"
                      title="反響アーカイブ">
                      ⭐
                    </button>
                  )}
                  {post.is_archived && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">⭐ アーカイブ済</span>
                  )}
                  <button onClick={() => handleDelete(post.id)}
                    className="p-2 text-text-sub hover:text-red-500 rounded-xl transition-all shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* アーカイブモーダル */}
      {archiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md card-shadow">
            <h3 className="font-bold text-text-main mb-1">反響アーカイブ</h3>
            <p className="text-xs text-text-sub mb-4">反響が良かった投稿として保存します。次回のAI生成時に参考にします。</p>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-text-sub mb-1">投稿</p>
                <p className="text-sm font-medium text-text-main">{archiveModal.title}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-text-sub mb-1">❤️ いいね数</p>
                  <input type="number" value={archiveMetrics.likes}
                    onChange={e => setArchiveMetrics(prev => ({ ...prev, likes: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
                </div>
                <div>
                  <p className="text-xs text-text-sub mb-1">🔖 保存数</p>
                  <input type="number" value={archiveMetrics.saves}
                    onChange={e => setArchiveMetrics(prev => ({ ...prev, saves: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
                </div>
                <div>
                  <p className="text-xs text-text-sub mb-1">📅 予約数</p>
                  <input type="number" value={archiveMetrics.bookings}
                    onChange={e => setArchiveMetrics(prev => ({ ...prev, bookings: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
                </div>
              </div>

              <div>
                <p className="text-xs text-text-sub mb-1">メモ（任意）</p>
                <textarea value={archiveMemo} onChange={e => setArchiveMemo(e.target.value)}
                  placeholder="例：毛穴ケア系は反響が良い、夜21時投稿が効果的など"
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setArchiveModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">
                キャンセル
              </button>
              <button onClick={handleArchive} disabled={archiving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : '⭐ アーカイブする'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg bg-emerald-600 text-white font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}
