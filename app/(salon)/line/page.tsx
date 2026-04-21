'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Copy, Check, ArrowRight, Users } from 'lucide-react'

export default function LinePage() {
  const [channelSecret, setChannelSecret] = useState('')
  const [channelAccessToken, setChannelAccessToken] = useState('')
  const [userId, setUserId] = useState('')
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [unmatchedUsers, setUnmatchedUsers] = useState<{ line_user_id: string; followed_at: string }[]>([])
  const [unmatchedLoading, setUnmatchedLoading] = useState(false)
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/line/webhook`
    : 'https://your-domain.com/api/line/webhook'

  async function checkStatus() {
    setChecking(true)
    try {
      const res = await fetch('/api/line/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setConnected(data.ok === true)
    } catch {
      setConnected(false)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { checkStatus() }, [])

  async function loadUnmatchedLineUsers() {
    setUnmatchedLoading(true)
    try {
      const res = await fetch('/api/line/unmatched')
      const data = await res.json()
      setUnmatchedUsers(Array.isArray(data.users) ? data.users : [])
    } catch {
      setUnmatchedUsers([])
    } finally {
      setUnmatchedLoading(false)
    }
  }

  useEffect(() => {
    loadUnmatchedLineUsers()
  }, [])

  async function copyLineUserId(lineUserId: string) {
    try {
      await navigator.clipboard.writeText(lineUserId)
      setCopiedLineId(lineUserId)
      setTimeout(() => setCopiedLineId(null), 2000)
    } catch {
      setMessage({ type: 'error', text: 'User ID のコピーに失敗しました' })
    }
  }

  async function handleVerify() {
    setMessage(null)
    setVerifying(true)
    try {
      const res = await fetch('/api/line/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_secret: channelSecret || undefined,
          channel_access_token: channelAccessToken || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setConnected(true)
        setMessage({ type: 'success', text: '接続確認に成功しました' })
      } else {
        setMessage({ type: 'error', text: data.error || '接続確認に失敗しました' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '接続確認に失敗しました' })
    } finally {
      setVerifying(false)
    }
  }

  async function handleTest() {
    setMessage(null)
    setTesting(true)
    try {
      const res = await fetch('/api/line/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_access_token: channelAccessToken || undefined,
          user_id: userId || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: 'success', text: 'テストメッセージを送信しました' })
      } else {
        setMessage({ type: 'error', text: data.error || 'テスト送信に失敗しました' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'テスト送信に失敗しました' })
    } finally {
      setTesting(false)
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage({ type: 'error', text: 'コピーに失敗しました' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-end">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              checking
                ? 'bg-text-sub text-white'
                : connected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-text-sub text-white'
            }`}
          >
            {checking ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                確認中
              </>
            ) : (
              connected ? '接続済み' : '未接続'
            )}
          </span>
        </div>
        {/* Webhook URL */}
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4">
          <h2 className="text-sm font-bold text-[#1A202C] mb-2">Webhook URL</h2>
          <p className="text-xs text-[#4A5568] mb-2">LINE Developers コンソールでこのURLを設定してください</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-xs text-[#1A202C] break-all">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhook}
              className="flex items-center gap-1.5 bg-[#0891B2] hover:bg-[#0e7490] border border-[#0891B2] text-white rounded-lg px-3 py-2 text-sm shrink-0 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          </div>
        </div>

        {/* 未紐付けのLINE友だち（顧客カードで紐付け可能） */}
        <div className="bg-white border border-[#E8E0F0] rounded-xl p-4 card-shadow">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Users className="w-4 h-4 text-rose" />
              LINE友だち（未紐付け）
            </h2>
            <button
              type="button"
              onClick={() => loadUnmatchedLineUsers()}
              disabled={unmatchedLoading}
              className="text-xs text-rose font-medium hover:underline disabled:opacity-50"
            >
              {unmatchedLoading ? '更新中…' : '更新'}
            </button>
          </div>
          <p className="text-xs text-text-sub mb-3">
            友だち追加済みで、まだ顧客とLINEがつながっていない方の一覧です。
            <Link href="/customers" className="text-rose font-medium ml-1 hover:underline">
              顧客一覧
            </Link>
            から該当顧客を開き、詳細画面で紐付けてください。
          </p>
          {unmatchedLoading && unmatchedUsers.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-text-sub">
              <Loader2 className="w-6 h-6 animate-spin text-rose" />
            </div>
          ) : unmatchedUsers.length === 0 ? (
            <p className="text-sm text-text-sub text-center py-6">未紐付けの友だちはいません</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {unmatchedUsers.map(u => (
                <li
                  key={u.line_user_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-[#FAFAFA] px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <code className="block truncate text-[#1A202C] font-mono">{u.line_user_id}</code>
                    <span className="text-text-sub">
                      {u.followed_at
                        ? new Date(u.followed_at).toLocaleString('ja-JP', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLineUserId(u.line_user_id)}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-[#BAE6FD] bg-white px-2 py-1.5 text-text-main hover:bg-[#F0F9FF]"
                  >
                    {copiedLineId === u.line_user_id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    コピー
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 入力フォーム */}
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-[#1A202C]">認証情報</h2>
          <p className="text-xs text-[#4A5568]">
            .env.local に設定済みの場合は空欄でOK。フォーム入力はテスト用に優先されます。
          </p>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">Channel Secret</label>
            <input
              type="password"
              value={channelSecret}
              onChange={e => setChannelSecret(e.target.value)}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] placeholder-slate-500 focus:outline-none focus:border-[#0891B2]"
              placeholder="未設定の場合は .env.local から読み込み"
            />
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">Channel Access Token</label>
            <input
              type="password"
              value={channelAccessToken}
              onChange={e => setChannelAccessToken(e.target.value)}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] placeholder-slate-500 focus:outline-none focus:border-[#0891B2]"
              placeholder="未設定の場合は .env.local から読み込み"
            />
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">LINE User ID（テスト送信用・任意）</label>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] placeholder-slate-500 focus:outline-none focus:border-[#0891B2]"
              placeholder="友だち追加後の User ID"
            />
          </div>

          {message && (
            <p
              className={`text-sm px-3 py-2 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700'
                  : 'bg-red-500/10 border border-red-500/30 text-red-600'
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0891B2] hover:bg-[#0e7490] border border-[#0891B2] text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              接続確認
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !userId}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 border border-emerald-500 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              テスト送信
            </button>
          </div>
        </div>

        {/* 自動フォローへのリンク */}
        {connected && (
          <Link
            href="/follow"
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-3 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            自動フォロー設定へ
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
    </div>
  )
}
