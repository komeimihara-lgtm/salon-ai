'use client'
import { useState } from 'react'
import { Sparkles, Loader2, Copy, Check, BookmarkPlus } from 'lucide-react'

type Platform = 'instagram' | 'x' | 'tiktok' | 'line'
type Purpose = 'before_after' | 'menu_promo' | 'staff_intro' | 'seasonal' | 'event' | 'tips' | 'customer_voice' | 'campaign'
type Tone = 'professional' | 'friendly' | 'luxury' | 'casual'

interface Variation {
  main_text: string
  hashtags: string[]
  image_suggestion: string
  cta: string
  best_post_time: string
}

const PLATFORMS: { key: Platform; label: string; color: string }[] = [
  { key: 'instagram', label: 'Instagram', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { key: 'x', label: 'X (Twitter)', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { key: 'tiktok', label: 'TikTok', color: 'bg-black text-white border-black' },
  { key: 'line', label: 'LINE', color: 'bg-green-100 text-green-700 border-green-300' },
]

const PURPOSES: { key: Purpose; label: string; emoji: string }[] = [
  { key: 'before_after', label: 'ビフォーアフター', emoji: '✨' },
  { key: 'menu_promo', label: 'メニュー紹介', emoji: '💆' },
  { key: 'staff_intro', label: 'スタッフ紹介', emoji: '👩' },
  { key: 'seasonal', label: '季節のお知らせ', emoji: '🌸' },
  { key: 'event', label: 'イベント告知', emoji: '🎉' },
  { key: 'tips', label: '美容Tips', emoji: '💡' },
  { key: 'customer_voice', label: 'お客様の声', emoji: '💬' },
  { key: 'campaign', label: 'キャンペーン', emoji: '🎁' },
]

const TONES: { key: Tone; label: string }[] = [
  { key: 'professional', label: 'プロフェッショナル' },
  { key: 'friendly', label: 'フレンドリー' },
  { key: 'luxury', label: 'ラグジュアリー' },
  { key: 'casual', label: 'カジュアル' },
]

export default function SnsComposePage() {
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [purpose, setPurpose] = useState<Purpose>('before_after')
  const [tone, setTone] = useState<Tone>('friendly')
  const [menuName, setMenuName] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [variations, setVariations] = useState<Variation[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setVariations([])
    try {
      const res = await fetch('/api/sns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, platform, menu_name: menuName, details, tone }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setVariations(json.variations || [])
      setActiveTab(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    const v = variations[activeTab]
    if (!v) return
    const text = `${v.main_text}\n\n${v.hashtags.map(h => `#${h}`).join(' ')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('コピーしました')
  }

  const handleSave = async () => {
    const v = variations[activeTab]
    if (!v) return
    try {
      await fetch('/api/sns/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${PURPOSES.find(p => p.key === purpose)?.label} - ${platform}`,
          content: v.main_text,
          platform,
          hashtags: v.hashtags,
          status: 'draft',
          ai_generated: true,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      showToast('下書きに保存しました')
    } catch {
      showToast('保存に失敗しました')
    }
  }

  const currentVariation = variations[activeTab]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="gradient-line rounded-full" />
        <span className="section-label font-dm-sans text-base font-bold text-text-main">AI投稿作成</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左パネル：入力 */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 card-shadow space-y-4">
            {/* プラットフォーム */}
            <div>
              <p className="text-xs font-bold text-text-sub mb-2">プラットフォーム</p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.key} onClick={() => setPlatform(p.key)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm font-bold transition-all ${platform === p.key ? p.color + ' border-2' : 'bg-gray-50 text-text-sub border-gray-100'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 投稿タイプ */}
            <div>
              <p className="text-xs font-bold text-text-sub mb-2">投稿タイプ</p>
              <div className="grid grid-cols-2 gap-2">
                {PURPOSES.map(p => (
                  <button key={p.key} onClick={() => setPurpose(p.key)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm transition-all text-left ${purpose === p.key ? 'border-rose bg-rose/5 text-rose font-bold' : 'border-gray-100 text-text-sub hover:border-rose/30'}`}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* トーン */}
            <div>
              <p className="text-xs font-bold text-text-sub mb-2">トーン</p>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button key={t.key} onClick={() => setTone(t.key)}
                    className={`py-2 px-3 rounded-xl border-2 text-sm transition-all ${tone === t.key ? 'border-lavender bg-lavender/10 text-lavender font-bold' : 'border-gray-100 text-text-sub hover:border-lavender/30'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* メニュー名 */}
            <div>
              <p className="text-xs font-bold text-text-sub mb-2">メニュー名（任意）</p>
              <input value={menuName} onChange={e => setMenuName(e.target.value)}
                placeholder="例：フェイシャルケア、脱毛など"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
            </div>

            {/* 追加情報 */}
            <div>
              <p className="text-xs font-bold text-text-sub mb-2">追加情報（任意）</p>
              <textarea value={details} onChange={e => setDetails(e.target.value)}
                placeholder="キャンペーン内容、特別オファー、強調したいポイントなど"
                rows={3}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm resize-none" />
            </div>

            <button onClick={handleGenerate} disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />生成中...</> : <><Sparkles className="w-5 h-5" />AIで投稿を生成</>}
            </button>
          </div>
        </div>

        {/* 右パネル：結果 */}
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm">{error}</div>
          )}

          {!loading && variations.length === 0 && !error && (
            <div className="bg-white rounded-2xl p-8 card-shadow flex flex-col items-center justify-center text-center gap-4 min-h-64">
              <Sparkles className="w-12 h-12 text-rose/30" />
              <div>
                <p className="font-bold text-text-main">投稿を生成しましょう</p>
                <p className="text-xs text-text-sub mt-1">左のフォームを入力して「AIで投稿を生成」をクリック</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl p-8 card-shadow flex flex-col items-center justify-center gap-4 min-h-64">
              <Loader2 className="w-10 h-10 text-rose animate-spin" />
              <p className="text-text-sub text-sm">3パターンの投稿を生成中...</p>
            </div>
          )}

          {!loading && variations.length > 0 && (
            <div className="bg-white rounded-2xl p-5 card-shadow space-y-4">
              {/* タブ */}
              <div className="flex gap-2">
                {variations.map((_, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === i ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
                    パターン {i + 1}
                  </button>
                ))}
              </div>

              {currentVariation && (
                <div className="space-y-3">
                  {/* 本文 */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-bold text-text-sub mb-2">📝 投稿本文</p>
                    <p className="text-sm text-text-main whitespace-pre-wrap">{currentVariation.main_text}</p>
                  </div>

                  {/* ハッシュタグ */}
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-600 mb-2">🏷️ ハッシュタグ</p>
                    <p className="text-xs text-blue-700">{currentVariation.hashtags.map(h => `#${h}`).join(' ')}</p>
                  </div>

                  {/* 画像提案 */}
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-purple-600 mb-1">📸 画像提案</p>
                    <p className="text-xs text-purple-700">{currentVariation.image_suggestion}</p>
                  </div>

                  {/* CTA・投稿時間 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-emerald-600 mb-1">📣 CTA</p>
                      <p className="text-xs text-emerald-700">{currentVariation.cta}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-600 mb-1">⏰ 推奨時間</p>
                      <p className="text-xs text-amber-700">{currentVariation.best_post_time}</p>
                    </div>
                  </div>

                  {/* ボタン */}
                  <div className="flex gap-2">
                    <button onClick={handleCopy}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-light-lav text-text-sub hover:text-rose'}`}>
                      {copied ? <><Check className="w-4 h-4" />コピー済み</> : <><Copy className="w-4 h-4" />コピー</>}
                    </button>
                    <button onClick={handleSave}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-gradient-to-r from-rose to-lavender text-white'}`}>
                      {saved ? <><Check className="w-4 h-4" />保存済み</> : <><BookmarkPlus className="w-4 h-4" />下書き保存</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg bg-emerald-600 text-white font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}
