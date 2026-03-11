'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Send, MessageCircle, Bot } from 'lucide-react'

type Customer = {
  id: string
  name: string
  line_user_id: string
  unread_count: number
  last_message: string | null
  last_message_at: string | null
}

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  message: string
  auto_type: string | null
  sent_at: string
}

export default function MessagesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 顧客一覧を取得
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/messages')
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // メッセージ履歴を取得
  const fetchMessages = useCallback(async (customerId: string) => {
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/messages/${customerId}`)
      const data = await res.json()
      setMessages(data.messages || [])
      // 未読をクリア（ローカル）
      setCustomers(prev => prev.map(c =>
        c.id === customerId ? { ...c, unread_count: 0 } : c
      ))
    } catch (e) {
      console.error(e)
    } finally {
      setMsgLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId)
  }, [selectedId, fetchMessages])

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // メッセージ送信
  const handleSend = async () => {
    if (!input.trim() || !selectedId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // 楽観的更新
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      direction: 'outbound',
      message: text,
      auto_type: null,
      sent_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const res = await fetch(`/api/messages/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (res.ok) {
        const data = await res.json()
        // temp を実際のメッセージに置換
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? data.message : m))
        // 顧客一覧の最終メッセージを更新
        setCustomers(prev => prev.map(c =>
          c.id === selectedId ? { ...c, last_message: text, last_message_at: new Date().toISOString() } : c
        ))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCustomer = customers.find(c => c.id === selectedId)

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
  }

  const formatMsgTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  const autoTypeLabel = (type: string) => {
    switch (type) {
      case 'reminder': return 'リマインダー'
      case 'precounseling': return 'カウンセリング'
      case 'welcome': return 'ウェルカム'
      case 'follow': return 'フォロー'
      default: return '自動送信'
    }
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* ヘッダー */}
      <div>
        <div className="gradient-line mb-3" />
        <h2 className="text-2xl font-bold text-text-main font-serif-jp">メッセージ</h2>
        <p className="text-text-sub text-sm mt-1">LINE連携済みのお客様とメッセージのやり取りができます</p>
      </div>

      {/* メインエリア */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="flex h-full">
          {/* 左カラム: 顧客一覧 */}
          <div className="w-full lg:w-1/3 border-r border-gray-100 flex flex-col">
            {/* 検索 */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sub" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="顧客名で検索..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose"
                />
              </div>
            </div>

            {/* 顧客リスト */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-rose/30 border-t-rose rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-text-sub text-sm">
                  <MessageCircle className="w-8 h-8 mb-2 text-gray-300" />
                  <p>LINE連携済みの顧客がいません</p>
                </div>
              ) : (
                filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-light-lav/50 transition-colors ${
                      selectedId === c.id ? 'bg-gradient-to-r from-rose/5 to-lavender/5 border-l-[3px] border-l-rose' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-rose to-lavender flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-text-main truncate">{c.name}</span>
                            {c.unread_count > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                {c.unread_count > 9 ? '9+' : c.unread_count}
                              </span>
                            )}
                          </div>
                          {c.last_message && (
                            <p className="text-xs text-text-sub truncate mt-0.5">
                              {c.last_message.slice(0, 30)}
                            </p>
                          )}
                        </div>
                      </div>
                      {c.last_message_at && (
                        <span className="text-[10px] text-text-sub shrink-0 ml-2">
                          {formatTime(c.last_message_at)}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 右カラム: チャット画面 */}
          <div className={`flex-1 flex flex-col ${selectedId ? '' : 'hidden lg:flex'}`}>
            {!selectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-sub">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-rose/10 to-lavender/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-10 h-10 text-rose/40" />
                </div>
                <p className="text-sm">顧客を選択してメッセージを開始</p>
              </div>
            ) : (
              <>
                {/* チャットヘッダー */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-rose/5 to-lavender/5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedId(null)}
                      className="lg:hidden text-text-sub hover:text-text-main"
                    >
                      ←
                    </button>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-rose to-lavender flex items-center justify-center text-white text-sm font-bold">
                      {selectedCustomer?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-text-main">{selectedCustomer?.name}</p>
                      <p className="text-[10px] text-text-sub">LINE連携中</p>
                    </div>
                  </div>
                </div>

                {/* メッセージエリア */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-6 h-6 border-2 border-rose/30 border-t-rose rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-text-sub text-sm">
                      <p>メッセージ履歴がありません</p>
                      <p className="text-xs mt-1">下の入力欄からメッセージを送信してみましょう</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${msg.direction === 'outbound' ? 'order-1' : ''}`}>
                          {msg.auto_type && msg.direction === 'outbound' && (
                            <div className="flex justify-end mb-1">
                              <span className="text-[10px] bg-lavender/20 text-lavender px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Bot className="w-3 h-3" />
                                {autoTypeLabel(msg.auto_type)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.direction === 'outbound'
                                ? 'bg-gradient-to-r from-rose to-lavender text-white rounded-br-md'
                                : 'bg-white text-text-main card-shadow rounded-bl-md'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <p className={`text-[10px] text-text-sub mt-1 ${
                            msg.direction === 'outbound' ? 'text-right' : 'text-left'
                          }`}>
                            {formatMsgTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* 入力エリア */}
                <div className="px-4 py-3 border-t border-gray-100 bg-white">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="メッセージを入力..."
                      rows={1}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose"
                      style={{ maxHeight: '120px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
