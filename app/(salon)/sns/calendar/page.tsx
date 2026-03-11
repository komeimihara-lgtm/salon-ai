'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  content: string
  platform: string
  status: string
  scheduled_at: string | null
  hashtags: string[]
  ai_generated: boolean
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-400',
  x: 'bg-gray-500',
  tiktok: 'bg-black',
  line: 'bg-green-500',
}

const PLATFORM_LIGHT: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  x: 'bg-gray-100 text-gray-700',
  tiktok: 'bg-gray-900 text-white',
  line: 'bg-green-100 text-green-700',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  scheduled: '予定',
  published: '公開済',
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

export default function SnsCalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedPosts, setSelectedPosts] = useState<Post[]>([])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sns/calendar?year=${year}&month=${month}`)
      const json = await res.json()
      setPosts(json.posts || [])
    } catch { }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m - 1, 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  const getPostsForDate = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return posts.filter(p => p.scheduled_at?.startsWith(dateStr))
  }

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setSelectedPosts(getPostsForDate(day))
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans text-base font-bold text-text-main">投稿カレンダー</span>
        </div>
        <Link href="/sns/compose"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">
          <Plus className="w-4 h-4" />投稿を作成
        </Link>
      </div>

      {/* 月ナビゲーション */}
      <div className="bg-white rounded-2xl p-5 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-light-lav transition-all">
            <ChevronLeft className="w-5 h-5 text-text-sub" />
          </button>
          <h2 className="font-bold text-text-main text-lg">{year}年{month}月</h2>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-light-lav transition-all">
            <ChevronRight className="w-5 h-5 text-text-sub" />
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-bold py-2 ${i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-text-sub'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-rose animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* 空白セル */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}
            {/* 日付セル */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayPosts = getPostsForDate(day)
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate

              return (
                <button key={day} onClick={() => handleDateClick(day)}
                  className={`h-20 p-1.5 rounded-xl text-left transition-all border-2 ${isSelected ? 'border-rose bg-rose/5' : isToday ? 'border-lavender/50 bg-lavender/5' : 'border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
                  <p className={`text-xs font-bold mb-1 ${isToday ? 'text-rose' : 'text-text-main'}`}>{day}</p>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <div key={p.id} className={`w-full h-1.5 rounded-full ${PLATFORM_COLORS[p.platform] || 'bg-gray-400'}`} />
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-xs text-text-sub">+{dayPosts.length - 3}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 凡例 */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {Object.entries(PLATFORM_COLORS).map(([platform, color]) => (
            <div key={platform} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-xs text-text-sub capitalize">{platform}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 選択日の投稿一覧 */}
      {selectedDate && (
        <div className="bg-white rounded-2xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-text-main">
              {selectedDate.replace(/-/g, '/')} の投稿
            </h3>
            <Link href="/sns/compose"
              className="text-xs text-rose hover:underline">
              + 投稿を追加
            </Link>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="text-center py-8 text-text-sub">
              <p className="text-sm">この日の投稿はありません</p>
              <Link href="/sns/compose" className="text-rose text-sm mt-2 block">投稿を作成する →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedPosts.map(post => (
                <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PLATFORM_COLORS[post.platform] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_LIGHT[post.platform] || 'bg-gray-100 text-gray-600'}`}>
                        {post.platform}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[post.status] || post.status}
                      </span>
                      {post.ai_generated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">AI生成</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-main">{post.title}</p>
                    <p className="text-xs text-text-sub mt-0.5 line-clamp-2">{post.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
