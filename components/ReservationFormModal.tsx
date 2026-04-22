'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Loader2, Ticket } from 'lucide-react'
import type { Customer } from '@/types'
import { fetchMenus, getCategories, type MenuItem } from '@/lib/menus'

interface CourseTicket {
  id: string
  plan_name: string
  menu_name: string
  remaining_count: number
  total_sessions: number
  unit_price: number | null
  expiry_date: string | null
  ticket_type: 'ticket'
}

interface CourseSub {
  id: string
  plan_name: string
  menu_name: string
  sessions_per_month: number
  sessions_used: number
  price: number
  duration_minutes: number
  ticket_type: 'subscription'
}

type ShiftItem = { staff_id: string; staff_name?: string; date: string; start_time: string; end_time: string; staff?: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null }

function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 10:00〜21:00 を15分刻み（シフトがない場合のデフォルト）
function buildDefaultTimeOptions(): string[] {
  const opts: string[] = []
  for (let h = 10; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break
      opts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
  }
  return opts
}

function calculateEndTime(start: string, minutes: number): string {
  const [h = 10, m = 0] = start.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutes
  const endH = Math.floor(total / 60)
  const endM = total % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export type CustomerMode = 'existing' | 'temporary' | 'name_only'

export interface StaffOption {
  name: string
  color?: string
}

export interface ReservationFormModalProps {
  defaultDate: string
  defaultStartTime?: string
  defaultEndTime?: string
  defaultBed?: string
  beds?: string[]
  /** 出勤スタッフ（親から渡す場合。空ならAPIから取得） */
  staffList?: StaffOption[]
  onClose: () => void
  onSaved: () => void
}

export default function ReservationFormModal({
  defaultDate,
  defaultStartTime = '10:00',
  defaultEndTime,
  defaultBed,
  beds: bedsProp = ['A', 'B'],
  staffList: staffListProp,
  onClose,
  onSaved,
}: ReservationFormModalProps) {
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [menuCategory, setMenuCategory] = useState<string>('')
  const [mode, setMode] = useState<CustomerMode>('existing')
  const [shifts, setShifts] = useState<ShiftItem[]>([])
  const [beds, setBedsState] = useState<string[]>(bedsProp)
  const [holidays, setHolidays] = useState<string[]>([])
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '',
    reservation_date: defaultDate,
    start_time: defaultStartTime,
    end_time: defaultEndTime ?? calculateEndTime(defaultStartTime, 60),
    bed_id: defaultBed || bedsProp[0] || 'A',
    menus: [] as string[],
    staff_name: '',
    price: '',
    memo: '',
  })
  const [courseTickets, setCourseTickets] = useState<CourseTicket[]>([])
  const [courseSubs, setCourseSubs] = useState<CourseSub[]>([])
  const [selectedCourse, setSelectedCourse] = useState<{ type: 'ticket' | 'subscription'; id: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflictInfo, setConflictInfo] = useState<{ customer_name: string; start_time: string; end_time: string; type: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<Customer[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [staffList, setStaffList] = useState<StaffOption[]>(staffListProp ?? [])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // エラー発生時にスクロールして見えるようにする
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [error])

  // シフト・ベッド・定休日を取得
  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => {
        const newBeds = j.beds || bedsProp
        setBedsState(newBeds)
        setForm(p => {
          if (newBeds.length > 0 && !newBeds.includes(p.bed_id)) {
            return { ...p, bed_id: newBeds[0] }
          }
          return p
        })
      })

    const month = form.reservation_date?.slice(0, 7) || new Date().toISOString().slice(0, 7)
    fetch(`/api/shifts?month=${month}`)
      .then(r => r.json())
      .then(j => setShifts(j.shifts || []))

    fetch(`/api/holidays?month=${month}`)
      .then(r => r.json())
      .then(j => setHolidays((j.holidays || []).map((h: { date: string }) => h.date)))
  }, [bedsProp, form.reservation_date])

  // メニュー管理と連動: モーダルが開くたびに最新のメニュー・カテゴリを取得
  useEffect(() => {
    fetchMenus().then(setMenus)
    setCategories(getCategories())
    setMenuCategory('')
  }, [defaultDate, defaultStartTime, defaultBed])

  function getStaffNameFromShift(s: ShiftItem): string {
    const staff = Array.isArray(s.staff) ? s.staff[0] : s.staff
    return staff?.name ?? ''
  }

  const buildTimeOptions = useCallback(() => {
    const defaultOpts = () => Array.from({ length: 45 }, (_, i) => minutesToTime(600 + i * 15))
    if (!form.reservation_date) return defaultOpts()
    if (holidays.includes(form.reservation_date)) return []
    const dayShifts = shifts.filter(s => s.date === form.reservation_date)
    if (dayShifts.length === 0) return defaultOpts()
    const allStarts = dayShifts.map(s => timeToMinutes(s.start_time))
    const allEnds = dayShifts.map(s => timeToMinutes(s.end_time))
    const earliest = Math.min(...allStarts)
    const latest = Math.max(...allEnds)
    const options: string[] = []
    for (let t = earliest; t <= latest; t += 15) {
      options.push(minutesToTime(t))
    }
    return options
  }, [form.reservation_date, shifts, holidays])

  const getStaffTimeOptions = useCallback((staffName: string) => {
    if (!form.reservation_date || !staffName) return buildTimeOptions()
    const staffShift = shifts.find(s =>
      s.date === form.reservation_date && getStaffNameFromShift(s) === staffName
    )
    if (!staffShift) return buildTimeOptions()
    const options: string[] = []
    const start = timeToMinutes(staffShift.start_time)
    const end = timeToMinutes(staffShift.end_time)
    for (let t = start; t <= end; t += 15) {
      options.push(minutesToTime(t))
    }
    return options
  }, [form.reservation_date, shifts, buildTimeOptions])

  const timeOptions = form.staff_name ? getStaffTimeOptions(form.staff_name) : buildTimeOptions()
  const startTimeOptions = timeOptions.length > 0 ? timeOptions : buildDefaultTimeOptions()
  const endTimeOptions = timeOptions.length > 0 ? timeOptions : buildDefaultTimeOptions()

  // 開始・終了時間がオプションに含まれない場合に調整
  useEffect(() => {
    if (startTimeOptions.length === 0) return
    const startValid = startTimeOptions.includes(form.start_time)
    const endValid = endTimeOptions.includes(form.end_time)
    if (!startValid || !endValid) {
      setForm(p => ({
        ...p,
        start_time: startValid ? p.start_time : startTimeOptions[0],
        end_time: endValid ? p.end_time : (startValid ? calculateEndTime(p.start_time, 60) : calculateEndTime(startTimeOptions[0], 60)),
      }))
    }
  }, [startTimeOptions, endTimeOptions])

  const filteredMenus = menuCategory
    ? menus.filter(m => (m.category || '').trim() === menuCategory)
    : menus

  // カテゴリ変更時に、選択中のメニューがフィルタ結果に含まれなければ除外
  useEffect(() => {
    if (form.menus.length > 0 && menuCategory) {
      const filtered = form.menus.filter(name => filteredMenus.some(m => m.name === name))
      if (filtered.length !== form.menus.length) {
        setForm(p => ({ ...p, menus: filtered }))
      }
    }
  }, [menuCategory, filteredMenus, form.menus])

  // 担当スタッフ: 親から渡されていれば使用、そうでなければ /api/staff から取得
  useEffect(() => {
    if (staffListProp && staffListProp.length > 0) {
      setStaffList(staffListProp)
      return
    }
    fetch('/api/staff')
      .then(r => r.json())
      .then(j => {
        const list = (j.staff || []).filter((s: { is_active?: boolean }) => s.is_active !== false)
        if (list.length > 0) setStaffList(list)
      })
      .catch(() => {})
  }, [staffListProp])

  // 予約表の空き枠クリック時: 日付・開始時間・ベッドを自動入力
  useEffect(() => {
    setForm(p => ({
      ...p,
      reservation_date: defaultDate,
      start_time: defaultStartTime,
      bed_id: defaultBed ?? p.bed_id,
      end_time: defaultEndTime ?? calculateEndTime(defaultStartTime, 60),
    }))
  }, [defaultDate, defaultStartTime, defaultEndTime, defaultBed])

  // サブスクが選択されていれば固定時間、追加メニューの合計時間も加算
  const selectedSub = selectedCourse?.type === 'subscription'
    ? courseSubs.find(s => s.id === selectedCourse.id) ?? null
    : null
  const subDurationMin = selectedSub?.duration_minutes ?? 0
  const subMenuName = selectedSub?.menu_name ?? null

  // 開始時間またはメニューが変わったら終了時間を再計算
  //   合計 = サブスク時間 + 追加メニュー時間の合計
  //   サブスクの menu_name と同じ追加メニューが form.menus に入っていた場合は
  //   二重計上しない
  const startTime = form.start_time
  const selectedMenuNames = form.menus
  useEffect(() => {
    if (!startTime) return
    const additional = subMenuName
      ? selectedMenuNames.filter(n => n !== subMenuName)
      : selectedMenuNames
    const menuDuration = additional.reduce((sum, name) => {
      const m = menus.find(menu => menu.name === name)
      return sum + (m?.duration ?? 0)
    }, 0)
    const totalDuration = (subDurationMin + menuDuration) || 60
    const end = calculateEndTime(startTime, totalDuration)
    setForm(p => ({ ...p, end_time: end }))
  }, [startTime, selectedMenuNames, menus, subDurationMin, subMenuName])

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
    // 保有コース・サブスクを取得
    fetchCustomerCourses(c.id)
  }

  function fetchCustomerCourses(customerId: string) {
    setCourseTickets([])
    setCourseSubs([])
    setSelectedCourse(null)
    fetch(`/api/customers/${customerId}/tickets`)
      .then(r => r.json())
      .then(d => {
        setCourseTickets(d.tickets || [])
        setCourseSubs(d.subscriptions || [])
      })
      .catch(() => {})
  }

  function resetCustomerFields() {
    setForm(p => ({ ...p, customer_name: '', customer_phone: '', customer_id: '' }))
    setSearchQuery('')
    setCandidates([])
    setShowDropdown(false)
    setCourseTickets([])
    setCourseSubs([])
    setSelectedCourse(null)
  }

  async function handleSubmit() {
    setError('')
    setConflictInfo(null)
    if (!form.customer_name.trim()) {
      setError('顧客名は必須です')
      return
    }
    if (mode === 'temporary' && !form.customer_phone.trim()) {
      setError('仮登録の場合は電話番号も入力してください')
      return
    }
    const durationMinutes = Math.max(1, timeToMinutes(form.end_time) - timeToMinutes(form.start_time))
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

      const reservationBody: Record<string, unknown> = {
        customer_id: customerId,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        reservation_date: form.reservation_date,
        start_time: form.start_time,
        end_time: form.end_time,
        bed_id: form.bed_id || undefined,
        duration_minutes: durationMinutes,
        menu: form.menus.length > 0 ? form.menus.join(', ') : undefined,
        staff_name: form.staff_name || undefined,
        price: selectedCourse ? 0 : (parseInt(form.price) || 0),
        memo: form.memo || undefined,
        is_course: !!selectedCourse,
        ticket_id: selectedCourse?.type === 'ticket' ? selectedCourse.id : undefined,
        subscription_id: selectedCourse?.type === 'subscription' ? selectedCourse.id : undefined,
      }

      const res = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationBody),
      })
      if (!res.ok) {
        const err = await res.json()
        // 409 = 重複エラー
        if (res.status === 409 && err.conflict) {
          setConflictInfo({
            customer_name: err.conflict.customer_name,
            start_time: err.conflict.start_time,
            end_time: err.conflict.end_time,
            type: err.conflictType || 'bed',
          })
        }
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
          {/* 1. 日付 */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">予約日</label>
            <input
              type="date"
              value={form.reservation_date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => {
                const value = e.target.value
                if (holidays.includes(value)) {
                  alert('この日は定休日です')
                  return
                }
                setForm(p => ({ ...p, reservation_date: value }))
              }}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
            />
          </div>

          {/* 2. 開始時間 */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">開始時間</label>
            <select value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
              {startTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 3. 終了時間（メニュー選択後に自動計算・手動変更可） */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">終了時間</label>
            <select value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
              className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
              {endTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 4. 顧客選択 */}
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

          <div ref={dropdownRef} className="relative">
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
                      <div className="flex gap-2 px-3 py-3 text-[#4A5568] text-sm">
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
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">電話番号 {mode === 'temporary' ? '*' : '（任意）'}</label>
              <input
                value={form.customer_phone}
                onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]"
                placeholder="090-0000-0000"
              />
            </div>
          )}

          {/* 5a. 保有コース・サブスク */}
          {(courseTickets.length > 0 || courseSubs.length > 0) && (
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5" /> 保有コース・サブスク
              </label>
              <div className="border border-[#BAE6FD] rounded-lg p-2 space-y-1 bg-[#F0FFF4]">
                {courseTickets.map(t => (
                  <label key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white ${selectedCourse?.id === t.id ? 'bg-white border border-[#0891B2]' : ''}`}>
                    <input
                      type="radio"
                      name="course_select"
                      checked={selectedCourse?.id === t.id}
                      onChange={() => {
                        setSelectedCourse({ type: 'ticket', id: t.id })
                        const menuName = t.menu_name || t.plan_name
                        setForm(p => ({ ...p, menus: menuName ? [menuName] : p.menus, price: '0' }))
                      }}
                      className="accent-[#0891B2]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#1A202C]">{t.plan_name}</span>
                      <span className="text-xs text-[#4A5568] ml-2">残{t.remaining_count}/{t.total_sessions}回</span>
                    </div>
                    <span className="text-xs font-medium text-emerald-600 shrink-0">コース消化</span>
                  </label>
                ))}
                {courseSubs.map(s => {
                  const remaining = s.sessions_per_month - s.sessions_used
                  return (
                    <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white ${selectedCourse?.id === s.id ? 'bg-white border border-[#0891B2]' : ''}`}>
                      <input
                        type="radio"
                        name="course_select"
                        checked={selectedCourse?.id === s.id}
                        onChange={() => {
                          setSelectedCourse({ type: 'subscription', id: s.id })
                          const menuName = s.menu_name || s.plan_name
                          setForm(p => ({ ...p, menus: menuName ? [menuName] : p.menus, price: '0' }))
                        }}
                        className="accent-[#0891B2]"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[#1A202C]">{s.plan_name}</span>
                        <span className="text-xs text-[#4A5568] ml-2">今月残{remaining}/{s.sessions_per_month}回</span>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 shrink-0">サブスク消化</span>
                    </label>
                  )
                })}
                {selectedCourse && (
                  <button
                    type="button"
                    onClick={() => { setSelectedCourse(null); setForm(p => ({ ...p, price: '' })) }}
                    className="text-xs text-[#4A5568] hover:text-red-500 px-2 py-1"
                  >
                    選択を解除
                  </button>
                )}
              </div>
              {selectedCourse && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">コース消化予約（金額: ¥0）</p>
              )}
            </div>
          )}

          {/* 5b. 施術メニュー（メニュー管理と連動・カテゴリでフィルタ） */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">
              {(courseTickets.length > 0 || courseSubs.length > 0) ? 'その他メニュー' : '施術メニュー'}
            </label>
            <div className="space-y-2">
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMenuCategory('')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      menuCategory === '' ? 'bg-[#0891B2] text-white' : 'bg-white border border-[#BAE6FD] text-[#4A5568] hover:border-[#0891B2]'
                    }`}
                  >
                    全て
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMenuCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        menuCategory === cat ? 'bg-[#0891B2] text-white' : 'bg-white border border-[#BAE6FD] text-[#4A5568] hover:border-[#0891B2]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-40 overflow-y-auto border border-[#BAE6FD] rounded-lg p-2 space-y-1">
                {filteredMenus.length === 0 ? (
                  <p className="text-xs text-[#4A5568] py-1">メニューがありません</p>
                ) : filteredMenus.map(m => (
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
                            const found = menus.find(menu => menu.name === name)
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
              {(form.menus.length > 0 || subDurationMin > 0) && (() => {
                const additional = subMenuName
                  ? form.menus.filter(n => n !== subMenuName)
                  : form.menus
                const menuDuration = additional.reduce((s, name) => {
                  const m = menus.find(menu => menu.name === name)
                  return s + (m?.duration ?? 0)
                }, 0)
                const totalDuration = subDurationMin + menuDuration
                return (
                  <p className="text-xs text-[#0891B2] mt-1">
                    {form.menus.length}件選択 · 合計{totalDuration}分
                    {subDurationMin > 0 && <span className="text-text-sub ml-1">(サブスク{subDurationMin}分＋追加{menuDuration}分)</span>}
                  </p>
                )
              })()}
            </div>
          </div>

          {/* 6. 担当スタッフ（出勤スタッフから選択） */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">担当スタッフ</label>
            {staffList.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staffList.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      const value = form.staff_name === s.name ? '' : s.name
                      const staffShift = value && form.reservation_date
                        ? shifts.find(sh => sh.date === form.reservation_date && getStaffNameFromShift(sh) === value)
                        : null
                      if (staffShift) {
                        const currentStart = timeToMinutes(form.start_time || '10:00')
                        const shiftStart = timeToMinutes(staffShift.start_time)
                        const shiftEnd = timeToMinutes(staffShift.end_time)
                        if (currentStart < shiftStart || currentStart >= shiftEnd) {
                          setForm(p => ({ ...p, staff_name: value, start_time: staffShift.start_time }))
                          return
                        }
                      }
                      setForm(p => ({ ...p, staff_name: value }))
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.staff_name === s.name
                        ? 'text-white ring-2 ring-[#0891B2]'
                        : 'bg-white border border-[#BAE6FD] text-[#4A5568] hover:border-[#0891B2]'
                    }`}
                    style={form.staff_name === s.name ? { backgroundColor: s.color || '#0891B2' } : undefined}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#4A5568] py-2">スタッフを読み込み中...</p>
            )}
          </div>

          {/* 7. ベッド選択 */}
          {beds.length > 0 && (
            <div>
              <label className="text-xs text-[#4A5568] mb-1 block">ベッド</label>
              <select value={form.bed_id} onChange={e => setForm(p => ({ ...p, bed_id: e.target.value }))}
                className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2]">
                {beds.map(bed => (
                  <option key={bed} value={bed}>{bed}</option>
                ))}
              </select>
            </div>
          )}

          {/* 8. メモ・備考 */}
          <div>
            <label className="text-xs text-[#4A5568] mb-1 block">メモ・備考</label>
            <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={2} className="w-full bg-white border border-[#BAE6FD] rounded-lg px-3 py-2 text-sm text-[#1A202C] focus:outline-none focus:border-[#0891B2] resize-none"
              placeholder="アレルギーや注意事項など" />
          </div>
        </div>
        {/* エラー表示（保存ボタン直上に固定） */}
        {error && (
          <div ref={errorRef} className="px-5 py-3 bg-red-50 border-t border-red-200 shrink-0">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            {conflictInfo && (
              <p className="text-xs text-red-500 mt-1">
                {conflictInfo.type === 'staff'
                  ? '⚠️ スタッフの予約が重複しています'
                  : conflictInfo.type === 'customer'
                    ? '⚠️ 同一お客様の予約が時間重複しています'
                    : '⚠️ ベッドの予約が重複しています'}
                ：{conflictInfo.customer_name}様 {conflictInfo.start_time}〜{conflictInfo.end_time}
              </p>
            )}
            <p className="text-xs text-red-400 mt-1">時間やベッドを変更して再度お試しください</p>
          </div>
        )}
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
