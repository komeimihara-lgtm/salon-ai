'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, TrendingUp, Users, AlertTriangle, Zap } from 'lucide-react'
import KPISummary from '@/components/ui/KPISummary'
import { DEMO_SALON } from '@/lib/leo'
import { ChatMessage, LeoMessage } from '@/types'

// クイック質問サジェスト
const QUICK_QUESTIONS = [
  { icon: TrendingUp, text: '今月の売上目標を達成するには？', color: 'text-[#C4728A]' },
  { icon: Users, text: '失客しているお客様を取り戻したい', color: 'text-[#C4728A]' },
  { icon: AlertTriangle, text: 'リピート率を上げる施策を教えて', color: 'text-[#9B8EC4]' },
  { icon: Zap, text: '今すぐできるキャンペーンを考えて', color: 'text-[#9B8EC4]' },
]

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center mr-3 mt-1 shadow-lg">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? 'order-1' : ''}`}>
        {!isUser && (
          <p className="text-xs font-bold text-[#9B8EC4] mb-1 ml-1">AI経営会議</p>
        )}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-r from-[#C4728A] to-[#9B8EC4] text-white rounded-tr-sm shadow-lg'
            : 'bg-white border border-[#E8E0F0] text-[#2C2C2C] rounded-tl-sm shadow-sm'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-[#6B7280] mt-1 mx-1">
          {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center mr-3 shadow-lg">
        <Sparkles className="w-4 h-4 text-white animate-pulse" />
      </div>
      <div className="bg-white border border-[#E8E0F0] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-[#9B8EC4] rounded-full"
              style={{
                animation: 'pulse-dot 1.2s ease-in-out infinite',
                animationDelay: `${delay}ms`
              }}
            />
          ))}
          <span className="text-xs text-[#6B7280] ml-1">分析中...</span>
        </div>
      </div>
    </div>
  )
}

export default function LeoPage() {
  const salon = DEMO_SALON
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: `${salon.owner_name}さん、こんにちは。AI経営会議です。\n\n現在の状況を確認しました。今月の達成率は${Math.round((salon.kpi.monthly_actual / salon.kpi.monthly_target) * 100)}%、残り${salon.kpi.days_remaining}日で¥${((salon.kpi.monthly_target - salon.kpi.monthly_actual) / 10000).toFixed(0)}万円が必要です。\n\n特に気になるのは失客${salon.kpi.lost_customers}名です。今すぐ手を打てば今月中に取り戻せます。\n\n何から始めますか？`,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<LeoMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        body: JSON.stringify({ messages: newHistory }),
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
    <div className="min-h-screen bg-[#F8F5FF] flex flex-col">

      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-white border-b border-[#E8E0F0] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#2C2C2C]">AI経営会議</h1>
              <p className="text-xs text-[#6B7280]">経営会議AI — {salon.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F8F5FF] rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[#6B7280]">オンライン</span>
          </div>
        </div>
      </header>

      {/* KPIサマリー */}
      <div className="flex-shrink-0 max-w-4xl mx-auto w-full px-4 pt-4">
        <KPISummary kpi={salon.kpi} salonName={salon.name} />
      </div>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
          <p className="text-xs text-[#6B7280] mb-2 ml-1">よく使う質問</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_QUESTIONS.map(({ icon: Icon, text, color }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-center gap-2 bg-white hover:bg-[#F8F5FF] border border-[#E8E0F0] hover:border-[#9B8EC4]/50 rounded-xl px-3 py-2.5 text-left transition-all group"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                <span className="text-sm text-[#2C2C2C] group-hover:text-[#9B8EC4]">{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="flex-shrink-0 bg-white border-t border-[#E8E0F0] px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3 bg-white border border-[#E8E0F0] focus-within:border-[#9B8EC4] rounded-2xl px-4 py-3 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="相談内容を入力... (Enter で送信 / Shift+Enter で改行)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-[#2C2C2C] placeholder-[#6B7280] resize-none focus:outline-none"
              style={{ minHeight: '24px', maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-[#C4728A] to-[#9B8EC4] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-center text-xs text-[#6B7280] mt-2">
            AI経営会議はサロンの実データを基に回答します
          </p>
        </div>
      </div>
    </div>
  )
}
