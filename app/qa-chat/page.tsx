'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, HelpCircle } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_QUESTIONS = [
  'ダッシュボードの見方を教えて',
  'スタッフシフトの登録方法は？',
  '予約の登録はどうする？',
  'KPIの目標設定はどこでできますか？',
]

export default function QAChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'SOLAの使い方について、なんでもお気軽にご質問ください。\n\n例：「スタッフシフトの登録方法は？」「ダッシュボードの見方を教えて」',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    setMessages(m => [...m, userMsg])
    setInput('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/qa-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      }
      setMessages(m => [...m, assistantMsg])
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ありません。接続に問題が発生しました。しばらくしてから再度お試しください。',
        timestamp: new Date(),
      }
      setMessages(m => [...m, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col max-w-4xl mx-auto h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-rose to-lavender flex items-center justify-center mr-3 mt-1">
                <HelpCircle className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-deep text-white rounded-tr-sm'
                  : 'bg-light-lav border border-gray-200 text-text-main rounded-tl-sm'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-light-lav border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-sm text-text-sub">回答を考えています...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 2 && !isLoading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-text-sub mb-2">よくある質問</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs px-3 py-2 bg-light-lav hover:bg-rose/10 text-text-main rounded-xl border border-gray-200 hover:border-rose/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage(input)
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="使い方について質問してください..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            送信
          </button>
        </form>
      </div>
    </div>
  )
}
