'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Save } from 'lucide-react'
import { getSalonSettings, setSalonSettings, type SalonSettings } from '@/lib/salon-settings'

export default function SettingsPage() {
  const [settings, setSettings] = useState<SalonSettings>({
    salonName: '',
    address: '',
    phone: '',
    businessHours: '10:00〜20:00',
    beds: [],
    staff: [],
    targets: { sales: 600000, visits: 60, avgPrice: 10000, productSales: 50000, newCustomers: 10, newReservations: 15 },
    externalUrls: { hotpepper: '', salonHp: '' },
  })
  const [newBed, setNewBed] = useState('')
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffColor, setNewStaffColor] = useState('#C4728A')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(getSalonSettings())
  }, [])

  const save = () => {
    setSalonSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addBed = () => {
    if (newBed.trim()) {
      setSettings(s => ({ ...s, beds: [...s.beds, newBed.trim()] }))
      setNewBed('')
    }
  }

  const removeBed = (idx: number) => {
    setSettings(s => ({ ...s, beds: s.beds.filter((_, i) => i !== idx) }))
  }

  const addStaff = () => {
    if (newStaffName.trim()) {
      setSettings(s => ({
        ...s,
        staff: [...s.staff, { name: newStaffName.trim(), color: newStaffColor }],
      }))
      setNewStaffName('')
      setNewStaffColor('#C4728A')
    }
  }

  const removeStaff = (idx: number) => {
    setSettings(s => ({ ...s, staff: s.staff.filter((_, i) => i !== idx) }))
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
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">営業時間</label>
              <input
                type="text"
                value={settings.businessHours}
                onChange={e => setSettings(s => ({ ...s, businessHours: e.target.value }))}
                placeholder="10:00〜20:00"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ベッド設定 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">ベッド設定</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3">
            {settings.beds.map((bed, i) => (
              <div key={bed} className="flex items-center justify-between py-2 px-4 bg-light-lav/50 rounded-xl">
                <span className="font-medium text-text-main">ベッド {bed}</span>
                <button
                  onClick={() => removeBed(i)}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newBed}
                onChange={(e) => setNewBed(e.target.value)}
                placeholder="新規ベッド名（例: C）"
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
              <button
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

      {/* スタッフ設定 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans">スタッフ設定</span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="space-y-3">
            {settings.staff.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between py-2 px-4 bg-light-lav/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.name[0]}
                  </div>
                  <span className="font-medium text-text-main">{s.name}</span>
                </div>
                <button
                  onClick={() => removeStaff(i)}
                  className="p-2 text-text-sub hover:text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="スタッフ名"
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none"
              />
              <input
                type="color"
                value={newStaffColor}
                onChange={(e) => setNewStaffColor(e.target.value)}
                className="w-12 h-10 rounded-xl border border-gray-200 cursor-pointer"
              />
              <button
                onClick={addStaff}
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
                value={settings.targets.sales}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, sales: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">来店数目標（名）</label>
              <input
                type="number"
                value={settings.targets.visits}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, visits: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">客単価目標（円）</label>
              <input
                type="number"
                value={settings.targets.avgPrice}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, avgPrice: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">物販売上目標（円）</label>
              <input
                type="number"
                value={settings.targets.productSales ?? 0}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, productSales: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">新規客数目標（名）</label>
              <input
                type="number"
                value={settings.targets.newCustomers ?? 0}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, newCustomers: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">新規予約数目標（件）</label>
              <input
                type="number"
                value={settings.targets.newReservations ?? 0}
                onChange={(e) => setSettings(s => ({ ...s, targets: { ...s.targets, newReservations: Number(e.target.value) } }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose focus:ring-1 focus:ring-rose/30 outline-none font-dm-sans"
              />
            </div>
          </div>
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
          <p className="text-sm text-text-sub mb-4">
            LINE公式アカウントと連携すると、自動フォローや予約リマインドが利用できます。
          </p>
          <Link
            href="/line"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose to-lavender text-white rounded-xl font-medium hover:opacity-90"
          >
            LINE連携設定へ
          </Link>
        </div>
      </section>
    </div>
  )
}
