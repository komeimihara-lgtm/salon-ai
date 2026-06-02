'use client'

/**
 * 口コミ管理画面
 *  - 口コミ一覧（日付・顧客名・評価・内容）
 *  - AI返信文生成 / 返信編集 / 保存
 *  - 評価平均・良かった点の集計
 *  - 新着バッジ
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Star, Sparkles, MessageCircle, Check, BarChart3 } from 'lucide-react'

interface Review {
  id: string
  customer_id: string | null
  visit_id: string | null
  satisfaction: string | null
  good_points: string[] | null
  staff_comment: string | null
  revisit_intention: string | null
  generated_review: string | null
  edited_review: string | null
  is_posted: boolean
  posted_at: string | null
  reply_text: string | null
  replied_at: string | null
  is_read: boolean
  created_at: string
}

const SATISFACTION_SCORE: Record<string, number> = {
  'とても満足': 5,
  '満足': 4,
  '普通': 3,
  '不満': 1,
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState('')
  const [generatingReply, setGeneratingReply] = useState(false)
  const [savingReply, setSavingReply] = useState(false)
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reviews')
      const j = await res.json()
      const list: Review[] = j.reviews || []
      // アンケート未回答（cron で先行作成された空レコード）はフィルタ
      setReviews(list.filter(r => r.satisfaction || r.generated_review || r.edited_review))

      // 顧客IDから名前を取得（最大500名）
      const ids = Array.from(new Set(list.map(r => r.customer_id).filter(Boolean))) as string[]
      if (ids.length > 0) {
        const r2 = await fetch('/api/customers/list?limit=500')
        const j2 = await r2.json()
        const map: Record<string, string> = {}
        for (const c of (j2.customers || [])) {
          if (c?.id && c?.name) map[c.id] = c.name
        }
        setCustomerNames(map)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const active = useMemo(() => reviews.find(r => r.id === activeId) || null, [reviews, activeId])

  useEffect(() => {
    if (active) {
      setDraftReply(active.reply_text || '')
      // 一覧で開いた瞬間に既読化
      if (!active.is_read) {
        fetch(`/api/reviews/${active.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        }).catch(() => {})
        setReviews(prev => prev.map(r => r.id === active.id ? { ...r, is_read: true } : r))
      }
    }
  }, [activeId, active])

  const generateReply = async () => {
    if (!active) return
    setGeneratingReply(true)
    try {
      const res = await fetch('/api/reviews/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: active.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '生成に失敗しました')
      setDraftReply(j.reply_text || '')
    } catch (e) {
      alert(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setGeneratingReply(false)
    }
  }

  const saveReply = async () => {
    if (!active) return
    setSavingReply(true)
    try {
      const res = await fetch(`/api/reviews/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: draftReply }),
      })
      if (!res.ok) throw new Error()
      setReviews(prev => prev.map(r => r.id === active.id ? { ...r, reply_text: draftReply, replied_at: new Date().toISOString() } : r))
    } catch {
      alert('保存に失敗しました')
    } finally {
      setSavingReply(false)
    }
  }

  // 集計
  const stats = useMemo(() => {
    const scored = reviews.filter(r => r.satisfaction && SATISFACTION_SCORE[r.satisfaction])
    const avg = scored.length > 0
      ? scored.reduce((sum, r) => sum + SATISFACTION_SCORE[r.satisfaction!], 0) / scored.length
      : 0
    const goodCount: Record<string, number> = {}
    for (const r of reviews) {
      for (const p of (r.good_points || [])) {
        goodCount[p] = (goodCount[p] || 0) + 1
      }
    }
    const goodSorted = Object.entries(goodCount).sort((a, b) => b[1] - a[1])
    const unreadCount = reviews.filter(r => !r.is_read).length
    const postedCount = reviews.filter(r => r.is_posted).length
    return { avg, goodSorted, unreadCount, total: reviews.length, postedCount }
  }, [reviews])

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="gradient-line rounded-full" />
        <span className="font-dm-sans text-base font-bold text-text-main">口コミ管理</span>
        {stats.unreadCount > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-rose text-white text-xs font-bold">
            新着 {stats.unreadCount}
          </span>
        )}
      </div>

      {/* 集計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-xs text-text-sub mb-1 flex items-center gap-1"><Star className="w-3 h-3" />平均評価</p>
          <p className="text-2xl font-bold text-rose">{stats.avg.toFixed(2)}</p>
          <p className="text-[10px] text-text-sub mt-0.5">/5（{reviews.filter(r => r.satisfaction).length}件）</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-xs text-text-sub mb-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" />総数</p>
          <p className="text-2xl font-bold text-text-main">{stats.total}</p>
          <p className="text-[10px] text-text-sub mt-0.5">回答済</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-xs text-text-sub mb-1 flex items-center gap-1"><Check className="w-3 h-3" />Google投稿</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.postedCount}</p>
          <p className="text-[10px] text-text-sub mt-0.5">/ {stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-xs text-text-sub mb-1 flex items-center gap-1"><BarChart3 className="w-3 h-3" />評価傾向TOP</p>
          <p className="text-sm font-bold text-text-main truncate">
            {stats.goodSorted[0]?.[0] || '—'}
          </p>
          <p className="text-[10px] text-text-sub mt-0.5">
            {stats.goodSorted[0]?.[1] ?? 0}件
          </p>
        </div>
      </div>

      {/* 良かった点ランキング */}
      {stats.goodSorted.length > 0 && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-sm font-bold text-text-main mb-3">特に良かった点 ランキング</p>
          <div className="space-y-2">
            {stats.goodSorted.map(([p, c]) => {
              const max = stats.goodSorted[0][1]
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-main w-24">{p}</span>
                  <div className="flex-1 bg-light-lav rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose to-lavender" style={{ width: `${(c / max) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-sub w-12 text-right">{c}件</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 一覧 */}
        <div className="bg-white rounded-xl p-4 card-shadow">
          <p className="text-sm font-bold text-text-main mb-3">口コミ一覧</p>
          {loading ? (
            <p className="text-sm text-text-sub py-8 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
            </p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-text-sub py-8 text-center">まだ口コミがありません</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {reviews.map(r => {
                const score = r.satisfaction ? SATISFACTION_SCORE[r.satisfaction] : 0
                const date = new Date(r.created_at).toLocaleDateString('ja-JP')
                const name = r.customer_id ? (customerNames[r.customer_id] || '—') : '匿名'
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveId(r.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activeId === r.id
                        ? 'border-rose bg-rose/5'
                        : 'border-gray-100 hover:border-rose/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {!r.is_read && <span className="w-2 h-2 rounded-full bg-rose" />}
                        <span className="text-xs font-medium">{name}</span>
                        {score > 0 && (
                          <span className="text-xs text-amber-500">{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-sub">{date}</span>
                    </div>
                    <p className="text-xs text-text-sub line-clamp-2">
                      {r.edited_review || r.generated_review || '(口コミ文未生成)'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {r.is_posted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Google投稿済</span>}
                      {r.reply_text && <span className="text-[10px] px-1.5 py-0.5 rounded bg-lavender/30 text-lavender font-medium">返信済</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 詳細・返信生成 */}
        <div className="bg-white rounded-xl p-4 card-shadow">
          {!active ? (
            <p className="text-sm text-text-sub py-12 text-center">左の口コミを選択してください</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-sub mb-1">{new Date(active.created_at).toLocaleString('ja-JP')}</p>
                <p className="text-sm font-bold text-text-main">
                  {active.customer_id ? (customerNames[active.customer_id] || '—') : '匿名'} 様
                  {active.satisfaction && (
                    <span className="ml-2 text-amber-500">
                      {'★'.repeat(SATISFACTION_SCORE[active.satisfaction] || 0)}
                      <span className="text-text-sub ml-1">({active.satisfaction})</span>
                    </span>
                  )}
                </p>
              </div>

              {(active.good_points || []).length > 0 && (
                <div>
                  <p className="text-xs text-text-sub mb-1">良かった点</p>
                  <div className="flex flex-wrap gap-1">
                    {active.good_points!.map(p => (
                      <span key={p} className="text-[11px] px-2 py-0.5 rounded-full bg-light-lav text-text-main">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {active.staff_comment && (
                <div>
                  <p className="text-xs text-text-sub mb-1">スタッフへの一言</p>
                  <p className="text-sm text-text-main whitespace-pre-wrap leading-relaxed bg-light-lav/30 p-3 rounded-lg">{active.staff_comment}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-text-sub mb-1">口コミ文（投稿された内容）</p>
                <p className="text-sm text-text-main whitespace-pre-wrap leading-relaxed border border-gray-100 p-3 rounded-lg">
                  {active.edited_review || active.generated_review || '(未生成)'}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-text-main">サロン側の返信</p>
                  <button
                    onClick={generateReply}
                    disabled={generatingReply}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-xs font-bold disabled:opacity-50"
                  >
                    {generatingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AIで返信文生成
                  </button>
                </div>
                <textarea
                  value={draftReply}
                  onChange={e => setDraftReply(e.target.value)}
                  placeholder="返信文を入力（AI生成も可）"
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-rose outline-none resize-none"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-text-sub">{draftReply.length} 文字</span>
                  <button
                    onClick={saveReply}
                    disabled={savingReply || !draftReply.trim()}
                    className="px-4 py-1.5 rounded-lg bg-text-main text-white text-xs font-bold disabled:opacity-50"
                  >
                    {savingReply ? '保存中...' : '保存'}
                  </button>
                </div>
                {active.replied_at && (
                  <p className="text-[11px] text-text-sub mt-1">
                    最終保存: {new Date(active.replied_at).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
