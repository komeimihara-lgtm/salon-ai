'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'

declare global {
  interface Window { liff: any }
}

interface MenuItem { id: string; name: string; duration: number; price: number; category: string }
interface Slot { staff_id: string; staff_name: string; staff_color: string; start: string; end: string; bed_id?: string }
interface CourseTicket { id: string; plan_name: string; menu_name: string; remaining_count: number; total_sessions: number; ticket_type: 'ticket' }
interface CourseSub { id: string; plan_name: string; menu_name: string; sessions_per_month: number; sessions_used: number; ticket_type: 'subscription' }

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonday(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export default function LiffBookingPage() {
  const [liffReady, setLiffReady] = useState(false)
  const [lineUserId, setLineUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [step, setStep] = useState<'menu' | 'profile' | 'date' | 'time' | 'confirm' | 'done'>('menu')

  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)

  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [memo, setMemo] = useState('')

  const [menus, setMenus] = useState<MenuItem[]>([])
  const [slots, setSlots] = useState<Slot[]>([])

  // コース消化
  const [courseTickets, setCourseTickets] = useState<CourseTicket[]>([])
  const [courseSubs, setCourseSubs] = useState<CourseSub[]>([])
  const [selectedCourse, setSelectedCourse] = useState<{ type: 'ticket' | 'subscription'; id: string; name: string; duration: number } | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)

  // 空き状況カレンダー
  const [weekOffset, setWeekOffset] = useState(0)
  const [availMap, setAvailMap] = useState<Record<string, number | null>>({})
  const fetchedRef = useRef(new Set<string>())

  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // LIFF初期化
  useEffect(() => {
    const initLiff = async () => {
      try {
        const script = document.createElement('script')
        script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
        script.onload = async () => {
          try {
            await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
            if (window.liff.isLoggedIn()) {
              const profile = await window.liff.getProfile()
              setLineUserId(profile.userId)
              setDisplayName(profile.displayName)
            } else {
              window.liff.login()
              return
            }
          } catch (e) {
            console.error('LIFF init error:', e)
          } finally {
            setLiffReady(true)
          }
        }
        script.onerror = () => {
          setLiffReady(true)
        }
        document.head.appendChild(script)
      } catch (e) {
        console.error(e)
        setLiffReady(true)
      }
    }
    initLiff()
  }, [])

  // メニュー取得
  useEffect(() => {
    if (!liffReady) return
    fetch('/api/menus')
      .then(r => r.json())
      .then(j => setMenus(j.menus || []))
      .finally(() => setLoading(false))
  }, [liffReady])

  // 週の日付を計算
  const getWeekDays = useCallback((offset: number): Date[] => {
    const monday = getMonday(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + offset * 7 + i)
      return d
    })
  }, [])

  // 表示中の週の空き状況を取得
  useEffect(() => {
    if (step !== 'date' || !selectedMenu) return
    const days = getWeekDays(weekOffset)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    days.forEach(async (day) => {
      const dateStr = toDateStr(day)
      if (fetchedRef.current.has(dateStr)) return
      fetchedRef.current.add(dateStr)

      if (day < now) {
        setAvailMap(prev => ({ ...prev, [dateStr]: 0 }))
        return
      }

      setAvailMap(prev => ({ ...prev, [dateStr]: null }))
      try {
        const res = await fetch(`/api/availability?date=${dateStr}&duration=${selectedMenu.duration}`)
        const json = await res.json()
        const uniqueCount = new Set((json.slots || []).map((s: Slot) => s.start)).size
        setAvailMap(prev => ({ ...prev, [dateStr]: uniqueCount }))
      } catch {
        setAvailMap(prev => ({ ...prev, [dateStr]: 0 }))
      }
    })
  }, [step, weekOffset, selectedMenu, getWeekDays])

  // 時間枠取得
  const fetchSlots = async (date: Date, duration: number) => {
    setSlotsLoading(true)
    try {
      const res = await fetch(`/api/availability?date=${toDateStr(date)}&duration=${duration}`)
      const json = await res.json()
      setSlots(json.slots || [])
    } catch { }
    finally { setSlotsLoading(false) }
  }

  // 顧客のコース情報を取得
  const fetchCourses = async (custId: string) => {
    try {
      const res = await fetch(`/api/customers/${custId}/tickets`)
      const json = await res.json()
      setCourseTickets(json.tickets || [])
      setCourseSubs(json.subscriptions || [])
      setCustomerId(custId)
    } catch {
      setCourseTickets([])
      setCourseSubs([])
    }
  }

  const handleSelectMenu = async (menu: MenuItem) => {
    setSelectedMenu(menu)
    setSelectedCourse(null)
    setAvailMap({})
    fetchedRef.current.clear()
    setWeekOffset(0)

    if (lineUserId) {
      try {
        const res = await fetch(`/api/liff/check-customer?line_user_id=${lineUserId}`)
        const json = await res.json()
        if (json.exists && json.name) setProfileName(json.name)
        if (json.exists && json.phone) setProfilePhone(json.phone)
        setIsFirstTime(!json.exists)
        if (json.exists && json.customer_id) {
          await fetchCourses(json.customer_id)
        }
        setStep(json.exists ? 'date' : 'profile')
      } catch {
        setStep('profile')
        setIsFirstTime(true)
      }
    } else {
      setStep('profile')
      setIsFirstTime(true)
    }
  }

  const handleSelectCourse = (course: { type: 'ticket' | 'subscription'; id: string; name: string; duration: number }) => {
    setSelectedCourse(course)
    // コース消化用のメニュー情報をセット
    setSelectedMenu({ id: 'course', name: course.name, duration: course.duration || 60, price: 0, category: 'コース消化' })
    setAvailMap({})
    fetchedRef.current.clear()
    setWeekOffset(0)
    setStep('date')
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setStep('time')
    fetchSlots(date, selectedMenu?.duration || 60)
  }

  // 予約確定
  const handleSubmit = async () => {
    if (!selectedMenu || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/liff/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineUserId,
          display_name: displayName,
          customer_name: profileName || displayName,
          customer_phone: profilePhone,
          menu_id: selectedMenu.id,
          menu_name: selectedMenu.name,
          duration: selectedMenu.duration,
          price: selectedCourse ? 0 : selectedMenu.price,
          date: toDateStr(selectedDate),
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          staff_id: selectedSlot.staff_id,
          staff_name: selectedSlot.staff_name,
          bed_id: selectedSlot.bed_id,
          memo,
          is_course: !!selectedCourse,
          ticket_id: selectedCourse?.type === 'ticket' ? selectedCourse.id : undefined,
          subscription_id: selectedCourse?.type === 'subscription' ? selectedCourse.id : undefined,
        })
      })
      if (res.ok) setStep('done')
    } catch { }
    finally { setSubmitting(false) }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = (date: Date) => date < today

  const getAvailIndicator = (dateStr: string, date: Date) => {
    if (isPast(date)) return { icon: '×', color: 'text-gray-300', loading: false }
    const count = availMap[dateStr]
    if (count === null || count === undefined) return { icon: '', color: 'text-gray-300', loading: true }
    if (count >= 3) return { icon: '◎', color: 'text-pink-500', loading: false }
    if (count >= 1) return { icon: '△', color: 'text-yellow-500', loading: false }
    return { icon: '×', color: 'text-gray-300', loading: false }
  }

  const groupedMenus = menus.reduce((acc: Record<string, MenuItem[]>, m) => {
    const cat = m.category || 'その他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

  const weekDays = getWeekDays(weekOffset)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  if (!liffReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-pink-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-purple-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        {step !== 'menu' && step !== 'done' && (
          <button onClick={() => {
            if (step === 'profile') setStep('menu')
            if (step === 'date') setStep(isFirstTime ? 'profile' : 'menu')
            if (step === 'time') setStep('date')
            if (step === 'confirm') setStep('time')
          }} className="p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <div>
          <h1 className="font-bold text-gray-800 text-lg">ご予約</h1>
          {displayName && <p className="text-xs text-gray-400">{displayName}様</p>}
        </div>
      </div>

      {/* ステップインジケーター */}
      {step !== 'done' && (
        <div className="flex gap-1 px-4 pt-4">
          {['menu', 'profile', 'date', 'time', 'confirm'].map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
              ['menu', 'profile', 'date', 'time', 'confirm'].indexOf(step) >= i
                ? 'bg-gradient-to-r from-pink-400 to-purple-400'
                : 'bg-gray-200'
            }`} />
          ))}
        </div>
      )}

      <div className="px-4 py-6 max-w-lg mx-auto">

        {/* STEP 1: メニュー選択 */}
        {step === 'menu' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">メニューを選択</h2>

            {/* 保有コース表示 */}
            {(courseTickets.length > 0 || courseSubs.length > 0) && (
              <div>
                <p className="text-xs font-bold text-emerald-500 mb-2">あなたのコース</p>
                <div className="space-y-2">
                  {courseTickets.map(t => (
                    <button key={t.id} onClick={() => handleSelectCourse({ type: 'ticket', id: t.id, name: t.menu_name || t.plan_name, duration: 60 })}
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left flex items-center justify-between hover:shadow-md transition-all">
                      <div>
                        <p className="font-bold text-gray-800">{t.plan_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">残り{t.remaining_count}/{t.total_sessions}回</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">コース消化</span>
                    </button>
                  ))}
                  {courseSubs.map(s => (
                    <button key={s.id} onClick={() => handleSelectCourse({ type: 'subscription', id: s.id, name: s.menu_name || s.plan_name, duration: 60 })}
                      className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left flex items-center justify-between hover:shadow-md transition-all">
                      <div>
                        <p className="font-bold text-gray-800">{s.plan_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">今月残り{s.sessions_per_month - s.sessions_used}/{s.sessions_per_month}回</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">サブスク消化</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Object.entries(groupedMenus).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-bold text-gray-400 mb-2 uppercase">{cat}</p>
                <div className="space-y-2">
                  {items.map(menu => (
                    <button key={menu.id} onClick={() => handleSelectMenu(menu)}
                      className="w-full bg-white rounded-2xl p-4 text-left shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                      <div>
                        <p className="font-bold text-gray-800">{menu.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{menu.duration}分</p>
                      </div>
                      <p className="font-bold text-pink-500">¥{menu.price.toLocaleString()}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: プロフィール入力（初回のみ） */}
        {step === 'profile' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">お客様情報</h2>
            <p className="text-xs text-gray-400">初回のご予約のため、お名前と電話番号をご入力ください</p>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">お名前 <span className="text-red-400">*</span></p>
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="例：山田 花子"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-pink-300 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">電話番号 <span className="text-red-400">*</span></p>
                <input
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="例：090-1234-5678"
                  type="tel"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-pink-300 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!profileName.trim() || !profilePhone.trim()) {
                  alert('お名前と電話番号を入力してください')
                  return
                }
                setStep('date')
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold text-base shadow-lg">
              次へ →
            </button>
          </div>
        )}

        {/* STEP 3: 日付＋空き状況（ホットペッパー風） */}
        {step === 'date' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">日付を選択</h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              {/* 週ナビゲーション */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <p className="font-bold text-gray-700 text-sm">
                  {weekStart.getMonth() + 1}/{weekStart.getDate()}（{WEEKDAYS[(weekStart.getDay() + 6) % 7]}）〜{weekEnd.getMonth() + 1}/{weekEnd.getDate()}（{WEEKDAYS[(weekEnd.getDay() + 6) % 7]}）
                </p>
                <button
                  onClick={() => setWeekOffset(w => Math.min(3, w + 1))}
                  disabled={weekOffset === 3}
                  className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((d, i) => (
                  <p key={d} className={`text-center text-xs font-bold py-1 ${
                    i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-400'
                  }`}>{d}</p>
                ))}
              </div>

              {/* 日付セル＋空き状況 */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((date, i) => {
                  const dateStr = toDateStr(date)
                  const past = isPast(date)
                  const avail = getAvailIndicator(dateStr, date)
                  const canSelect = !past && !avail.loading && avail.icon !== '×'

                  return (
                    <button
                      key={i}
                      onClick={() => canSelect && handleSelectDate(date)}
                      disabled={!canSelect}
                      className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                        canSelect
                          ? 'hover:bg-pink-50 active:scale-95'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className={`text-sm font-bold ${
                        past ? 'text-gray-300' :
                        i === 5 ? 'text-blue-500' :
                        i === 6 ? 'text-red-500' :
                        'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </span>
                      {avail.loading ? (
                        <Loader2 className="w-3 h-3 text-gray-300 animate-spin mt-1" />
                      ) : (
                        <span className={`text-xs font-bold mt-0.5 ${avail.color}`}>
                          {avail.icon}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 凡例 */}
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
              <span><span className="text-pink-500 font-bold">◎</span> 空きあり</span>
              <span><span className="text-yellow-500 font-bold">△</span> 残りわずか</span>
              <span><span className="text-gray-300 font-bold">×</span> 空きなし</span>
            </div>
          </div>
        )}

        {/* STEP 4: 時間選択 */}
        {step === 'time' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">
              {selectedDate?.getMonth()! + 1}月{selectedDate?.getDate()}日の空き時間
            </h2>
            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <p className="text-gray-400">この日の空き時間はありません</p>
                <button onClick={() => setStep('date')} className="mt-3 text-pink-400 text-sm">別の日を選ぶ</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots
                  .filter((slot, index, self) => index === self.findIndex(s => s.start === slot.start))
                  .map((slot, i) => {
                    const isSelected = selectedSlot?.start === slot.start
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedSlot(slot); setStep('confirm') }}
                        className={`py-3 rounded-2xl text-sm font-bold transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white shadow-md'
                            : 'bg-white text-pink-600 shadow-sm hover:shadow-md'
                        }`}>
                        {slot.start}
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* STEP 5: 確認 */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">予約内容の確認</h2>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              {[
                { label: 'お名前', value: profileName || displayName },
                { label: '電話番号', value: profilePhone || '未入力' },
                { label: 'メニュー', value: selectedMenu?.name },
                { label: '料金', value: selectedCourse ? 'コース消化（¥0）' : `¥${selectedMenu?.price.toLocaleString()}` },
                { label: '施術時間', value: `${selectedMenu?.duration}分` },
                { label: '日付', value: `${selectedDate?.getMonth()! + 1}月${selectedDate?.getDate()}日（${WEEKDAYS[(selectedDate?.getDay()! + 6) % 7]}）` },
                { label: '時間', value: `${selectedSlot?.start} 〜 ${selectedSlot?.end}` },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <p className="text-sm text-gray-400">{item.label}</p>
                  <p className="text-sm font-bold text-gray-700">{item.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2">ご要望・メモ（任意）</p>
              <textarea value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="例：駐車場を使いたい、アレルギーがある など"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-pink-300 text-sm resize-none" />
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-400 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '予約を確定する'}
            </button>
          </div>
        )}

        {/* STEP 6: 完了 */}
        {step === 'done' && (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center mx-auto shadow-lg">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">ご予約ありがとうございます</h2>
            <p className="text-sm text-gray-400">LINEに予約確認メッセージをお送りしました</p>
            <div className="bg-white rounded-2xl p-4 shadow-sm text-left space-y-2 mt-4">
              <p className="text-sm font-bold text-gray-700">{selectedMenu?.name}</p>
              <p className="text-sm text-gray-400">
                {selectedDate?.getMonth()! + 1}月{selectedDate?.getDate()}日 {selectedSlot?.start}〜{selectedSlot?.end}
              </p>
            </div>
            <button onClick={() => window.liff?.closeWindow()}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm mt-4">
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
