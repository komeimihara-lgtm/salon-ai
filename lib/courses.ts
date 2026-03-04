const STORAGE_KEY = 'sola_course_packs'

export interface CoursePack {
  id: string
  name: string
  menuName: string
  totalSessions: number
  price: number
  expiryMonths: number
}

export function getCoursePacks(): CoursePack[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setCoursePacks(packs: CoursePack[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs))
}
