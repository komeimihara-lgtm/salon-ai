'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Copy, Users, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const WEEKDAY_COLORS = ['text-text-main', 'text-text-main', 'text-text-main', 'text-text-main', 'text-text-main', 'text-blue-500', 'text-red-500']

interface Staff { id: string; name: string; color: string }
interface Shift { id?: string; staff_id: string; date: string; start_time: string; end_time: string; staff?: Staff }

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

function timeToSlot(time: string) {
  const [h, m] = (time || '00:00').slice(0, 5).split(':').map(Number)
  return (h || 0) * 2 + ((m || 0) >= 30 ? 1 : 0)
}

function slotToTime(slot: number) {
  const h = Math.floor(slot / 2)
  const m = slot % 2 === 1 ? '30' : '00'
  return `${String(h).padStart(2, '0')}:${m}`
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseDate, setBaseDate] = useState(new Date())
  const weekDates = getWeekDates(baseDate)
  const [toast, setToast] = useState('')

  // ドラッグ状態
  const dragRef = useRef<{ staffId: string; dateStr: string; startSlot: number; currentSlot: number } | null>(null)
  const [dragState, setDragState] = useState<{ staffId: string; dateStr: string; startSlot: number; currentSlot: number } | null>(null)

  // 定休日設定
  const [closedDays, setClosedDays] = useState<number[]>([])
  const [showClosedDayModal, setShowClosedDayModal] = useState(false)

  // スタッフ追加
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffColor, setNewStaffColor] = useState('#C4728A')

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

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const getShift = (staffId: string, dateStr: string) =>
    shifts.find(s => s.staff_id === staffId && s.date === dateStr)

  const getDragShift = (staffId: string, dateStr: string) => {
    if (!dragState || dragState.staffId !== staffId || dragState.dateStr !== dateStr) return null
    const start = Math.min(dragState.startSlot, dragState.currentSlot)
    const end = Math.max(dragState.startSlot, dragState.currentSlot) + 1
    return { start: slotToTime(start), end: slotToTime(end) }
  }

  const isClosedDay = (date: Date) => {
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
    return closedDays.includes(dayIndex)
  }

  const handleMouseDown = (staffId: string, dateStr: string, slot: number, e: React.MouseEvent) => {
    e.preventDefault()
    if (isClosedDay(new Date(dateStr + 'T00:00:00'))) return
    dragRef.current = { staffId, dateStr, startSlot: slot, currentSlot: slot }
    setDragState({ staffId, dateStr, startSlot: slot, currentSlot: slot })
  }

  const handleMouseEnter = (staffId: string, dateStr: string, slot: number) => {
    if (!dragRef.current || dragRef.current.staffId !== staffId || dragRef.current.dateStr !== dateStr) return
    dragRef.current.currentSlot = slot
    setDragState({ ...dragRef.current, currentSlot: slot })
  }

  const handleMouseUp = async () => {
    if (!dragRef.current) return
    const { staffId, dateStr, startSlot, currentSlot } = dragRef.current
    const start = Math.min(startSlot, currentSlot)
    const end = Math.max(startSlot, currentSlot) + 1
    dragRef.current = null
    setDragState(null)

    setSaving(true)
    try {
      await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          date: dateStr,
          start_time: slotToTime(start),
          end_time: slotToTime(end),
        })
      })
      await fetchShifts()
      showToast('シフトを保存しました')
    } catch {
      showToast('保存に失敗しました')
    } finally { setSaving(false) }
  }

  const handleDeleteShift = async (staffId: string, dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleCopyPrevWeek = async () => {
    setSaving(true)
    try {
      const prevWeekDates = getWeekDates(new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000))
      const prevShifts = shifts.filter(s => prevWeekDates.some(d => toDateStr(d) === s.date))

      for (const shift of prevShifts) {
        const prevDate = new Date(shift.date + 'T00:00:00')
        const newDate = new Date(prevDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        const newDateStr = toDateStr(newDate)
        if (isClosedDay(newDate)) continue
        await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: shift.staff_id,
            date: newDateStr,
            start_time: shift.start_time,
            end_time: shift.end_time,
          })
        })
      }
      await fetchShifts()
      showToast('前週のシフトをコピーしました✨')
    } catch {
      showToast('コピーに失敗しました')
    } finally { setSaving(false) }
  }

  const handleBulkRegister = async (startTime: string, endTime: string) => {
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
              start_time: startTime,
              end_time: endTime,
            })
          })
        }
      }
      await fetchShifts()
      showToast('一括登録しました✨')
    } catch { }
    finally { setSaving(false) }
  }

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

  const DISPLAY_HOURS = Array.from({ length: 29 }, (_, i) => i + 16)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkStart, setBulkStart] = useState('09:00')
  const [bulkEnd, setBulkEnd] = useState('18:00')

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="gradient-line rounded-full" />
          <span className="font-dm-sans text-base font-bold text-text-main">シフト管理</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowClosedDayModal(true)}
            className="px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">
            定休日設定
          </button>
          <button onClick={handleCopyPrevWeek} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">
            <Copy className="w-3.5 h-3.5" />前週コピー
          </button>
          <button onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-lav text-text-sub text-xs font-bold">
            <Users className="w-3.5 h-3.5" />一括登録
          </button>
          <button onClick={() => setShowAddStaff(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" />スタッフ追加
          </button>
        </div>
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 card-shadow">
        <button onClick={() => setBaseDate(d => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
          className="p-2 rounded-xl hover:bg-light-lav transition-all">
          <ChevronLeft className="w-4 h-4 text-text-sub" />
        </button>
        <p className="font-bold text-text-main text-sm">
          {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </p>
        <button onClick={() => setBaseDate(d => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
          className="p-2 rounded-xl hover:bg-light-lav transition-all">
          <ChevronRight className="w-4 h-4 text-text-sub" />
        </button>
      </div>

      {/* シフトグリッド */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-rose animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr>
                <th className="w-16 p-3 text-xs text-text-sub font-medium border-b border-gray-100">スタッフ</th>
                {weekDates.map((date, i) => {
                  const closed = isClosedDay(date)
                  const isToday = toDateStr(date) === toDateStr(new Date())
                  return (
                    <th key={i} className={`p-3 text-xs font-bold border-b border-gray-100 text-center ${closed ? 'bg-gray-50' : isToday ? 'bg-rose/5' : ''}`}>
                      <p className={WEEKDAY_COLORS[i]}>{WEEKDAYS[i]}</p>
                      <p className={`text-sm ${isToday ? 'text-rose' : 'text-text-main'}`}>
                        {date.getMonth() + 1}/{date.getDate()}
                      </p>
                      {closed && <p className="text-xs text-gray-400">定休</p>}
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
                  </td>
                  {weekDates.map((date, di) => {
                    const dateStr = toDateStr(date)
                    const closed = isClosedDay(date)
                    const shift = getShift(staff.id, dateStr)
                    const drag = getDragShift(staff.id, dateStr)
                    const displayShift = drag || (shift ? { start: shift.start_time, end: shift.end_time } : null)

                    return (
                      <td key={di} className={`p-1.5 relative ${closed ? 'bg-gray-50' : ''}`}>
                        {closed ? (
                          <div className="h-16 flex items-center justify-center text-xs text-gray-300">休</div>
                        ) : (
                          <div className="relative h-16 rounded-xl border-2 border-dashed border-gray-100 overflow-hidden select-none cursor-crosshair"
                            style={{ userSelect: 'none' }}>
                            {DISPLAY_HOURS.map(slot => (
                              <div key={slot}
                                className="absolute w-full"
                                style={{ top: `${((slot - 16) / 28) * 100}%`, height: `${(1 / 28) * 100}%` }}
                                onMouseDown={(e) => handleMouseDown(staff.id, dateStr, slot, e)}
                                onMouseEnter={() => handleMouseEnter(staff.id, dateStr, slot)}
                              />
                            ))}
                            {displayShift && (() => {
                              const startSlot = timeToSlot(displayShift.start)
                              const endSlot = timeToSlot(displayShift.end)
                              const top = ((Math.max(startSlot, 16) - 16) / 28) * 100
                              const height = ((Math.min(endSlot, 44) - Math.max(startSlot, 16)) / 28) * 100
                              return (
                                <div className="absolute left-0.5 right-0.5 rounded-lg flex items-center justify-between px-1.5 group z-10"
                                  style={{
                                    top: `${top}%`,
                                    height: `${Math.max(height, 4)}%`,
                                    backgroundColor: staff.color + 'dd',
                                  }}>
                                  <span className="text-white text-xs font-bold leading-none truncate">
                                    {displayShift.start}〜{displayShift.end}
                                  </span>
                                  {shift && !drag && (
                                    <button onClick={(e) => handleDeleteShift(staff.id, dateStr, e)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/20 rounded">
                                      <Trash2 className="w-3 h-3 text-white" />
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 px-4 py-2 border-t border-gray-100">
            <p className="text-xs text-text-sub">8:00〜22:00の範囲でドラッグしてシフトを登録</p>
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
                  className={`w-12 h-12 rounded-xl text-sm font-bold transition-all ${closedDays.includes(i)
                    ? 'bg-gradient-to-br from-rose to-lavender text-white'
                    : 'bg-light-lav text-text-sub'}`}>
                  {day}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowClosedDayModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">閉じる</button>
              <button onClick={() => { setShowClosedDayModal(false); showToast('定休日を設定しました') }}
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
            <p className="text-xs text-text-sub mb-4">今週の全スタッフに同じ時間を登録します（定休日除く）</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-sub mb-1">開始時間</p>
                <select value={bulkStart} onChange={e => setBulkStart(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {Array.from({ length: 28 }, (_, i) => slotToTime(i + 12)).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-text-sub mb-1">終了時間</p>
                <select value={bulkEnd} onChange={e => setBulkEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-rose text-sm">
                  {Array.from({ length: 28 }, (_, i) => slotToTime(i + 14)).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-sub text-sm font-bold">キャンセル</button>
              <button onClick={() => { handleBulkRegister(bulkStart, bulkEnd); setShowBulkModal(false) }} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-bold">
                一括登録
              </button>
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
