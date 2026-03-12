'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Copy, Users, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const WEEKDAY_COLORS = ['text-text-main', 'text-text-main', 'text-text-main', 'text-text-main', 'text-text-main', 'text-blue-500', 'text-red-500']
const START_HOUR = 9
const END_HOUR = 21
const SLOT_MINUTES = 15
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * (60 / SLOT_MINUTES)

interface Staff { id: string; name: string; color: string }
interface Shift { id?: string; staff_id: string; date: string; start_time: string; end_time: string }
interface Reservation { id: string; staff_name: string; reservation_date: string; start_time: string; duration_minutes: number }

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeToSlot(time: string, startHour: number) {
  const [h, m] = time.split(':').map(Number)
  return (h - startHour) * (60 / SLOT_MINUTES) + Math.floor(m / SLOT_MINUTES)
}

function slotToTime(slot: number, startHour: number) {
  const totalMinutes = startHour * 60 + slot * SLOT_MINUTES
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseDate, setBaseDate] = useState(new Date())
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState<'availability' | 'shift'>('availability')
  const [closedDays, setClosedDays] = useState<number[]>([])
  const [showClosedDayModal, setShowClosedDayModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkStart, setBulkStart] = useState('09:00')
  const [bulkEnd, setBulkEnd] = useState('18:00')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffColor, setNewStaffColor] = useState('#C4728A')
  const [editingShift, setEditingShift] = useState<{ staffId: string; dateStr: string } | null>(null)
  const [editStart, setEditStart] = useState('09:00')
  const [editEnd, setEditEnd] = useState('18:00')

  const weekDates = getWeekDates(baseDate)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff')
    const json = await res.json()
    setStaffList(json.staff || [])
  }, [])

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const month = `${weekDates[0].getFullYear()}-${String(weekDates[0].getMonth() + 1).padStart(2, '0')}`
      const res = await fetch(`/api/shifts?month=${month}`)
      const json = await res.json()
      setShifts(json.shifts || [])
    } catch { }
    finally { setLoading(false) }
  }, [weekDates[0].toISOString().slice(0, 7)])

  const fetchReservations = useCallback(async () => {
    try {
      const startDate = toDateStr(weekDates[0])
      const endDate = toDateStr(weekDates[6])
      const res = await fetch(`/api/reservations?start=${startDate}&end=${endDate}`)
      const json = await res.json()
      setReservations(json.reservations || [])
    } catch { }
  }, [toDateStr(weekDates[0]), toDateStr(weekDates[6])])

  // 定休日をSupabaseから取得
  useEffect(() => {
    fetch('/api/settings/salon')
      .then(r => r.json())
      .then(j => setClosedDays(Array.isArray(j.closed_days) ? j.closed_days : []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { fetchShifts(); fetchReservations() }, [fetchShifts, fetchReservations])

  const getShift = (staffId: string, dateStr: string) =>
    shifts.find(s => s.staff_id === staffId && s.date === dateStr)

  const isClosedDay = (date: Date) => {
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
    return closedDays.includes(dayIndex)
  }

  // 空き状況チェック
  const isAvailable = (staffId: string, dateStr: string, slotIndex: number) => {
    const staff = staffList.find(s => s.id === staffId)
    if (!staff) return false
    const shift = getShift(staffId, dateStr)
    if (!shift) return false

    const slotMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES
    const shiftStart = parseInt(shift.start_time.split(':')[0]) * 60 + parseInt(shift.start_time.split(':')[1])
    const shiftEnd = parseInt(shift.end_time.split(':')[0]) * 60 + parseInt(shift.end_time.split(':')[1])

    if (slotMinutes < shiftStart || slotMinutes >= shiftEnd) return false

    // 予約との重複チェック
    const staffReservations = reservations.filter(r =>
      r.staff_name === staff.name && r.reservation_date === dateStr
    )
    const isBooked = staffReservations.some(r => {
      const resStart = parseInt(r.start_time.split(':')[0]) * 60 + parseInt(r.start_time.split(':')[1])
      const resEnd = resStart + (r.duration_minutes || 60)
      return slotMinutes >= resStart && slotMinutes < resEnd
    })

    return !isBooked
  }

  // シフト保存
  const handleSaveShift = async () => {
    if (!editingShift) return
    setSaving(true)
    try {
      await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: editingShift.staffId,
          date: editingShift.dateStr,
          start_time: editStart,
          end_time: editEnd,
        })
      })
      await fetchShifts()
      setEditingShift(null)
      showToast('シフトを保存しました✨')
    } catch { showToast('保存に失敗しました') }
    finally { setSaving(false) }
  }

  // シフト削除
  const handleDeleteShift = async (staffId: string, dateStr: string) => {
    setSaving(true)
    try {
      await fetch('/api/shifts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, date: dateStr })
      })
      await fetchShifts()
      showToast('シフトを削除しました')
    } catch { }
    finally { setSaving(false) }
  }

  // 前週コピー
  const handleCopyPrevWeek = async () => {
    setSaving(true)
    try {
      const prevWeekDates = getWeekDates(new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000))
      const prevShifts = shifts.filter(s => prevWeekDates.some(d => toDateStr(d) === s.date))
      for (const shift of prevShifts) {
        const prevDate = new Date(shift.date + 'T00:00:00')
        const newDate = new Date(prevDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        if (isClosedDay(newDate)) continue
        await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: shift.staff_id,
            date: toDateStr(newDate),
            start_time: shift.start_time,
            end_time: shift.end_time,
          })
        })
      }
      await fetchShifts()
      showToast('前週のシフトをコピーしました✨')
    } catch { showToast('コピーに失敗しました') }
    finally { setSaving(false) }
  }

  // 一括登録
  const handleBulkRegister = async () => {
    setSaving(true)
    try {
      for (const staff of staffList) {
        for (const date of weekDates) {
          if (isClosedDay(date)) continue
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              staff_id: staff.id,
              date: toDateStr(date),
              start_time: bulkStart,
              end_time: bulkEnd,
            })
          })
        }
      }
      await fetchShifts()
      showToast('一括登録しました✨')
    } catch { }
    finally { setSaving(false) }
  }

  // スタッフ追加
  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return
    await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newStaffName, color: newStaffColor })
    })
    setNewStaffName('')
    setShowAddStaff(false)
    await fetchStaff()
    showToast('スタッフを追加しました')
  }

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`「${staffName}」を削除しますか？この操作は取り消せません。`)) return
    try {
      const res = await fetch(`/api/staff/${staffId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setStaffList(prev => prev.filter(s => s.id !== staffId))
      showToast(`${staffName}を削除しました`)
    } catch { showToast('削除に失敗しました') }
  }

  const timeOptions = Array.from({ length: TOTAL_SLOTS + 2 }, (_, i) => slotToTime(i, START_HOUR))
  const today = new Date()

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="font-dm-sans text-base font-bold text-text-main">スタッフ管理</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowClosedDayModal(true)}
            className="px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">定休日設定</button>
          <button onClick={handleCopyPrevWeek} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">
            <Copy className="w-3.5 h-3.5" />前週コピー</button>
          <button onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">
            <Users className="w-3.5 h-3.5" />一括登録</button>
          <button onClick={() => setShowAddStaff(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" />スタッフ追加</button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-2">
        {[
          { key: 'availability', label: 'サロンの空き状況' },
          { key: 'shift', label: 'シフト登録' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key ? 'bg-gradient-to-r from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 card-shadow">
        <button onClick={() => setBaseDate(d => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
          className="p-2 rounded-xl hover:bg-light-lav transition-all">
          <ChevronLeft className="w-4 h-4 text-text-sub" />
        </button>
        <p className="font-bold text-text-main text-sm">
          {weekDates[0].getFullYear()}年{weekDates[0].getMonth() + 1}月 &nbsp;
          {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} 〜 {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
        </p>
        <button onClick={() => setBaseDate(d => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
          className="p-2 rounded-xl hover:bg-light-lav transition-all">
          <ChevronRight className="w-4 h-4 text-text-sub" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : (
        <>
          {/* 空き状況タブ */}
          {activeTab === 'availability' && (
            <div className="bg-white rounded-2xl card-shadow overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-16 p-2 text-xs text-text-sub font-medium sticky left-0 bg-white z-10">時間</th>
                    {weekDates.map((date, i) => {
                      const isToday = toDateStr(date) === toDateStr(today)
                      const closed = isClosedDay(date)
                      return (
                        <th key={i} className={`p-2 text-center min-w-[80px] ${isToday ? 'bg-rose/5' : closed ? 'bg-gray-50' : ''}`}>
                          <p className={`text-xs font-bold ${WEEKDAY_COLORS[i]}`}>{WEEKDAYS[i]}</p>
                          <p className={`text-sm font-bold ${isToday ? 'text-rose' : 'text-text-main'}`}>
                            {date.getMonth() + 1}/{date.getDate()}
                          </p>
                          {closed && <p className="text-xs text-gray-300">休</p>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
                    const time = slotToTime(slotIdx, START_HOUR)
                    const isHour = slotIdx % 2 === 0
                    return (
                      <tr key={slotIdx} className={`border-b ${isHour ? 'border-gray-100' : 'border-gray-50'}`}>
                        <td className={`p-1 text-center sticky left-0 bg-white z-10 ${isHour ? 'font-bold text-text-main' : 'text-text-sub'}`}>
                          <span className="text-xs">{isHour ? time : ''}</span>
                        </td>
                        {weekDates.map((date, di) => {
                          const dateStr = toDateStr(date)
                          const closed = isClosedDay(date)
                          if (closed) {
                            return <td key={di} className="bg-gray-50 text-center p-1"><span className="text-xs text-gray-200">-</span></td>
                          }
                          // いずれかのスタッフが空いているか
                          const anyAvailable = staffList.some(s => isAvailable(s.id, dateStr, slotIdx))
                          const allAvailable = staffList.length > 0 && staffList.every(s => isAvailable(s.id, dateStr, slotIdx))
                          return (
                            <td key={di} className={`text-center p-1 ${toDateStr(date) === toDateStr(today) ? 'bg-rose/5' : ''}`}>
                              {anyAvailable ? (
                                <span className={`text-lg font-bold ${allAvailable ? 'text-rose' : 'text-rose/60'}`}>◎</span>
                              ) : (
                                <span className="text-sm text-gray-300">×</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex gap-4 px-4 py-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5"><span className="text-rose font-bold">◎</span><span className="text-xs text-text-sub">空きあり</span></div>
                <div className="flex items-center gap-1.5"><span className="text-rose/60 font-bold">◎</span><span className="text-xs text-text-sub">一部空きあり</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-300">×</span><span className="text-xs text-text-sub">満員・シフトなし</span></div>
              </div>
            </div>
          )}

          {/* シフト登録タブ */}
          {activeTab === 'shift' && (
            <div className="bg-white rounded-2xl card-shadow overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-20 p-3 text-xs text-text-sub font-medium">スタッフ</th>
                    {weekDates.map((date, i) => {
                      const isToday = toDateStr(date) === toDateStr(today)
                      const closed = isClosedDay(date)
                      return (
                        <th key={i} className={`p-2 text-center ${isToday ? 'bg-rose/5' : closed ? 'bg-gray-50' : ''}`}>
                          <p className={`text-xs font-bold ${WEEKDAY_COLORS[i]}`}>{WEEKDAYS[i]}</p>
                          <p className={`text-sm font-bold ${isToday ? 'text-rose' : 'text-text-main'}`}>
                            {date.getMonth() + 1}/{date.getDate()}
                          </p>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(staff => (
                    <tr key={staff.id} className="border-b border-gray-50">
                      <td className="p-2 text-center">
                        <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: staff.color }}>
                          {staff.name.slice(0, 1)}
                        </div>
                        <p className="text-xs text-text-sub mt-1">{staff.name}</p>
                        <button onClick={() => handleDeleteStaff(staff.id, staff.name)}
                          className="mt-1 p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      {weekDates.map((date, di) => {
                        const dateStr = toDateStr(date)
                        const closed = isClosedDay(date)
                        const shift = getShift(staff.id, dateStr)
                        return (
                          <td key={di} className={`p-1.5 text-center ${closed ? 'bg-gray-50' : ''}`}>
                            {closed ? (
                              <span className="text-xs text-gray-300">休</span>
                            ) : shift ? (
                              <button onClick={() => {
                                setEditingShift({ staffId: staff.id, dateStr })
                                setEditStart(shift.start_time.slice(0, 5))
                                setEditEnd(shift.end_time.slice(0, 5))
                              }}
                                className="w-full py-1.5 px-1 rounded-xl text-white text-xs font-bold leading-tight"
                                style={{ backgroundColor: staff.color }}>
                                {shift.start_time.slice(0, 5)}<br />〜{shift.end_time.slice(0, 5)}
                              </button>
                            ) : (
                              <button onClick={() => {
                                setEditingShift({ staffId: staff.id, dateStr })
                                setEditStart('09:00')
                                setEditEnd('18:00')
                              }}
                                className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 text-xs hover:border-rose/30 hover:text-rose/30 transition-all">
                                ＋
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* シフト編集モーダル */}
      {editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main mb-4">シフト設定</h3>
            <p className="text-xs text-text-sub mb-4">
              {staffList.find(s => s.id === editingShift.staffId)?.name} / {editingShift.dateStr}
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-sub mb-1">開始時間</p>
                <select value={editStart} onChange={e => setEditStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-text-sub mb-1">終了時間</p>
                <select value={editEnd} onChange={e => setEditEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditingShift(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">キャンセル</button>
              {getShift(editingShift.staffId, editingShift.dateStr) && (
                <button onClick={() => { handleDeleteShift(editingShift.staffId, editingShift.dateStr); setEditingShift(null) }}
                  className="px-4 py-2.5 rounded-xl bg-red-100 text-red-500 text-sm font-bold">削除</button>
              )}
              <button onClick={handleSaveShift} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定休日設定モーダル */}
      {showClosedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main mb-4">定休日設定</h3>
            <div className="flex gap-2 flex-wrap mb-6">
              {WEEKDAYS.map((day, i) => (
                <button key={i} onClick={() => setClosedDays(prev =>
                  prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                )}
                  className={`w-12 h-12 rounded-xl text-sm font-bold transition-all ${closedDays.includes(i) ? 'bg-gradient-to-br from-rose to-lavender text-white' : 'bg-light-lav text-text-sub'}`}>
                  {day}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowClosedDayModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">閉じる</button>
              <button onClick={async () => {
                  try {
                    await fetch('/api/settings/salon', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ closed_days: closedDays }),
                    })
                    setShowClosedDayModal(false)
                    showToast('定休日を設定しました')
                  } catch { showToast('保存に失敗しました') }
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 一括登録モーダル */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main mb-1">一括登録</h3>
            <p className="text-xs text-text-sub mb-4">今週の全スタッフに同じ時間を登録します</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-sub mb-1">開始時間</p>
                <select value={bulkStart} onChange={e => setBulkStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-text-sub mb-1">終了時間</p>
                <select value={bulkEnd} onChange={e => setBulkEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">キャンセル</button>
              <button onClick={() => { handleBulkRegister(); setShowBulkModal(false) }} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">一括登録</button>
            </div>
          </div>
        </div>
      )}

      {/* スタッフ追加モーダル */}
      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm card-shadow">
            <h3 className="font-bold text-text-main mb-4">スタッフ追加</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-sub mb-1">名前</p>
                <input value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                  placeholder="例：田中"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm" />
              </div>
              <div>
                <p className="text-xs text-text-sub mb-1">カラー</p>
                <div className="flex gap-2 flex-wrap">
                  {['#C4728A', '#9B8EC4', '#7BA7BC', '#88B584', '#E09B6B', '#B5836E'].map(c => (
                    <button key={c} onClick={() => setNewStaffColor(c)}
                      className={`w-10 h-10 rounded-full transition-all ${newStaffColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddStaff(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">キャンセル</button>
              <button onClick={handleAddStaff}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">追加</button>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-text-main text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
