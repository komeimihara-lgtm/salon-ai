const STORAGE_KEY = 'sola_course_packs'
const CUSTOMER_COURSES_KEY = 'sola_customer_courses'

export interface CoursePack {
  id: string
  name: string
  menuName: string
  totalSessions: number
  price: number
  expiryMonths: number
}

export interface CustomerCourse {
  id: string
  customerName: string
  menuName: string
  courseName: string
  totalSessions: number
  remainingSessions: number
  expiry?: string
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

export function getCustomerCourses(): CustomerCourse[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOMER_COURSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setCustomerCourses(courses: CustomerCourse[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOMER_COURSES_KEY, JSON.stringify(courses))
}

export function consumeCourse(id: string) {
  const courses = getCustomerCourses()
  const next = courses.map(c =>
    c.id === id && c.remainingSessions > 0
      ? { ...c, remainingSessions: c.remainingSessions - 1 }
      : c
  )
  setCustomerCourses(next)
}

export function isExpired(c: CustomerCourse): boolean {
  if (!c.expiry) return false
  return new Date(c.expiry) < new Date()
}

export function getExpiringSoon(days: number): CustomerCourse[] {
  const courses = getCustomerCourses()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)
  return courses.filter(c => {
    if (!c.expiry || c.remainingSessions <= 0) return false
    const exp = new Date(c.expiry)
    return exp >= new Date() && exp <= cutoff
  })
}

export function getExpired(): CustomerCourse[] {
  return getCustomerCourses().filter(c => c.remainingSessions > 0 && isExpired(c))
}
