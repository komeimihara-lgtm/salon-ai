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

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const url = activeStatus === 'all' ? '/api/sns/posts' : `/api/sns/posts?status=${activeStatus}`
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
        {['all', 'draft', 'scheduled', 'published'].map(s => (
          <button key={s} onClick={() => setActiveStatus(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeStatus === s ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
            {s === 'all' ? '全て' : STATUS_LABELS[s]?.label}
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
                <button onClick={() => handleDelete(post.id)}
                  className="p-2 text-text-sub hover:text-red-500 rounded-xl transition-all shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
