'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import type { Customer } from '@/types'

const MENUS = ['フェイシャル60分', 'フェイシャル90分', 'ボディ60分', 'ボディ90分', '美白コース', 'エイジングケア']
const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']

export type CustomerMode = 'existing' | 'temporary' | 'name_only'

export interface ReservationFormModalProps {
  defaultDate: string
  defaultStartTime?: string
  defaultEndTime?: string
  onClose: () => void
  onSaved: () => void
}

export default function ReservationFormModal({
  defaultDate,
  defaultStartTime = '10:00',
  defaultEndTime = '11:00',
  onClose,
  onSaved,
}: ReservationFormModalProps) {
  const [mode, setMode] = useState<CustomerMode>('existing')
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '',
    reservation_date: defaultDate,
    start_time: defaultStartTime,
    end_time: defaultEndTime,
    menu: '',
    staff_name: '',
    price: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<Customer[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setForm(p => ({
      ...p,
      reservation_date: defaultDate,
      start_time: defaultStartTime,
      end_time: defaultEndTime,
    }))
  }, [defaultDate, defaultStartTime, defaultEndTime])

  useEffect(() => {
    if (!searchQuery.trim() || mode !== 'existing') {
      setCandidates([])
      setShowDropdown(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingCandidates(true)
      setShowDropdown(true)
      try {
        const res = await fetch(`/api/customers/list?search=${encodeURIComponent(searchQuery.trim())}`)
        const data = await res.json()
        setCandidates(data.customers ?? [])
      } catch {
        setCandidates([])
      } finally {
        setLoadingCandidates(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, mode])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectCustomer(c: Customer) {
    setForm(prev => ({
      ...prev,
      customer_name: c.name,
      customer_phone: c.phone ?? '',
      customer_id: c.id,
    }))
    setSearchQuery('')
    setCandidates([])
    setShowDropdown(false)
  }

  function resetCustomerFields() {
    setForm(p => ({ ...p, customer_name: '', customer_phone: '', customer_id: '' }))
    setSearchQuery('')
    setCandidates([])
    setShowDropdown(false)
  }

  async function handleSubmit() {
    setError('')
    if (!form.customer_name.trim()) {
      setError('顧客名は必須です')
      return
    }
    if (mode === 'temporary' && !form.customer_phone.trim()) {
      setError('仮登録の場合は電話番号も入力してください')
      return
    }
    setSaving(true)
    try {
      let customerId: string | undefined = form.customer_id || undefined

      if (mode === 'temporary') {
        const cr = await fetch('/api/customers/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.customer_name.trim(),
            phone: form.customer_phone.trim() || null,
            status: 'temporary',
          }),
        })
        if (!cr.ok) {
          const err = await cr.json()
          throw new Error(err.error || '顧客の仮登録に失敗しました')
        }
        const { customer } = await cr.json()
        customerId = customer.id
      }

      const res = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim() || undefined,
          reservation_date: form.reservation_date,
          start_time: form.start_time,
          end_time: form.end_time,
          menu: form.menu || undefined,
          staff_name: form.staff_name || undefined,
          price: parseInt(form.price) || 0,
          memo: form.memo || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '予約の登録に失敗しました')
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#BAE6FD] shrink-0">
          <h2 className="text-base font-bold text-[#1A202C]">新規予約</h2>
          <button onClick={onClose} className="text-[#4A5568] hover:text-[#1A202C]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          {/* 顧客選択パターン */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">顧客の登録方法</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '既存顧客から選択', value: 'existing' as const },
                { label: '新規顧客として仮登録', value: 'temporary' as const },
                { label: '未定（名前のみ）', value: 'name_only' as const },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setMode(value); resetCustomerFields() }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === value
                      ? 'bg-[#0891B2] text-white'
                      : 'bg-white border border-[#BAE6FD] text-[#4A5568] hover:border-[#0891B2]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 顧客入力 */}
          <div className="grid grid-cols-2 gap-3">
            <div ref={dropdownRef} className="relative col-span-2">
              <label className="text-xs text-[#4A5568] mb-1 block">顧客名 *</label>
              {mode === 'existing' ? (
                <>
                  <input
                    value={form.customer_name}
                    onChange={e => {
                      const v = e.target.value
                      setForm(p => ({ ...p, customer_name: v, customer_id: '' }))
                      setSearchQuery(v)
                    }}
                    onFocus={() => searchQuery && setShowDropdown(true)}
                    className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                    placeholder="名前で検索"
                  />
                  {showDropdown && searchQuery.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#BAE6FD] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                      {loadingCandidates ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-[#4A5568] text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          検索中...
                        </div>
                      ) : candidates.length === 0 ? (
                        <p className="px-3 py-3 text-[#4A5568] text-sm">該当する顧客がいません</p>
                      ) : (
                        <ul className="py-1">
                          {candidates.map(c => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => selectCustomer(c)}
                                className="w-full text-left px-3 py-2 text-sm text-[#1A202C] hover:bg-[#BAE6FD] flex items-center justify-between gap-2"
                              >
                                <span>{c.name}</span>
                                {c.phone && <span className="text-[#4A5568] text-xs">{c.phone}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <input
                  value={form.customer_name}
                  onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                  placeholder={mode === 'temporary' ? '名前（仮登録）' : '名前のみ（後から紐づけ可）'}
                />
              )}
            </div>
            {(mode === 'temporary' || mode === 'name_only') && (
              <div className="col-span-2">
                <label className="text-xs text-[#4A5568] mb-1 block">電話番号 {mode === 'temporary' ? '*' : '（任意）'}</label>
                <input
                  value={form.customer_phone}
                  onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                  className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                  placeholder="090-0000-0000"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">予約日</label>
            <input type="date" value={form.reservation_date} onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">開始時間</label>
              <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">終了時間</label>
              <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">施術メニュー</label>
            <select value={form.menu} onChange={e => setForm(p => ({ ...p, menu: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
              <option value="">選択してください</option>
              {MENUS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">担当スタッフ</label>
            <input value={form.staff_name} onChange={e => setForm(p => ({ ...p, staff_name: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
              placeholder="田中" />
          </div>

          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メモ</label>
            <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={2} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2] resize-none"
              placeholder="アレルギーや注意事項など" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#BAE6FD] shrink-0">
          <button onClick={onClose} className="flex-1 bg-white border border-[#BAE6FD] text-[#4A5568] rounded-xl py-2.5 text-sm hover:text-[#1A202C] transition-colors">
            キャンセル
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-gradient-to-r from-[#0891B2] to-[#0e7490] text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? '保存中...' : '予約を登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
