'use client'

import { useState, useEffect, useCallback } from 'react'
import { Heart, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  content: string
  platform: string
  status: string
  hashtags: string[]
  archive_memo?: string
  created_at: string
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  x: 'bg-gray-100 text-gray-700',
  tiktok: 'bg-gray-900 text-white',
  line: 'bg-green-100 text-green-700',
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function SnsAnalyticsPage() {
  const [allPosts, setAllPosts] = useState<Post[]>([])
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [allRes, archivedRes] = await Promise.all([
        fetch('/api/sns/posts?archived=all'),
        fetch('/api/sns/posts?archived=true'),
      ])
      const allJson = await allRes.json()
      const archivedJson = await archivedRes.json()
      setAllPosts(allJson.posts || [])
      setArchivedPosts(archivedJson.posts || [])
    } catch {
      setAllPosts([])
      setArchivedPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setAnalysisResult(null)
    try {
      const res = await fetch('/api/sns/analyze-trends', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '分析に失敗しました')
      setAnalysisResult(json.analysis || json.text || '分析結果を取得できませんでした')
    } catch (e) {
      setAnalysisResult(e instanceof Error ? e.message : '分析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  const totalCount = allPosts.length
  const archivedCount = archivedPosts.length
  const archiveRate = totalCount > 0 ? Math.round((archivedCount / totalCount) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-main">投稿分析</h1>
          <p className="text-sm text-text-sub mt-0.5">反響があった投稿の傾向を分析</p>
        </div>
        <Link
          href="/sns/posts"
          className="text-sm text-rose hover:text-rose/80 font-medium"
        >
          投稿管理へ →
        </Link>
      </div>

      <div className="gradient-line rounded-full" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-rose" />
        </div>
      ) : (
        <>
          {/* 1. サマリーカード */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden">
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
              <p className="text-xs text-text-sub mb-1">総投稿数</p>
              <p className="text-2xl font-bold text-text-main">{totalCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden">
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
              <p className="text-xs text-text-sub mb-1">アーカイブ（反響あり）</p>
              <p className="text-2xl font-bold text-rose">{archivedCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 card-shadow overflow-hidden">
              <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-5 -mt-5 mb-4" />
              <p className="text-xs text-text-sub mb-1">アーカイブ率</p>
              <p className="text-2xl font-bold text-lavender">{archiveRate}%</p>
            </div>
          </div>

          {/* 2. 反響あり投稿一覧 */}
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <h2 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose fill-rose" />
              反響あり投稿一覧
            </h2>
            {archivedPosts.length === 0 ? (
              <p className="text-sm text-text-sub py-8 text-center">
                アーカイブ済みの投稿がありません。投稿管理で反響が良かった投稿をアーカイブしてください。
              </p>
            ) : (
              <div className="space-y-4">
                {archivedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-2xl p-4 border border-[#E8E0F0] bg-gradient-to-br from-rose-50/50 to-purple-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <Heart className="w-5 h-5 text-rose fill-rose shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-main line-clamp-3 mb-2">
                          {(post.content || post.title || '').slice(0, 80)}
                          {(post.content || post.title || '').length > 80 ? '...' : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[post.platform] || 'bg-gray-100 text-gray-600'}`}
                          >
                            {post.platform}
                          </span>
                          <span className="text-xs text-text-sub">{formatDate(post.created_at)}</span>
                        </div>
                        {post.archive_memo && (
                          <p className="text-xs text-text-sub mt-2 italic">メモ: {post.archive_memo}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. AI傾向分析 */}
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
            <h2 className="font-bold text-text-main mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-lavender" />
              AIによる傾向分析
            </h2>
            <p className="text-sm text-text-sub mb-4">
              アーカイブ済み投稿をClaude AIが分析し、「どんな投稿が反響を得やすいか」の傾向をテキストで返します。
            </p>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || archivedPosts.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  反響があった投稿の傾向を分析
                </>
              )}
            </button>
            {analysisResult && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-rose-50/50 to-purple-50/50 border border-[#E8E0F0]">
                <p className="text-sm text-text-main whitespace-pre-wrap">{analysisResult}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
