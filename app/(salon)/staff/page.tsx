'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Trash2,
  Calendar,
  Target,
  TrendingUp,
  CheckSquare,
  Sparkles,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import {
  fetchStaffList,
  addStaff,
  removeStaff,
  fetchStaffShifts,
  saveStaffShifts,
  fetchStaffMonthlyForStaff,
  saveStaffMonthly,
  type Staff,
  type StaffShift,
  type StaffMonthlyData,
} from '@/lib/staff-management'

const EMPTY_MONTHLY: Omit<StaffMonthlyData, 'staffId' | 'month'> = {
  personalGoal: '',
  monthlyKpi: { sales: 0, visits: 0, avgPrice: 0 },
  importantTasks: ['', '', ''],
  growthGoals: ['', '', ''],
  mustDo: '',
}

export default function StaffManagementPage() {
  const [staffList, setStaffListState] = useState<Staff[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [shifts, setShiftsState] = useState<StaffShift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#C4728A')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [staff, shiftData] = await Promise.all([
        fetchStaffList(),
        fetchStaffShifts(selectedMonth),
      ])
      setStaffListState(staff)
      setShiftsState(shiftData)
      // localStorageからSupabaseへ初回移行
      if (staff.length === 0 && typeof window !== 'undefined') {
        const raw = localStorage.getItem('sola_staff_list')
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const s of parsed) {
                await addStaff(s.name, s.color || '#C4728A')
              }
              const migrated = await fetchStaffList()
              setStaffListState(migrated)
              const shiftRaw = localStorage.getItem('sola_staff_shifts')
              if (shiftRaw) {
                const shiftParsed = JSON.parse(shiftRaw)
                if (Array.isArray(shiftParsed) && shiftParsed.length > 0) {
                  const mapped = shiftParsed
                    .filter((x: { staffName?: string; date?: string; start?: string; end?: string }) => x.staffName && x.date && (x.start ?? x.end))
                    .map((x: { staffName: string; staffColor: string; date: string; start?: string; end?: string }) => {
                      const staffMatch = migrated.find((m: Staff) => m.name === x.staffName)
                      return staffMatch ? { staffId: staffMatch.id, staffName: staffMatch.name, staffColor: staffMatch.color, date: x.date, start: x.start ?? '09:00', end: x.end ?? '18:00' } : null
                    })
                    .filter(Boolean) as StaffShift[]
                  if (mapped.length > 0) {
                    await saveStaffShifts(mapped)
                    const refreshed = await fetchStaffShifts(selectedMonth)
                    setShiftsState(refreshed)
                  }
                }
              }
              localStorage.removeItem('sola_staff_list')
              localStorage.removeItem('sola_staff_shifts')
              localStorage.removeItem('sola_staff_monthly')
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    refresh()
  }, [refresh])

  const monthShifts = shifts.filter(s => s.date.startsWith(selectedMonth))
  const [year, month] = selectedMonth.split('-').map(Number)
  const prevMonth = () => {
    const d = new Date(year, month - 2)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(year, month)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleAddStaff = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const s = await addStaff(newName.trim(), newColor)
      setStaffListState(prev => [...prev, s])
      setNewName('')
      setNewColor('#C4728A')
      setAddStaffOpen(false)
    } catch (e) {
      console.error(e)
      alert('登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveStaff = async (id: string) => {
    if (!confirm('削除しますか？')) return
    setSaving(true)
    try {
      await removeStaff(id)
      setStaffListState(prev => prev.filter(s => s.id !== id))
      if (selectedStaff?.id === id) setSelectedStaff(null)
    } catch (e) {
      console.error(e)
      alert('削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShifts = async (next: StaffShift[]) => {
    const others = shifts.filter(s => !s.date.startsWith(selectedMonth))
    const all = [...others, ...next]
    setSaving(true)
    try {
      await saveStaffShifts(all)
      setShiftsState(all)
    } catch (e) {
      console.error(e)
      alert('シフトの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* スタッフ登録 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans flex items-center gap-2">
            <Users className="w-4 h-4" />
            スタッフ登録
          </span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {staffList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStaff(s)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl cursor-pointer transition-all ${
                    selectedStaff?.id === s.id ? 'ring-2 ring-rose bg-rose/5' : 'bg-light-lav/50 hover:bg-light-lav'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.name[0]}
                  </div>
                  <span className="font-medium text-text-main">{s.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveStaff(s.id) }}
                    disabled={saving}
                    className="p-1.5 text-text-sub hover:text-red-600 rounded-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setAddStaffOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-rose/50 text-rose rounded-xl hover:bg-rose/5"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 1ヶ月のシフト作成 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="gradient-line rounded-full" />
          <span className="section-label font-dm-sans flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            1ヶ月のシフト作成
          </span>
        </div>
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-light-lav">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-text-main">{year}年{month}月</span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-light-lav">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>
          ) : (
            <ShiftCalendar
              staffList={staffList}
              month={selectedMonth}
              shifts={monthShifts}
              onSave={handleSaveShifts}
            />
          )}
        </div>
      </section>

      {/* 個人目標・KPI・タスク・成長目標・絶対にやり切ること */}
      {selectedStaff && (
        <StaffMonthlySection
          staff={selectedStaff}
          month={selectedMonth}
          onClose={() => setSelectedStaff(null)}
        />
      )}

      {addStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-text-main mb-4">スタッフを追加</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-sub mb-1">名前</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="例: 山田"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-sub mb-1">表示色</label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-14 h-10 rounded-lg border cursor-pointer"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setAddStaffOpen(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddStaff}
                disabled={!newName.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose to-lavender text-white font-medium disabled:opacity-50"
              >
                {saving ? '登録中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftCalendar({
  staffList,
  month,
  shifts,
  onSave,
}: {
  staffList: Staff[]
  month: string
  shifts: StaffShift[]
  onSave: (shifts: StaffShift[]) => void
}) {
  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(year, m, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const getShift = (staffId: string, day: number) => {
    const date = `${month}-${String(day).padStart(2, '0')}`
    return shifts.find(s => s.staffId === staffId && s.date === date)
  }

  const setShift = (staffId: string, day: number, start: string, end: string) => {
    const staff = staffList.find(s => s.id === staffId)
    if (!staff) return
    const date = `${month}-${String(day).padStart(2, '0')}`
    const existing = shifts.find(s => s.staffId === staffId && s.date === date)
    const updated: StaffShift = existing
      ? { ...existing, start, end }
      : { id: Date.now().toString(), staffId, staffName: staff.name, staffColor: staff.color, date, start, end }
    const others = shifts.filter(s => !(s.staffId === staffId && s.date === date))
    onSave([...others, updated])
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left p-2 text-text-sub font-medium w-20">スタッフ</th>
            {days.map(d => (
              <th key={d} className="text-center p-1 text-text-sub text-xs w-16">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staffList.map(staff => (
            <tr key={staff.id} className="border-b border-gray-100">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: staff.color }}
                  >
                    {staff.name[0]}
                  </div>
                  <span className="font-medium text-text-main">{staff.name}</span>
                </div>
              </td>
              {days.map(day => {
                const shift = getShift(staff.id, day)
                return (
                  <td key={day} className="p-1">
                    <div className="flex gap-0.5">
                      <input
                        type="time"
                        value={shift?.start ?? ''}
                        onChange={e => setShift(staff.id, day, e.target.value, shift?.end ?? '18:00')}
                        className="w-14 px-1 py-0.5 text-xs rounded border border-gray-200"
                      />
                      <span className="self-center text-text-sub">-</span>
                      <input
                        type="time"
                        value={shift?.end ?? ''}
                        onChange={e => setShift(staff.id, day, shift?.start ?? '09:00', e.target.value)}
                        className="w-14 px-1 py-0.5 text-xs rounded border border-gray-200"
                      />
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StaffMonthlySection({
  staff,
  month,
  onClose,
}: {
  staff: Staff
  month: string
  onClose: () => void
}) {
  const [data, setData] = useState<StaffMonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStaffMonthlyForStaff(staff.id, month)
      .then(d => {
        if (!cancelled) {
          setData(d ?? { ...EMPTY_MONTHLY, staffId: staff.id, month })
        }
      })
      .catch(() => { if (!cancelled) setData({ ...EMPTY_MONTHLY, staffId: staff.id, month }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [staff.id, month])

  const save = async () => {
    if (!data) return
    setSaving(true)
    try {
      await saveStaffMonthly(data)
    } catch (e) {
      console.error(e)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return (
      <section>
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-rose animate-spin" /></div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: staff.color }}
          >
            {staff.name[0]}
          </div>
          <span className="section-label font-dm-sans">{staff.name} の {month} 目標・KPI・タスク</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose to-lavender text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose} className="p-2 text-text-sub hover:text-text-main rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden space-y-6">
        <div className="h-[3px] w-full bg-gradient-to-r from-rose to-lavender -mx-6 -mt-6 mb-6" />

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-main mb-2">
            <Target className="w-4 h-4 text-rose" />
            個人目標
          </label>
          <input
            type="text"
            value={data.personalGoal}
            onChange={e => setData(d => d ? { ...d, personalGoal: e.target.value } : d)}
            placeholder="今月の個人目標を入力"
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-main mb-2">
            <TrendingUp className="w-4 h-4 text-rose" />
            個人の月間KPI
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-sub block mb-1">売上目標（円）</label>
              <input
                type="number"
                value={data.monthlyKpi.sales || ''}
                onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setData(d => d ? { ...d, monthlyKpi: { ...d.monthlyKpi, sales: val === '' ? 0 : Number(val) } } : d) }}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border border-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">来店数目標</label>
              <input
                type="number"
                value={data.monthlyKpi.visits || ''}
                onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setData(d => d ? { ...d, monthlyKpi: { ...d.monthlyKpi, visits: val === '' ? 0 : Number(val) } } : d) }}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border border-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-text-sub block mb-1">客単価目標（円）</label>
              <input
                type="number"
                value={data.monthlyKpi.avgPrice || ''}
                onChange={e => { const val = e.target.value.replace(/^0+(?=\d)/, ''); setData(d => d ? { ...d, monthlyKpi: { ...d.monthlyKpi, avgPrice: val === '' ? 0 : Number(val) } } : d) }}
                onFocus={e => e.target.select()}
                className="w-full px-3 py-2 rounded-lg border border-gray-200"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-main mb-2">
            <CheckSquare className="w-4 h-4 text-rose" />
            重要タスク（3つ）
          </label>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <input
                key={i}
                type="text"
                value={data.importantTasks[i] ?? ''}
                onChange={e => {
                  const next = [...data.importantTasks]
                  next[i] = e.target.value
                  setData(d => d ? { ...d, importantTasks: next as [string, string, string] } : d)
                }}
                placeholder={`重要タスク ${i + 1}`}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-main mb-2">
            <Sparkles className="w-4 h-4 text-rose" />
            成長目標（3つ）
          </label>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <input
                key={i}
                type="text"
                value={data.growthGoals[i] ?? ''}
                onChange={e => {
                  const next = [...data.growthGoals]
                  next[i] = e.target.value
                  setData(d => d ? { ...d, growthGoals: next as [string, string, string] } : d)
                }}
                placeholder={`成長目標 ${i + 1}`}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-text-main mb-2">
            <Zap className="w-4 h-4 text-rose" />
            絶対にやり切ること（1つ）
          </label>
          <input
            type="text"
            value={data.mustDo}
            onChange={e => setData(d => d ? { ...d, mustDo: e.target.value } : d)}
            placeholder="今月絶対にやり切ること"
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-rose outline-none"
          />
        </div>
      </div>
    </section>
  )
}
