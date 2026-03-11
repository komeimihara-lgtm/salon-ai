/**
 * スタッフ管理（Supabase API版）
 * - スタッフ登録
 * - 1ヶ月のシフト
 * - 個人目標・月間KPI・重要タスク・成長目標・絶対にやり切ること
 */

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

export async function fetchStaffList(): Promise<Staff[]> {
  const res = await fetch('/api/staff')
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.staff || []
}

export async function addStaff(name: string, color: string): Promise<Staff> {
  const res = await fetch('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), color: color || '#C4728A' }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.staff
}

export async function removeStaff(id: string): Promise<void> {
  const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
}

export async function fetchStaffShifts(month?: string): Promise<StaffShift[]> {
  const url = month ? `/api/shifts?month=${month}` : '/api/shifts'
  const res = await fetch(url)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.shifts || []
}

export async function saveStaffShifts(shifts: StaffShift[]): Promise<void> {
  const payload = shifts
    .filter(s => s.start && s.end)
    .map(s => ({
      staff_id: s.staffId,
      date: s.date,
      start_time: s.start,
      end_time: s.end,
    }))
  if (payload.length === 0) return
  const res = await fetch('/api/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shifts: payload }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
}

export async function fetchStaffMonthlyData(): Promise<StaffMonthlyData[]> {
  const res = await fetch('/api/staff-monthly')
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data || []
}

export async function fetchStaffMonthlyForStaff(staffId: string, month: string): Promise<StaffMonthlyData | null> {
  const res = await fetch(`/api/staff-monthly?staff_id=${staffId}&month=${month}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  const list = json.data || []
  return list[0] ?? null
}

export async function saveStaffMonthly(data: StaffMonthlyData): Promise<void> {
  const res = await fetch('/api/staff-monthly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffId: data.staffId,
      month: data.month,
      personalGoal: data.personalGoal,
      monthlyKpi: data.monthlyKpi,
      importantTasks: data.importantTasks,
      growthGoals: data.growthGoals,
      mustDo: data.mustDo,
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error)
}

// 後方互換のため同期的なgetterを提供（空配列を返す・非推奨）
export function getStaffList(): Staff[] {
  return []
}

export function getStaffShifts(): StaffShift[] {
  return []
}

export function getStaffMonthlyData(): StaffMonthlyData[] {
  return []
}

export function getShiftsForMonth(_month: string): StaffShift[] {
  return []
}

export function getTodayShiftsFromNew(): StaffShift[] {
  return []
}
