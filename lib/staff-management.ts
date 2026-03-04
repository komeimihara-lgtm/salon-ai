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
  month: string
  personalGoal: string
  monthlyKpi: { sales: number; visits: number; avgPrice: number }
  importantTasks: [string, string, string]
  growthGoals: [string, string, string]
  mustDo: string
}

export function getStaffList(): Staff[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STAFF_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setStaffList(list: Staff[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STAFF_KEY, JSON.stringify(list))
}

export function getStaffShifts(): StaffShift[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHIFTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setStaffShifts(shifts: StaffShift[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts))
}

export function getStaffMonthlyData(): StaffMonthlyData[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MONTHLY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function saveStaffMonthly(data: StaffMonthlyData) {
  if (typeof window === 'undefined') return
  const list = getStaffMonthlyData()
  const idx = list.findIndex((d) => d.staffId === data.staffId && d.month === data.month)
  const next = idx >= 0 ? [...list.slice(0, idx), data, ...list.slice(idx + 1)] : [...list, data]
  localStorage.setItem(MONTHLY_KEY, JSON.stringify(next))
}
