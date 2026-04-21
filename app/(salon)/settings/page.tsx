'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Save, Pencil, X, Loader2, Copy, RefreshCw, AlertTriangle } from 'lucide-react'
import { getSalonSettings, setSalonSettings, type SalonSettings } from '@/lib/salon-settings'

type BedsState = string[]

// 営業開始: 6:00〜13:00（30分刻み）
const OPEN_TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const h = 6 + Math.floor(i / 2)
  const m = (i % 2) * 30
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
})
// 営業終了: 17:00〜25:00（30分刻み）
const CLOSE_TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const h = 17 + Math.floor(i / 2)
  const m = (i % 2) * 30
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
})

export default function SettingsPage() {
  const [settings, setSettings] = useState<SalonSettings>({
    salonName: '',
    address: '',
    phone: '',
    businessHours: { openTime: '10:00', closeTime: '21:00' },
    beds: [],
    targets: { sales: 600000, visits: 60, avgPrice: 10000, productSales: 50000, newCustomers: 10, newReservations: 15 },
    externalUrls: { hotpepper: '', salonHp: '' },
  })
  const [beds, setBeds] = useState<BedsState>([])
  const [newBed, setNewBed] = useState('')
  const [saved, setSaved] = useState(false)
  const [bedsEditing, setBedsEditing] = useState(false)
  const [editingBedNames, setEditingBedNames] = useState<Record<number, string>>({})
  const [lineToken, setLineToken] = useState('')
  const [lineSecret, setLineSecret] = useState('')
  const [lineSaving, setLineSaving] = useState(false)
  const [lineStatus, setLineStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [lineToast, setLineToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // HP連携
  const [hpEnabled, setHpEnabled] = useState(false)
  const [hpEmail, setHpEmail] = useState('')
  const [hpPassword, setHpPassword] = useState('')
  const [hpPasswordSet, setHpPasswordSet] = useState(false)
  const [hpPasswordMasked, setHpPasswordMasked] = useState('')
  const [hpSyncEmail, setHpSyncEmail] = useState('')
  const [hpLastSyncedAt, setHpLastSyncedAt] = useState<string | null>(null)
  const [hpSaving, setHpSaving] = useState(false)
  const [hpSyncing, setHpSyncing] = useState(false)
  const [hpCopied, setHpCopied] = useState(false)
  const [hpLogs, setHpLogs] = useState<Array<{
    id: string
    source: string
    status: string
    message: string | null
    created_at: string
  }>>([])
  const [hpToast, setHpToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    // DBから全設定を取得
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => {
        setBeds(j.beds || ['A', 'B'])
        setSettings(prev => ({
          ...prev,
          salonName: j.name || '',
          address: j.address || '',
          phone: j.phone || '',
          businessHours: j.business_hours || prev.businessHours,
          targets: j.targets || prev.targets,
        }))
      })
      .catch(() => setBeds(['A', 'B']))
  }, [])

  useEffect(() => {
    fetch('/api/line/verify', { method: 'POST' })
      .then(r => r.json())
      .then(d => setLineStatus(d.connected ? 'connected' : 'error'))
      .catch(() => setLineStatus('unknown'))
  }, [])

  useEffect(() => {
    if (lineToast) {
      const t = setTimeout(() => setLineToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [lineToast])

  // HP連携の初期読込
  const loadHpLogs = async () => {
    try {
      const res = await fetch('/api/hp-sync/logs')
      const j = await res.json()
      setHpLogs(j.logs || [])
    } catch {}
  }

  useEffect(() => {
    fetch('/api/settings/hp-sync')
      .then(r => r.json())
      .then(j => {
        setHpEnabled(!!j.hp_sync_enabled)
        setHpEmail(j.hp_email || '')
        setHpPasswordSet(!!j.hp_password_set)
        setHpPasswordMasked(j.hp_password_masked || '')
        setHpSyncEmail(j.hp_sync_email || '')
        setHpLastSyncedAt(j.hp_last_synced_at || null)
      })
      .catch(() => {})
    loadHpLogs()
  }, [])

  useEffect(() => {
    if (hpToast) {
      const t = setTimeout(() => setHpToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [hpToast])

  const saveHpSettings = async () => {
    setHpSaving(true)
    try {
      const payload: Record<string, unknown> = {
        hp_email: hpEmail,
        hp_sync_enabled: hpEnabled,
      }
      if (hpPassword) {
        payload.hp_password = hpPassword
      }
      const res = await fetch('/api/settings/hp-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setHpPassword('')
      setHpToast({ message: 'HP連携設定を保存しました', type: 'success' })
      // 再読込
      const r2 = await fetch('/api/settings/hp-sync')
      const j2 = await r2.json()
      setHpPasswordSet(!!j2.hp_password_set)
      setHpPasswordMasked(j2.hp_password_masked || '')
    } catch {
      setHpToast({ message: '保存に失敗しました', type: 'error' })
    } finally {
      setHpSaving(false)
    }
  }

  const runManualSync = async () => {
    setHpSyncing(true)
    try {
      const res = await fetch('/api/hp-sync/manual', { method: 'POST' })
      const j = await res.json()
      if (!res.ok || j.error) {
        setHpToast({ message: j.error || '同期に失敗しました', type: 'error' })
      } else {
        setHpToast({
          message: `同期完了：新規${j.inserted} / 更新${j.updated} / 重複${j.duplicate}`,
          type: 'success',
        })
        setHpLastSyncedAt(new Date().toISOString())
      }
      await loadHpLogs()
    } catch {
      setHpToast({ message: '同期に失敗しました', type: 'error' })
    } finally {
      setHpSyncing(false)
    }
  }

  const copySyncEmail = () => {
    if (!hpSyncEmail) return
    navigator.clipboard.writeText(hpSyncEmail).then(() => {
      setHpCopied(true)
      setTimeout(() => setHpCopied(false), 1500)
    })
  }

  const save = async () => {
    try {
      await fetch('/api/settings/salon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.salonName,
          phone: settings.phone,
          address: settings.address,
          business_hours: settings.businessHours,
          targets: settings.targets,
        }),
      })
      setSalonSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaved(false)
    }
  }

  const saveBeds = async (newBeds: string[]) => {
    setBeds(newBeds)
    try {
      await fetch('/api/settings/salon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beds: newBeds }),
      })
    } catch {}
  }

  const addBed = () => {
    if (newBed.trim()) {
      saveBeds([...beds, newBed.trim()])
      setNewBed('')
    }
  }

  const removeBed = (idx: number) => {
    const newBeds = beds.filter((_, i) => i !== idx)
    saveBeds(newBeds)
    setEditingBedNames(newBeds.reduce<Record<number, string>>((acc, b, i) => ({ ...acc, [i]: b }), {}))
  }

  const updateBed = (idx: number, name: string) => {
    const next = [...beds]
    next[idx] = name.trim() || next[idx]
    saveBeds(next)
  }

  const startBedsEdit = () => {
    setBedsEditing(true)
    setEditingBedNames(beds.reduce<Record<number, string>>((acc, b, i) => ({ ...acc, [i]: b }), {}))
  }

  const cancelBedsEdit = () => {
    setBedsEditing(false)
    setEditingBedNames({})
  }

  const saveLineSettings = async () => {
    setLineSaving(true)
    setLineToast(null)
    try {
      const res = await fetch('/api/settings/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_channel_access_token: lineToken,
          line_channel_secret: lineSecret,
        }),
      })
      if (!res.ok) throw new Error()
      const verifyRes = await fetch('/api/line/verify', { method: 'POST' })
      const verifyJson = await verifyRes.json()
      setLineStatus(verifyJson.connected ? 'connected' : 'error')
      setLineToast({
        message: verifyJson.connected ? 'LINE連携が完了しました' : 'トークンを確認してください',
        type: verifyJson.connected ? 'success' : 'error',
      })
    } catch {
      setLineToast({ message: '保存に失敗しました', type: 'error' })
    } finally {
      setLineSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-end">
        <button
          onClick={save}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-gradient-to-r from-rose to-lavender text-white hover:opacity-90'
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? '保存しました' : '保存する'}
        </button>
      </div>

      {/* サロン基本情報 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">サロン基本情報</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">サロン名</label>
              <input
                type="text"
                value={settings.salonName}
                onChange={e => setSettings(s => ({ ...s, salonName: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">住所</label>
              <input
                type="text"
                value={settings.address}
                onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
                placeholder="東京都〇〇区..."
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">電話番号</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))}
                placeholder="03-1234-5678"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">ホットペッパービューティーURL</label>
              <input
                type="url"
                value={settings.externalUrls?.hotpepper ?? ''}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  externalUrls: { ...(prev.externalUrls || {}), hotpepper: e.target.value }
                }))}
                placeholder="https://beauty.hotpepper.jp/..."
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">サロン公式サイトURL</label>
              <input
                type="url"
                value={settings.externalUrls?.salonHp ?? ''}
                onChange={e => setSettings(prev => ({
                  ...prev,
                  externalUrls: { ...(prev.externalUrls || {}), salonHp: e.target.value }
                }))}
                placeholder="https://your-salon.com/..."
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">営業開始時間</label>
                <select
                  value={settings.businessHours.openTime}
                  onChange={e => setSettings(s => ({
                    ...s,
                    businessHours: { ...s.businessHours, openTime: e.target.value },
                  }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
                >
                  {OPEN_TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-1">営業終了時間</label>
                <select
                  value={settings.businessHours.closeTime}
                  onChange={e => setSettings(s => ({
                    ...s,
                    businessHours: { ...s.businessHours, closeTime: e.target.value },
                  }))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
                >
                  {CLOSE_TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ベッド設定 */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="gradient-line rounded-full" />
            <span className="section-label font-dm-sans">ベッド設定</span>
          </div>
          {!bedsEditing ? (
            <button
              type="button"
              onClick={startBedsEdit}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-rose border border-rose/50 rounded-lg hover:bg-rose/5"
            >
              <Pencil className="w-4 h-4" />
              ベッドを編集
            </button>
          ) : (
            <button
              type="button"
              onClick={cancelBedsEdit}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-sub border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
              キャンセル
            </button>
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3">
            {beds.map((bed, i) => (
              <div key={`${bed}-${i}`} className="flex items-center justify-between gap-2 py-2 px-4 bg-light-lav/50 rounded-xl">
                {bedsEditing ? (
                  <>
                    <input
                      type="text"
                      value={editingBedNames[i] ?? bed}
                      onChange={(e) => setEditingBedNames(prev => ({ ...prev, [i]: e.target.value }))}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== bed) updateBed(i, v)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (editingBedNames[i] ?? bed).trim()
                          if (v && v !== bed) updateBed(i, v)
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-rose outline-none text-sm"
                      placeholder="ベッド名"
                    />
                    <button
                      type="button"
                      onClick={() => removeBed(i)}
                      className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="font-medium text-text-main">ベッド {bed}</span>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newBed}
                onChange={(e) => setNewBed(e.target.value)}
                placeholder="新規ベッド名（例: C）"
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addBed()}
              />
              <button
                type="button"
                onClick={addBed}
                className="px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 月間目標設定 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">月間目標設定</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">売上目標（円）</label>
              <input
                type="number"
                value={settings.targets.sales || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, sales: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">来店数目標（名）</label>
              <input
                type="number"
                value={settings.targets.visits || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, visits: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">客単価目標（円）</label>
              <input
                type="number"
                value={settings.targets.avgPrice || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, avgPrice: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">物販売上目標（円）</label>
              <input
                type="number"
                value={settings.targets.productSales || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, productSales: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">新規客数目標（名）</label>
              <input
                type="number"
                value={settings.targets.newCustomers || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, newCustomers: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">新規予約数目標（件）</label>
              <input
                type="number"
                value={settings.targets.newReservations || ''}
                onChange={e => setSettings(s => ({ ...s, targets: { ...s.targets, newReservations: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                onFocus={e => e.target.select()}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HP連携（ホットペッパービューティー自動同期） */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">HP連携</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />

          {/* 免責事項 */}
          <div className="flex items-start gap-2 mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              HP連携はサロンボードの自動取得を含みます。ログイン情報はAES-256で暗号化して保存されます。
              リクルート社の規約により自動アクセスは禁止されているため、
              <strong>本機能は自己責任でご利用ください</strong>。アクセス制限・BANが発生した場合、
              当社は責任を負いかねます。
            </p>
          </div>

          {/* ON/OFFトグル */}
          <div className="flex items-center justify-between mb-4 py-2">
            <div>
              <p className="font-medium text-text-main text-sm">HP連携を有効化</p>
              <p className="text-xs text-text-sub mt-0.5">メール＋スクレイピングによる自動同期</p>
            </div>
            <button
              type="button"
              onClick={() => setHpEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                hpEnabled ? 'bg-gradient-to-r from-rose to-lavender' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  hpEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 専用メールアドレス */}
          <div className="mb-4">
            <label className="text-xs text-text-sub block mb-1">
              専用メールアドレス（HPの予約通知をこのアドレスに転送）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={hpSyncEmail}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono"
              />
              <button
                type="button"
                onClick={copySyncEmail}
                className="px-4 py-2 rounded-xl border border-gray-200 text-text-main hover:bg-gray-50 flex items-center gap-1.5 text-sm"
              >
                <Copy className="w-4 h-4" />
                {hpCopied ? 'コピー済' : 'コピー'}
              </button>
            </div>
          </div>

          {/* ログイン情報 */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-text-sub block mb-1">HPログインメールアドレス</label>
              <input
                type="email"
                value={hpEmail}
                onChange={e => setHpEmail(e.target.value)}
                placeholder="your-salon@example.com"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">
                HPログインパスワード
                {hpPasswordSet && !hpPassword && (
                  <span className="ml-2 text-[10px] text-emerald-600">
                    ● 保存済み（{hpPasswordMasked}）
                  </span>
                )}
              </label>
              <input
                type="password"
                value={hpPassword}
                onChange={e => setHpPassword(e.target.value)}
                placeholder={hpPasswordSet ? '変更しない場合は空欄のまま' : 'パスワードを入力'}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm"
              />
            </div>
          </div>

          {/* 保存＋同期ボタン */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={saveHpSettings}
              disabled={hpSaving}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {hpSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
              設定を保存
            </button>
            <button
              onClick={runManualSync}
              disabled={hpSyncing || !hpEnabled || !hpPasswordSet}
              className="px-4 py-3 rounded-xl border border-rose/50 text-rose font-bold disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              title={!hpEnabled ? 'HP連携をONにしてください' : ''}
            >
              {hpSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              今すぐ同期
            </button>
          </div>

          {/* 最終同期日時 */}
          {hpLastSyncedAt && (
            <p className="text-xs text-text-sub mb-4">
              最終同期: {new Date(hpLastSyncedAt).toLocaleString('ja-JP')}
            </p>
          )}

          {/* 同期ログ（直近10件） */}
          {hpLogs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-main mb-2">同期ログ（直近{hpLogs.length}件）</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {hpLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-light-lav/30 text-xs"
                  >
                    <span
                      className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                        log.status === 'success'
                          ? 'bg-emerald-500'
                          : log.status === 'duplicate'
                            ? 'bg-gray-400'
                            : log.status === 'skipped'
                              ? 'bg-amber-400'
                              : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-text-main">
                          {log.source === 'email'
                            ? 'メール'
                            : log.source === 'scrape'
                              ? 'スクレイピング'
                              : '手動'}
                        </span>
                        <span className="text-text-sub shrink-0">
                          {new Date(log.created_at).toLocaleString('ja-JP', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.message && (
                        <p className="text-text-sub mt-0.5 break-all">{log.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* LINE連携 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">LINE連携</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <h3 className="font-bold text-text-main mb-4">LINE連携設定</h3>
          <div className={`flex items-center gap-2 mb-4 px-4 py-3 rounded-xl ${lineStatus === 'connected' ? 'bg-emerald-50 border border-emerald-200' : lineStatus === 'error' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${lineStatus === 'connected' ? 'bg-emerald-500' : lineStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
            <p className="text-sm font-medium">{lineStatus === 'connected' ? 'LINE連携済み' : lineStatus === 'error' ? '連携エラー' : '未連携'}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-sub block mb-1">チャンネルアクセストークン</label>
              <input type="password" value={lineToken} onChange={e => setLineToken(e.target.value)}
                placeholder="LINE Developersから取得したトークン"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">チャンネルシークレット</label>
              <input type="password" value={lineSecret} onChange={e => setLineSecret(e.target.value)}
                placeholder="LINE Developersから取得したシークレット"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
            </div>
            <button onClick={saveLineSettings} disabled={lineSaving || !lineToken || !lineSecret}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {lineSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'LINE連携を保存・確認'}
            </button>
          </div>
          <p className="text-xs text-text-sub mt-3">
            LINE Developers（https://developers.line.biz）でMessaging APIチャンネルを作成し、
            チャンネルアクセストークンとチャンネルシークレットを取得してください。
          </p>
        </div>
      </section>

      {lineToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg font-medium ${lineToast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {lineToast.message}
        </div>
      )}
      {hpToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-lg font-medium ${hpToast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {hpToast.message}
        </div>
      )}
    </div>
  )
}
