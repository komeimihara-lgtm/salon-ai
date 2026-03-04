'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Megaphone, Loader2, Copy, Check } from 'lucide-react'

const MEDIA_OPTIONS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'line', label: 'LINE' },
  { key: 'google', label: 'Google広告' },
  { key: 'flyer', label: 'チラシ' },
  { key: 'web', label: 'Webサイト' },
]

const TONE_OPTIONS = [
  { key: 'friendly', label: '親しみやすい' },
  { key: 'elegant', label: '上品' },
  { key: 'professional', label: '専門的' },
  { key: 'pop', label: 'ポップ' },
]

interface Result {
  media: string
  media_label: string
  copy: string
}

export default function MarketingPage() {
  const [form, setForm] = useState({
    target: '',
    appeal_point: '',
    campaign: '',
    tone: 'friendly',
    media: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  function toggleMedia(key: string) {
    setForm(prev => ({
      ...prev,
      media: prev.media.includes(key)
        ? prev.media.filter(m => m !== key)
        : [...prev.media, key],
    }))
  }

  async function handleGenerate() {
    if (!form.target.trim()) {
      setError('ターゲットを入力してください')
      return
    }
    if (form.media.length === 0) {
      setError('媒体を1つ以上選択してください')
      return
    }
    setError('')
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tone: TONE_OPTIONS.find(t => t.key === form.tone)?.label || form.tone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      setResults(data.results || [])
      setActiveTab(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左: 入力フォーム */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#1A202C] mb-3">広告作成</h2>
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5 space-y-4">
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">ターゲット *</label>
                <input
                  value={form.target}
                  onChange={e => setForm(p => ({ ...p, target: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                  placeholder="例：30〜40代女性、美肌ケアに興味"
                />
              </div>

              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">訴求ポイント</label>
                <input
                  value={form.appeal_point}
                  onChange={e => setForm(p => ({ ...p, appeal_point: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                  placeholder="例：乾燥対策、リフトアップ"
                />
              </div>

              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">キャンペーン</label>
                <input
                  value={form.campaign}
                  onChange={e => setForm(p => ({ ...p, campaign: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                  placeholder="例：初回50%OFF"
                />
              </div>

              <div>
                <label className="text-xs text-[#4A5568] mb-1 block">トーン</label>
                <select
                  value={form.tone}
                  onChange={e => setForm(p => ({ ...p, tone: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                >
                  {TONE_OPTIONS.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[#4A5568] mb-2 block">媒体 *</label>
                <div className="flex flex-wrap gap-2">
                  {MEDIA_OPTIONS.map(m => (
                    <label
                      key={m.key}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                        form.media.includes(m.key)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-white border-[#BAE6FD] text-[#4A5568] hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.media.includes(m.key)}
                        onChange={() => toggleMedia(m.key)}
                        className="sr-only"
                      />
                      <span className="text-xs font-medium">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-3 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Megaphone className="w-4 h-4" />
                    広告文を生成
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 右: 生成結果・媒体タブ・コピー */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-[#1A202C] mb-3">生成結果</h2>
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl overflow-hidden min-h-[300px]">
              {results.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#4A5568]">
                  <Megaphone className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">左のフォームで条件を入力して「広告文を生成」をクリック</p>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
                  <p className="text-sm text-[#4A5568]">生成中...</p>
                </div>
              ) : (
                <>
                  <div className="flex border-b border-[#BAE6FD] overflow-x-auto">
                    {results.map((r, i) => (
                      <button
                        key={r.media}
                        onClick={() => setActiveTab(i)}
                        className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === i
                            ? 'border-amber-500 text-amber-400'
                            : 'border-transparent text-[#4A5568] hover:text-[#1A202C]'
                        }`}
                      >
                        {r.media_label}
                      </button>
                    ))}
                  </div>
                  <div className="p-4">
                    {results[activeTab] && (
                      <>
                        <div className="bg-white rounded-lg p-4 mb-4 min-h-[180px]">
                          <p className="text-sm text-[#1A202C] whitespace-pre-wrap leading-relaxed">
                            {results[activeTab].copy}
                          </p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(results[activeTab].copy, results[activeTab].media)}
                          className="flex items-center gap-2 bg-[#0891B2] hover:bg-[#0e7490] border border-[#0891B2] text-white rounded-lg px-4 py-2 text-sm transition-colors"
                        >
                          {copied === results[activeTab].media ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              コピーしました
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              コピー
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
