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

/** 達成率に応じた色（バッジ用・pastelトーン） */
export function getAchievementColor(rate: number): string {
  if (rate >= 100) return 'text-emerald-400'  // 100%超: 薄いエメラルド
  if (rate >= 80) return 'text-violet-400'    // 80〜99%: 薄いラベンダー
  if (rate >= 50) return 'text-amber-400'     // 50〜80%: 薄いアンバー
  return 'text-rose-400'                      // 〜50%: 薄いローズ
}

/** 達成率に応じた背景色（プログレスバー用・pastelトーン） */
export function getAchievementBgColor(rate: number): string {
  if (rate >= 100) return 'bg-emerald-400'
  if (rate >= 80) return 'bg-violet-400'
  if (rate >= 50) return 'bg-amber-400'
  return 'bg-rose-400'
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
