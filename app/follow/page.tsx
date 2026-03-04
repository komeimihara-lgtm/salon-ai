'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, MessageCircle, Loader2 } from 'lucide-react'

type BadgeType = 'AUTO' | 'LINE/WEB' | 'SALON'
type SectionType = 'before' | 'after'

interface TriggerDef {
  key: string
  label: string
  desc: string
  badge: BadgeType
  section: SectionType
  hasToggle: boolean
  color?: 'lavender' | 'dark' | 'default'
}

// タイムライン順: 来店前3日 → 来店当日 → 施術翌日 → 来店後3日 → 来店後30日 → 誕生日7日前 → 90日未来店
const TRIGGERS: TriggerDef[] = [
  { key: 'pre_counseling', label: 'プレカウンセリング', desc: '悩み・要望・おすすめメニュー提案', badge: 'LINE/WEB', section: 'before', hasToggle: true, color: 'lavender' },
  { key: 'same_day', label: 'AIカウンセリング', desc: '言いづらい悩み・希望をヒアリング', badge: 'SALON', section: 'before', hasToggle: false, color: 'dark' },
  { key: 'next_day', label: 'サンキューメッセージ', desc: '仕上がり確認・お礼', badge: 'AUTO', section: 'after', hasToggle: true },
  { key: '3day', label: '来店後3日', desc: '来店から3日後にフォロー', badge: 'AUTO', section: 'after', hasToggle: true },
  { key: '30day', label: '来店後30日', desc: '30日未来店になりそうな顧客に', badge: 'AUTO', section: 'after', hasToggle: true },
  { key: 'birthday', label: '誕生日7日前', desc: '誕生月に特別オファー', badge: 'AUTO', section: 'after', hasToggle: true },
  { key: '90day', label: '90日未来店', desc: '失客寸前にリマインド', badge: 'AUTO', section: 'after', hasToggle: true },
]

interface Setting { trigger_type: string; enabled: boolean }

