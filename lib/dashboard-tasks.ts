const STORAGE_KEY = 'sola_dashboard_tasks'

export interface ManualTask {
  id: string
  text: string
  done: boolean
}

export function getManualTasks(): ManualTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setManualTasks(tasks: ManualTask[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}
