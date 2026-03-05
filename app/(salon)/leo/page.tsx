'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, TrendingUp, Users, AlertTriangle, Zap } from 'lucide-react'
import KPISummary from '@/components/ui/KPISummary'
import { DEMO_SALON } from '@/lib/leo'
import { getSalonSettings } from '@/lib/salon-settings'
import { ChatMessage, LeoMessage } from '@/types'

// クイック質問サジェスト
const QUICK_QUESTIONS = [
  { icon: TrendingUp, text: '今月の売上目標を達成するには？', color: 'text-blue-400' },
  { icon: Users, text: '失客しているお客様を取り戻したい', color: 'text-red-400' },
  { icon: AlertTriangle, text: 'リピート率を上げる施策を教えて', color: 'text-amber-400' },
  { icon: Zap, text: '今すぐできるキャンペーンを考えて', color: 'text-purple-400' },
]

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0891B2] flex items-center justify-center mr-3 mt-1 shadow-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'order-1' : ''}`}>
        {!isUser && (
          <p className="text-xs font-bold text-[#0891B2] mb-1 ml-1">LEO GRANT</p>
        )}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#1E3A6E] text-white rounded-tr-sm shadow-lg'
            : 'bg-[#F0F9FF] border border-[#BAE6FD] text-[#1A202C] rounded-tl-sm shadow-md'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-[#4A5568] mt-1 mx-1">
          {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0891B2] flex items-center justify-center mr-3 shadow-lg">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-[#0891B2] rounded-full"
              style={{
                animation: 'typing-dot 1.2s ease-in-out infinite',
                animationDelay: `${delay}ms`
              }}
            />
          ))}
          <span className="text-xs text-[#4A5568] ml-1">LEOが分析中...</span>
        </div>
      </div>
    </div>
  )
}

export default function LeoPage() {
  const salon = DEMO_SALON
  const [kpiContext, setKpiContext] = useState<{ targets?: Record<string, number>; kpi?: Record<string, number> } | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<LeoMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchKpiContext = useCallback(async () => {
    const now = new Date()
    const settings = getSalonSettings()
    try {
      const res = await fetch(`/api/kpi/summary?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      const json = await res.json()
      if (json.error) return
      const kpi = {
        monthly_target: json.monthly_target ?? settings.targets.sales ?? 3000000,
        monthly_actual: json.monthly_actual ?? json.totalSales ?? 0,
        achievement_rate: json.achievement_rate ?? 0,
        gap: json.gap ?? 0,
        days_remaining: json.days_remaining ?? 0,
        daily_needed: json.daily_needed ?? 0,
        customer_count: json.customer_count ?? 0,
        lost_count: json.lost_count ?? 0,
        unique_visitors: json.unique_visitors ?? 0,
        avg_unit_price: json.avg_unit_price ?? 0,
        totalSales: json.totalSales ?? 0,
      }
      setKpiContext({
        targets: settings.targets,
        kpi,
      })
      const rate = kpi.monthly_target > 0 ? Math.round((kpi.monthly_actual / kpi.monthly_target) * 100) : 0
      const initialMsg = `${salon.owner_name}さん、こんにちは。LEO GRANTです。\n\n現在の状況を確認しました。今月の達成率は${rate}%、残り${kpi.days_remaining}日で¥${(kpi.gap / 10000).toFixed(0)}万円が必要です。\n\n特に気になるのは失客${kpi.lost_count}名です。今すぐ手を打てば今月中に取り戻せます。\n\n何から始めますか？`
      setMessages([{ id: '0', role: 'assistant', content: initialMsg, timestamp: new Date() }])
    } catch {
      const rate = Math.round((salon.kpi.monthly_actual / salon.kpi.monthly_target) * 100)
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `${salon.owner_name}さん、こんにちは。LEO GRANTです。\n\n現在の状況を確認しました。今月の達成率は${rate}%、残り${salon.kpi.days_remaining}日で¥${((salon.kpi.monthly_target - salon.kpi.monthly_actual) / 10000).toFixed(0)}万円が必要です。\n\n特に気になるのは失客${salon.kpi.lost_customers}名です。今すぐ手を打てば今月中に取り戻せます。\n\n何から始めますか？`,
        timestamp: new Date(),
      }])
    }
  }, [])

  useEffect(() => {
    fetchKpiContext()
  }, [fetchKpiContext])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // テキストエリア高さ自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const newHistory: LeoMessage[] = [...history, { role: 'user', content: text.trim() }]
    setMessages(prev => [...prev, userMsg])
    setHistory(newHistory)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/leo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, context: kpiContext }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
      setHistory(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '接続に問題が発生しました。少し待ってから再度お試しください。',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col max-w-4xl mx-auto">
      {/* KPIサマリー */}
      <div className="flex-shrink-0 max-w-4xl mx-auto w-full px-4 pt-4">
        <KPISummary
          kpi={kpiContext?.kpi ? {
            monthly_target: kpiContext.kpi.monthly_target ?? salon.kpi.monthly_target,
            monthly_actual: kpiContext.kpi.monthly_actual ?? salon.kpi.monthly_actual,
            customer_count: kpiContext.kpi.customer_count ?? salon.kpi.customer_count,
            repeat_rate: salon.kpi.repeat_rate,
            lost_customers: kpiContext.kpi.lost_count ?? salon.kpi.lost_customers,
            avg_unit_price: kpiContext.kpi.avg_unit_price ?? salon.kpi.avg_unit_price,
            days_remaining: kpiContext.kpi.days_remaining ?? salon.kpi.days_remaining,
          } : salon.kpi}
          salonName={salon.name}
        />
      </div>

      {/* AI経営会議チャット */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs text-[#4A5568] mb-3 ml-1 font-medium">AI経営会議チャット</p>
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* クイック質問（最初のメッセージのみ） */}
      {messages.length === 1 && !isLoading && (
        <div className="flex-shrink-0 max-w-4xl mx-auto w-full px-4 pb-2">
          <p className="text-xs text-[#4A5568] mb-2 ml-1">よく使う質問</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_QUESTIONS.map(({ icon: Icon, text, color }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-center gap-2 bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] hover:border-[#0891B2] rounded-xl px-3 py-2.5 text-left transition-all group"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                <span className="text-sm text-[#1A202C] group-hover:text-[#0891B2]">{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="flex-shrink-0 bg-[#F0F9FF] border-t border-[#BAE6FD] px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3 bg-white border border-[#BAE6FD] focus-within:border-[#0891B2] rounded-2xl px-4 py-3 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="AI経営会議チャットで相談する... (Enter で送信 / Shift+Enter で改行)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-[#1A202C] placeholder-[#4A5568] resize-none focus:outline-none"
              style={{ minHeight: '24px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              aria-label="AI経営会議チャットで送信"
              title="AI経営会議チャットで送信"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#0891B2] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-center text-xs text-[#4A5568] mt-2">
            AI経営会議チャットはサロンの実データを基に回答します
          </p>
        </div>
      </div>
    </div>
  )
}
