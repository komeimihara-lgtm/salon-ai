'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Heart,
  Loader2,
  Check,
  Copy,
  ArrowRight,
  MessageCircle,
  Gift,
  Zap,
} from 'lucide-react'
import { addTask } from '@/lib/dashboard-tasks'

interface Proposal {
  customer_name: string
  customer_rank: string
  reason: string
  initiative: string
  special_experience?: string
  action_type: string
  message_template?: string
  priority: number
}

const ACTION_ICONS: Record<string, typeof MessageCircle> = {
  message: MessageCircle,
  task: Zap,
  offer: Gift,
  surprise: Heart,
}

const RANK_LABELS: Record<string, { label: string; color: string }> = {
  vip: { label: 'VIP', color: 'bg-amber-100 text-amber-700' },
  at_risk: { label: '失客予備軍', color: 'bg-orange-100 text-orange-700' },
  dormant: { label: '休眠客', color: 'bg-purple-100 text-purple-700' },
  new: { label: '初回', color: 'bg-emerald-100 text-emerald-700' },
  active: { label: 'アクティブ', color: 'bg-blue-100 text-blue-700' },
}

export default function CustomerDelightPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executed, setExecuted] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const fetchProposals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customer-delight', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '取得に失敗しました')
      setProposals(data.proposals || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '提案の取得に失敗しました')
      setProposals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProposals()
  }, [])

  const handleExecute = async (p: Proposal) => {
    const taskText = p.message_template
      ? `${p.customer_name}様: ${p.initiative} — 「${p.message_template.slice(0, 50)}${p.message_template.length > 50 ? '…' : ''}」`
      : `${p.customer_name}様: ${p.initiative}`
    try {
      await addTask({
        text: taskText,
        source: 'customer_delight',
        priority: 'high',
        due_date: null,
        done: false,
      })
      setExecuted((prev) => new Set(prev).add(`${p.customer_name}-${p.initiative}`))
    } catch { }
  }

  const handleCopy = async (p: Proposal) => {
    const text = p.message_template || p.initiative
    await navigator.clipboard.writeText(text)
    setCopied(`${p.customer_name}-${p.initiative}`)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose" />
          感動体験提案
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
        <p className="text-sm text-text-sub mb-6">
          顧客データを分析し、感動レベルの満足UPにつながる取り組みをAIが提案します。
          タスクに追加したり、メッセージをコピーしてLINEで送信できます。
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 text-rose animate-spin mb-4" />
            <p className="text-text-sub">顧客データを分析中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchProposals}
              className="px-4 py-2 rounded-xl bg-rose text-white font-medium hover:opacity-90"
            >
              再試行
            </button>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 text-text-sub">
            <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>今回の分析では提案がありませんでした</p>
            <p className="text-xs mt-1">顧客データを増やすとより多くの提案が得られます</p>
            <button
              onClick={fetchProposals}
              className="mt-4 text-sm text-rose hover:underline"
            >
              再分析する
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((p, i) => {
              const key = `${p.customer_name}-${p.initiative}`
              const isExecuted = executed.has(key)
              const isCopied = copied === key
              const Icon = ACTION_ICONS[p.action_type] || Heart
              return (
                <div
                  key={key}
                  className="p-5 rounded-2xl border border-rose/20 bg-rose/5 hover:bg-rose/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-rose" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-text-main">{p.customer_name}様</span>
                        {p.customer_rank && RANK_LABELS[p.customer_rank] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RANK_LABELS[p.customer_rank].color}`}>
                            {RANK_LABELS[p.customer_rank].label}
                          </span>
                        )}
                        <span className="text-xs text-rose font-medium">
                          優先度 {p.priority}
                        </span>
                      </div>
                      <p className="text-xs text-text-sub mb-2">{p.reason}</p>
                      <p className="text-sm text-text-main font-medium mb-2">{p.initiative}</p>
                      {p.special_experience && (
                        <div className="bg-purple-50 rounded-xl p-3 mb-3 border border-purple-100">
                          <p className="text-xs text-purple-600 font-medium mb-1">✨ 特別体験</p>
                          <p className="text-sm text-text-main">{p.special_experience}</p>
                        </div>
                      )}
                      {p.message_template && (
                        <div className="text-xs text-text-sub bg-white/60 rounded-lg p-3 mb-3 border border-gray-100">
                          {p.message_template}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleExecute(p)}
                          disabled={isExecuted}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose to-lavender text-white text-sm font-medium disabled:opacity-50"
                        >
                          {isExecuted ? (
                            <>
                              <Check className="w-4 h-4" /> タスクに追加済み
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" /> タスクに追加
                            </>
                          )}
                        </button>
                        {p.message_template && (
                          <button
                            onClick={() => handleCopy(p)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose/50 text-rose text-sm font-medium hover:bg-rose/10"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-4 h-4" /> コピーしました
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> メッセージをコピー
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-100">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-rose font-medium hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            ダッシュボードでタスクを確認
          </Link>
        </div>
      </div>
    </div>
  )
}
