/**
 * コース（回数券）管理
 * - コース定義（メニュー設定で登録）
 * - 顧客ごとの購入・消化・期限
 */

const COURSE_PACKS_KEY = 'sola_course_packs'
const CUSTOMER_COURSES_KEY = 'sola_customer_courses'

/** コース定義（回数券の種類） */
export interface CoursePack {
  id: string
  name: string
  menuName: string
  totalSessions: number
  price: number
  expiryMonths: number
}

/** 顧客が購入したコース（個別インスタンス） */
export interface CustomerCourse {
  id: string
  customerId: string
  customerName: string
  coursePackId: string
  courseName: string
  menuName: string
  totalSessions: number
  remainingSessions: number
  purchasedAt: string
  expiryDate: string
}

const DEFAULT_COURSE_PACKS: CoursePack[] = [
  { id: '1', name: 'フェイシャル5回券', menuName: 'フェイシャル', totalSessions: 5, price: 40000, expiryMonths: 6 },
  { id: '2', name: 'ボディケア3回券', menuName: 'ボディケア', totalSessions: 3, price: 35000, expiryMonths: 6 },
]

export function getCoursePacks(): CoursePack[] {
  if (typeof window === 'undefined') return DEFAULT_COURSE_PACKS
  try {
    const raw = localStorage.getItem(COURSE_PACKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COURSE_PACKS
    }
  } catch (_) {}
  return DEFAULT_COURSE_PACKS
}

export function setCoursePacks(packs: CoursePack[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(COURSE_PACKS_KEY, JSON.stringify(packs))
  window.dispatchEvent(new Event('course-packs-updated'))
}

export function getCustomerCourses(): CustomerCourse[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOMER_COURSES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (_) {}
  return []
}

export function setCustomerCourses(courses: CustomerCourse[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOMER_COURSES_KEY, JSON.stringify(courses))
  window.dispatchEvent(new Event('customer-courses-updated'))
}

export function getCoursesByCustomer(customerId: string): CustomerCourse[] {
  return getCustomerCourses().filter(c => c.customerId === customerId)
}

export function addCustomerCourse(
  customerId: string,
  customerName: string,
  pack: CoursePack
): CustomerCourse {
  const purchasedAt = new Date().toISOString().slice(0, 10)
  const expiry = new Date()
  expiry.setMonth(expiry.getMonth() + pack.expiryMonths)
  const expiryDate = expiry.toISOString().slice(0, 10)

  const course: CustomerCourse = {
    id: Date.now().toString(),
    customerId,
    customerName,
    coursePackId: pack.id,
    courseName: pack.name,
    menuName: pack.menuName,
    totalSessions: pack.totalSessions,
    remainingSessions: pack.totalSessions,
    purchasedAt,
    expiryDate,
  }
  const all = getCustomerCourses()
  setCustomerCourses([...all, course])
  return course
}

export function consumeCourse(courseId: string): boolean {
  const all = getCustomerCourses()
  const idx = all.findIndex(c => c.id === courseId)
  if (idx < 0 || all[idx].remainingSessions <= 0) return false
  all[idx] = { ...all[idx], remainingSessions: all[idx].remainingSessions - 1 }
  setCustomerCourses(all)
  return true
}

export function getExpiringSoon(days = 30): CustomerCourse[] {
  const today = new Date()
  const limit = new Date()
  limit.setDate(limit.getDate() + days)
  return getCustomerCourses().filter(c => {
    if (c.remainingSessions <= 0) return false
    const exp = new Date(c.expiryDate)
    return exp >= today && exp <= limit
  })
}

export function getExpired(): CustomerCourse[] {
  const today = new Date().toISOString().slice(0, 10)
  return getCustomerCourses().filter(c => c.expiryDate < today && c.remainingSessions > 0)
}

export function isExpired(course: CustomerCourse): boolean {
  return new Date(course.expiryDate) < new Date()
}

export function daysUntilExpiry(course: CustomerCourse): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(course.expiryDate)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
