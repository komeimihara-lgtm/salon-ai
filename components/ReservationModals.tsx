'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Reservation } from '@/types'

const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']
interface MenuItemSimple { id: string; name: string; duration: number; price: number; category: string }

export function RescheduleModal({ reservation, onClose, onSaved }: { reservation: Reservation; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    reservation_date: reservation.reservation_date,
    start_time: reservation.start_time?.slice(0, 5) || '10:00',
    end_time: reservation.end_time?.slice(0, 5) || '11:00',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/reservations/reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservation.id, ...form }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onSaved()
      onClose()
    } catch {
      setError('リスケに失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm border border-[#E8E0F0] card-shadow">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-text-main">リスケ</h2>
          <button onClick={onClose} className="text-text-sub hover:text-text-main"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs text-text-sub mb-1 block">新しい予約日</label>
            <input type="date" value={form.reservation_date} onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-sub mb-1 block">開始</label>
              <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">終了</label>
              <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 text-text-main rounded-xl py-2.5 text-sm hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-gradient-to-r from-rose to-lavender text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export function EditReservationModal({ reservation, onClose, onSaved }: { reservation: Reservation; onClose: () => void; onSaved: () => void }) {
  const initialMenus = reservation.menu ? reservation.menu.split(',').map(s => s.trim()).filter(Boolean) : []
  const [form, setForm] = useState({
    menus: initialMenus,
    reservation_date: reservation.reservation_date,
    start_time: reservation.start_time?.slice(0, 5) || '10:00',
    end_time: reservation.end_time?.slice(0, 5) || '11:00',
    staff_name: reservation.staff_name || '',
    bed_id: reservation.bed_id || '',
    price: String(reservation.price || 0),
    memo: reservation.memo || '',
  })
  const [menuItems, setMenuItems] = useState<MenuItemSimple[]>([])
  const [beds, setBeds] = useState<string[]>(['A', 'B'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/menus').then(r => r.json()).then(j => setMenuItems(j.menus || [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => {
        if (Array.isArray(j.beds) && j.beds.length > 0) setBeds(j.beds)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/reservations/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
          menu: form.menus.join(', '),
          reservation_date: form.reservation_date,
          start_time: form.start_time,
          end_time: form.end_time,
          staff_name: form.staff_name,
          bed_id: form.bed_id || null,
          price: parseInt(form.price) || 0,
          memo: form.memo,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      onSaved()
      onClose()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#E8E0F0] card-shadow">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-base font-bold text-text-main">予約を編集</h2>
          <button onClick={onClose} className="text-text-sub hover:text-text-main"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs text-text-sub mb-1 block">メニュー</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
              {menuItems.length === 0 ? (
                <p className="text-xs text-text-sub py-1">メニューを読み込み中...</p>
              ) : menuItems.map(m => (
                <label key={m.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#F0F9FF] ${form.menus.includes(m.name) ? 'bg-[#F0F9FF] border border-[#0891B2]' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.menus.includes(m.name)}
                    onChange={() => {
                      setForm(p => {
                        const newMenus = p.menus.includes(m.name)
                          ? p.menus.filter(n => n !== m.name)
                          : [...p.menus, m.name]
                        const totalPrice = newMenus.reduce((sum, name) => {
                          const found = menuItems.find(mi => mi.name === name)
                          return sum + (found?.price ?? 0)
                        }, 0)
                        return { ...p, menus: newMenus, price: totalPrice > 0 ? String(totalPrice) : p.price }
                      })
                    }}
                    className="accent-[#0891B2]"
                  />
                  <span className="text-sm text-[#1A202C]">{m.name}</span>
                  <span className="text-xs text-[#4A5568] ml-auto">{m.duration}分 / ¥{m.price.toLocaleString()}</span>
                </label>
              ))}
            </div>
            {form.menus.length > 0 && (
              <p className="text-xs text-[#0891B2] mt-1">
                {form.menus.length}件選択 · 合計{menuItems.filter(m => form.menus.includes(m.name)).reduce((s, m) => s + m.duration, 0)}分
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">予約日</label>
            <input type="date" value={form.reservation_date} onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-sub mb-1 block">開始</label>
              <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-sub mb-1 block">終了</label>
              <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">担当スタッフ</label>
            <input value={form.staff_name} onChange={e => setForm(p => ({ ...p, staff_name: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none" placeholder="田中" />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">ベッド</label>
            <select
              value={form.bed_id}
              onChange={e => setForm(p => ({ ...p, bed_id: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none"
            >
              <option value="">未指定</option>
              {beds.map(b => (
                <option key={b} value={b}>ベッド{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">金額（円）</label>
            <input type="number" value={form.price} onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setForm(p => ({ ...p, price: val })) }}
              onFocus={e => e.target.select()} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-rose outline-none" placeholder="15000" />
          </div>
          <div>
            <label className="text-xs text-text-sub mb-1 block">メモ</label>
            <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={2} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:border-rose outline-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 bg-white border border-gray-200 text-text-main rounded-xl py-2.5 text-sm hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-gradient-to-r from-rose to-lavender text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
