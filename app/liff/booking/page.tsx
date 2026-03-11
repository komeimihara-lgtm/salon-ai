'use client'

import { useState, useEffect } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'

declare global {
  interface Window { liff: any }
}

interface MenuItem { id: string; name: string; duration: number; price: number; category: string }
interface Slot { staff_id: string; staff_name: string; staff_color: string; start: string; end: string; bed_id?: string }

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function LiffBookingPage() {
  const [liffReady, setLiffReady] = useState(false)
  const [lineUserId, setLineUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [step, setStep] = useState<'menu' | 'profile' | 'date' | 'time' | 'confirm' | 'done'>('menu')

  // 初回用プロフィール（既存顧客の場合はAPIから取得した値を使用）
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [existingName, setExistingName] = useState('')
  const [existingPhone, setExistingPhone] = useState('')

  // 選択状態
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [memo, setMemo] = useState('')

  // データ
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [holidays, setHolidays] = useState<string[]>([])

  // UI状態
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [calendarBase, setCalendarBase] = useState(new Date())

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
          // LINEブラウザ外でも動作確認できるようにフォールバック
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

  // 休業日取得
  useEffect(() => {
    const month = `${calendarBase.getFullYear()}-${String(calendarBase.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/holidays?month=${month}`)
      .then(r => r.json())
      .then(j => setHolidays((j.holidays || []).map((h: { date: string }) => h.date)))
  }, [calendarBase])

  // 空き枠取得
  const fetchSlots = async (date: Date, duration: number) => {
    setSlotsLoading(true)
    try {
      const res = await fetch(`/api/availability?date=${toDateStr(date)}&duration=${duration}`)
      const json = await res.json()
      setSlots(json.slots || [])
    } catch { }
    finally { setSlotsLoading(false) }
  }

  const checkFirstTime = async (lineUserId: string) => {
    const res = await fetch(`/api/liff/check-customer?line_user_id=${lineUserId}`)
    const json = await res.json()
    if (json.exists) {
      setExistingName(json.name || '')
      setExistingPhone(json.phone || '')
    }
    return !json.exists
  }

  const handleSelectMenu = async (menu: MenuItem) => {
    setSelectedMenu(menu)
    if (lineUserId) {
      const first = await checkFirstTime(lineUserId)
      setIsFirstTime(first)
      setStep(first ? 'profile' : 'date')
    } else {
      setIsFirstTime(true)
      setStep('profile')
    }
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
          customer_name: profileName || existingName || displayName,
          customer_phone: profilePhone || existingPhone,
          menu_id: selectedMenu.id,
          menu_name: selectedMenu.name,
          duration: selectedMenu.duration,
          price: selectedMenu.price,
          date: toDateStr(selectedDate),
          start_time: selectedSlot.start,
          end_time: selectedSlot.end,
          staff_id: selectedSlot.staff_id,
          staff_name: selectedSlot.staff_name,
          bed_id: selectedSlot.bed_id,
          memo,
        })
      })
      if (res.ok) setStep('done')
    } catch { }
    finally { setSubmitting(false) }
  }

  // カレンダー生成
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDay = (y: number, m: number) => {
    const d = new Date(y, m, 1).getDay()
    return d === 0 ? 6 : d - 1
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isHoliday = (date: Date) => holidays.includes(toDateStr(date))
  const isPast = (date: Date) => date < today

  const groupedMenus = menus.reduce((acc: Record<string, MenuItem[]>, m) => {
    const cat = m.category || 'その他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

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
            <h2 className="font-bold text-gray-700">お客様情報の入力</h2>
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

        {/* STEP 3: 日付選択 */}
        {step === 'date' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">日付を選択</h2>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalendarBase(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="p-2 rounded-xl hover:bg-gray-100">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <p className="font-bold text-gray-700">
                  {calendarBase.getFullYear()}年{calendarBase.getMonth() + 1}月
                </p>
                <button onClick={() => setCalendarBase(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="p-2 rounded-xl hover:bg-gray-100">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((d, i) => (
                  <p key={d} className={`text-center text-xs font-bold py-1 ${i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-400'}`}>{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: getFirstDay(calendarBase.getFullYear(), calendarBase.getMonth()) }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: getDaysInMonth(calendarBase.getFullYear(), calendarBase.getMonth()) }).map((_, i) => {
                  const date = new Date(calendarBase.getFullYear(), calendarBase.getMonth(), i + 1)
                  const disabled = isPast(date) || isHoliday(date)
                  const isSelected = selectedDate && toDateStr(date) === toDateStr(selectedDate)
                  return (
                    <button key={i} onClick={() => !disabled && handleSelectDate(date)}
                      disabled={disabled}
                      className={`aspect-square rounded-xl text-sm font-bold transition-all ${
                        isSelected ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white' :
                        disabled ? 'text-gray-200 cursor-not-allowed' :
                        'hover:bg-pink-50 text-gray-700'
                      }`}>
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: 時間選択（時間のみ表示、スタッフ別なし） */}
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
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${
                          isSelected ? 'bg-gradient-to-br from-pink-400 to-purple-400 text-white' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                        }`}>
                        {slot.start}
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: 確認 */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-700">予約内容の確認</h2>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
              {[
                { label: 'メニュー', value: selectedMenu?.name },
                { label: '料金', value: `¥${selectedMenu?.price.toLocaleString()}` },
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

        {/* STEP 5: 完了 */}
        {step === 'done' && (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center mx-auto shadow-lg">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">予約が完了しました✨</h2>
            <p className="text-sm text-gray-400">LINEに予約確認メッセージを送りました</p>
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
