/**
 * 目標・達成率の共通ユーティリティ
 */

/** 日割り目標を計算（月間目標 ÷ 営業日数） */
export function getDailyTarget(monthlyGoal: number, workingDays: number): number {
  if (workingDays <= 0) return 0
  return Math.round(monthlyGoal / workingDays)
}

/** 達成率（%）を計算 */
export function getAchievementRate(actual: number, target: number): number {
  if (target <= 0) return actual > 0 ? 100 : 0
  return Math.round((actual / target) * 100)
}

/** 達成率に応じた色を返す */
export function getAchievementColor(rate: number): string {
  if (rate >= 100) return 'text-emerald-600'  // green
  if (rate >= 80) return 'text-blue-600'      // blue
  if (rate >= 50) return 'text-amber-600'     // yellow
  return 'text-red-600'                        // red
}

/** 達成率に応じた背景色（プログレスバー用） */
export function getAchievementBgColor(rate: number): string {
  if (rate >= 100) return 'bg-emerald-500'
  if (rate >= 80) return 'bg-blue-500'
  if (rate >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

/** 今月の営業日数を取得（土日除く、月末まで） */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= lastDay; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++
  }
  return count
}

/** 今日までの営業日数 */
export function getWorkingDaysSoFar(year: number, month: number): number {
  const today = new Date()
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return 0
  const day = today.getDate()
  let count = 0
  for (let d = 1; d <= day; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++
  }
  return count
}
