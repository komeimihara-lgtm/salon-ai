/**
 * スタッフ管理
 * - スタッフ登録
 * - 1ヶ月のシフト
 * - 個人目標・月間KPI・重要タスク・成長目標・絶対にやり切ること
 */

const STAFF_KEY = 'sola_staff_list'
const SHIFTS_KEY = 'sola_staff_shifts'
const MONTHLY_KEY = 'sola_staff_monthly'

export interface Staff {
  id: string
  name: string
  color: string
}

export interface StaffShift {
  id: string
  staffId: string
  staffName: string
  staffColor: string
  date: string
  start: string
  end: string
}

export interface StaffMonthlyData {
  staffId: string
  month: string // YYYY-MM
  personalGoal: string
  monthlyKpi: { sales: number; visits: number; avgPrice: number }
  importantTasks: [string, string, string]
  growthGoals: [string, string, string]
  mustDo: string
}

const DEFAULT_STAFF: Staff[] = [
  { id: '1', name: '田中', color: '#C4728A' },
  { id: '2', name: '鈴木', color: '#9B8EC4' },
]

export function getStaffList(): Staff[] {
  if (typeof window === 'undefined') return DEFAULT_STAFF
  try {
    const raw = localStorage.getItem(STAFF_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STAFF
    }
  } catch (_) {}
  return DEFAULT_STAFF
}

export function setStaffList(staff: Staff[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff))
  window.dispatchEvent(new Event('staff-list-updated'))
}

export function getStaffShifts(): StaffShift[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHIFTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (_) {}
  return []
}

export function setStaffShifts(shifts: StaffShift[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts))
  window.dispatchEvent(new Event('staff-shifts-updated'))
}

export function getStaffMonthlyData(): StaffMonthlyData[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MONTHLY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (_) {}
  return []
}

export function setStaffMonthlyData(data: StaffMonthlyData[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(MONTHLY_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event('staff-monthly-updated'))
}

export function getMonthlyForStaff(staffId: string, month: string): StaffMonthlyData | null {
  return getStaffMonthlyData().find(d => d.staffId === staffId && d.month === month) ?? null
}

export function saveStaffMonthly(data: StaffMonthlyData) {
  const all = getStaffMonthlyData()
  const idx = all.findIndex(d => d.staffId === data.staffId && d.month === data.month)
  const next = idx >= 0 ? [...all.slice(0, idx), data, ...all.slice(idx + 1)] : [...all, data]
  setStaffMonthlyData(next)
}

export function getShiftsForMonth(month: string): StaffShift[] {
  return getStaffShifts().filter(s => s.date.startsWith(month))
}

export function getTodayShiftsFromNew(): StaffShift[] {
  const today = new Date().toISOString().slice(0, 10)
  return getStaffShifts().filter(s => s.date === today)
}
