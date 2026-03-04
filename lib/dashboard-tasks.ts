const STORAGE_KEY = 'sola_dashboard_tasks'

export interface ManualTask {
  id: string
  text: string
  done: boolean
}

const DEFAULT_TASKS: ManualTask[] = [
  { id: '4', text: '予約確認の電話', done: false },
  { id: '5', text: '在庫発注', done: true },
]

export function getManualTasks(): ManualTask[] {
  if (typeof window === 'undefined') return DEFAULT_TASKS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TASKS
    }
  } catch (_) {}
  return DEFAULT_TASKS
}

export function setManualTasks(tasks: ManualTask[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}