function Badge({ type, onDark }: { type: BadgeType; onDark?: boolean }) {
  if (type === 'SALON') {
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${onDark ? 'bg-white/20 text-white border border-white/40' : 'bg-[#0F172A] text-white'}`}>
        SALON
      </span>
    )
  }
  if (type === 'LINE/WEB') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0891B2] text-white">
        LINE/WEB
      </span>
    )
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4A5568] text-white">
      AUTO
    </span>
  )
}

export default function FollowPage() {
  const toggleableKeys = TRIGGERS.filter(t => t.hasToggle).map(t => t.key)
  const [settings, setSettings] = useState<Setting[]>(toggleableKeys.map(k => ({ trigger_type: k, enabled: true })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [lineConnected, setLineConnected] = useState<boolean | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/follow/settings')
      const data = await res.json()
      if (data.settings?.length) {
        setSettings(data.settings)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  useEffect(() => {
    fetch('/api/line/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json())
      .then(d => setLineConnected(d.ok === true))
      .catch(() => setLineConnected(false))
  }, [])

  async function toggleTrigger(key: string, enabled: boolean) {
    setSaving(key)
    try {
      await fetch('/api/follow/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_type: key, enabled }),
      })
      setSettings(prev => prev.map(s => s.trigger_type === key ? { ...s, enabled } : s))
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(null)
    }
  }

  const beforeTriggers = TRIGGERS.filter(t => t.section === 'before')
  const afterTriggers = TRIGGERS.filter(t => t.section === 'after')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        {lineConnected === false && (
          <Link
            href="/line"
            className="block bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 hover:bg-amber-500/20 transition-colors"
          >
            LINE公式アカウントを接続すると自動フォローが利用可能になります →
          </Link>
        )}

        {/* タイムライン（横スクロール） */}
        <div>
          <h2 className="text-sm font-bold text-[#1A202C] mb-3">来店フロー</h2>
          <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
            <div className="flex items-center gap-0 min-w-max">
              {/* 来店前セクション */}
              <div className="flex items-center gap-0 shrink-0 pr-2">
                <span className="text-xs font-bold text-[#4A5568] bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg px-3 py-1.5 shrink-0">
                  来店前
                </span>
                {beforeTriggers.map((t, i) => (
                  <div key={t.key} className="flex items-center gap-0">
                    {i > 0 && <ChevronRight className="w-4 h-4 text-[#BAE6FD] shrink-0" aria-hidden />}
                    <TriggerCard
                      trigger={t}
                      settings={settings}
                      saving={saving}
                      onToggle={toggleTrigger}
                      loading={loading}
                    />
                    {i < beforeTriggers.length - 1 && <div className="w-2 h-px bg-[#BAE6FD] shrink-0" aria-hidden />}
                  </div>
                ))}
              </div>
              {/* 区切り */}
              <div className="w-4 h-px bg-[#BAE6FD] shrink-0 mx-1" aria-hidden />
              <ChevronRight className="w-4 h-4 text-[#BAE6FD] shrink-0" aria-hidden />
              <div className="w-4 h-px bg-[#BAE6FD] shrink-0 mx-1" aria-hidden />
              {/* 来店後セクション */}
              <div className="flex items-center gap-0 shrink-0 pl-2">
                <span className="text-xs font-bold text-[#4A5568] bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg px-3 py-1.5 shrink-0">
                  来店後
                </span>
                {afterTriggers.map((t, i) => (
                  <div key={t.key} className="flex items-center gap-0">
                    {i > 0 && <ChevronRight className="w-4 h-4 text-[#BAE6FD] shrink-0" aria-hidden />}
                    <TriggerCard
                      trigger={t}
                      settings={settings}
                      saving={saving}
                      onToggle={toggleTrigger}
                      loading={loading}
                    />
                    {i < afterTriggers.length - 1 && <div className="w-2 h-px bg-[#BAE6FD] shrink-0" aria-hidden />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 中央: LINE風チャットプレビュー */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#1A202C] mb-3">プレビュー</h2>
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-[#BAE6FD] max-w-[280px] mx-auto lg:mx-0">
              <div className="bg-[#07C755] px-4 py-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                  <span className="text-xs font-bold text-[#07C755]">サロン</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A202C]">エステサロン ルミエール</p>
                  <p className="text-xs text-[#1A202C]/80">オンライン</p>
                </div>
              </div>
              <div className="p-3 space-y-2 bg-[#E9DDD6] min-h-[200px]">
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm">
                    <p className="text-xs text-slate-700">
                      こんにちは、山田様。先日はご来店いただきありがとうございました！
                    </p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm">
                    <p className="text-xs text-slate-700">
                      施術はいかがでしたか？またのお越しをお待ちしております。
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#D1F4CC] rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] shadow-sm">
                    <p className="text-xs text-slate-700">ありがとうございます！とても気持ちよかったです</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右: 効果サマリー */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#1A202C] mb-3">効果サマリー</h2>
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-5 space-y-4">
              {[
                { label: '再来店率', value: '68%', color: 'text-emerald-600' },
                { label: '失客回収（月）', value: '12名', color: 'text-amber-600' },
                { label: '返信率', value: '41%', color: 'text-blue-600' },
                { label: '月間送信数', value: '247通', color: 'text-purple-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-[#4A5568]">{label}</span>
                  <span className={`text-lg font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
    </div>
  )
}

function TriggerCard({
  trigger,
  settings,
  saving,
  onToggle,
  loading,
}: {
  trigger: TriggerDef
  settings: Setting[]
  saving: string | null
  onToggle: (key: string, enabled: boolean) => void
  loading: boolean
}) {
  const s = settings.find(x => x.trigger_type === trigger.key)
  const enabled = s?.enabled ?? true

  const cardBg =
    trigger.color === 'lavender'
      ? 'bg-[#E9E0F5] border-[#B794F6]'
      : trigger.color === 'dark'
        ? 'bg-[#1E3A6E] border-[#1E3A6E]'
        : 'bg-[#F0F9FF] border-[#BAE6FD]'

  const labelColor = trigger.color === 'dark' ? 'text-white' : 'text-[#1A202C]'
  const descColor = trigger.color === 'dark' ? 'text-white/80' : 'text-[#4A5568]'

  return (
    <div
      className={`shrink-0 w-[140px] rounded-xl border p-3 ${cardBg}`}
    >
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-[#0891B2] animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-1 mb-1">
            <Badge type={trigger.badge} onDark={trigger.color === 'dark'} />
          </div>
          <p className={`text-xs font-bold ${labelColor} mb-0.5`}>{trigger.label}</p>
          <p className={`text-[10px] ${descColor} leading-tight`}>{trigger.desc}</p>
          {trigger.hasToggle && (
            <button
              onClick={() => onToggle(trigger.key, !enabled)}
              disabled={saving === trigger.key}
              className={`mt-2 relative w-10 h-5 rounded-full shrink-0 transition-colors ${
                enabled ? 'bg-[#0891B2]' : 'bg-[#4A5568]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          )}
        </>
      )}
    </div>
  )
}
