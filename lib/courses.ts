/**
 * コース（回数券）管理
 * - コース定義（メニュー設定で登録）→ LocalStorage
 * - 顧客ごとの購入・消化・期限 → Supabase API
 */

const COURSE_PACKS_KEY = 'sola_course_packs'

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

// ========== コース定義（LocalStorage・メニュー設定連動） ==========
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

// ========== 顧客コース（Supabase API） ==========
function mapRowToCourse(r: Record<string, unknown>): CustomerCourse {
  return {
    id: String(r.id),
    customerId: String(r.customerId ?? r.customer_id),
    customerName: String(r.customerName ?? r.customer_name ?? ''),
    coursePackId: String(r.coursePackId ?? r.course_pack_id ?? ''),
    courseName: String(r.courseName ?? r.course_name ?? ''),
    menuName: String(r.menuName ?? r.menu_name ?? ''),
    totalSessions: Number(r.totalSessions ?? r.total_sessions ?? 0),
    remainingSessions: Number(r.remainingSessions ?? r.remaining_sessions ?? 0),
    purchasedAt: String(r.purchasedAt ?? r.purchased_at ?? ''),
    expiryDate: String(r.expiryDate ?? r.expiry_date ?? ''),
  }
}

export async function fetchCustomerCourses(customerId?: string): Promise<CustomerCourse[]> {
  const url = customerId
    ? `/api/customer-courses?customer_id=${encodeURIComponent(customerId)}`
    : '/api/customer-courses'
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.courses || []
  return rows.map((r: Record<string, unknown>) => mapRowToCourse(r))
}

/** @deprecated 非同期版 fetchCustomerCourses を使用 */
export function getCustomerCourses(): CustomerCourse[] {
  return []
}

export function getCoursesByCustomer(customerId: string): CustomerCourse[] {
  return []
}

export async function addCustomerCourse(
  customerId: string,
  customerName: string,
  pack: CoursePack
): Promise<CustomerCourse> {
  const purchasedAt = new Date().toISOString().slice(0, 10)
  const expiry = new Date()
  expiry.setMonth(expiry.getMonth() + pack.expiryMonths)
  const expiryDate = expiry.toISOString().slice(0, 10)

  const res = await fetch('/api/customer-courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      customer_name: customerName,
      course_pack_id: pack.id,
      course_name: pack.name,
      menu_name: pack.menuName,
      total_sessions: pack.totalSessions,
      remaining_sessions: pack.totalSessions,
      purchased_at: purchasedAt,
      expiry_date: expiryDate,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  const c = json.course
  window.dispatchEvent(new Event('customer-courses-updated'))
  return mapRowToCourse(c)
}

export async function consumeCourse(courseId: string): Promise<boolean> {
  const courses = await fetchCustomerCourses()
  const course = courses.find(c => c.id === courseId)
  if (!course || course.remainingSessions <= 0) return false

  const newRemaining = course.remainingSessions - 1
  const res = await fetch(`/api/customer-courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remaining_sessions: newRemaining }),
  })
  if (!res.ok) return false
  window.dispatchEvent(new Event('customer-courses-updated'))
  return true
}

export async function fetchExpiringSoon(days = 30): Promise<CustomerCourse[]> {
  const all = await fetchCustomerCourses()
  const today = new Date()
  const limit = new Date()
  limit.setDate(limit.getDate() + days)
  return all.filter(c => {
    if (c.remainingSessions <= 0) return false
    const exp = new Date(c.expiryDate)
    return exp >= today && exp <= limit
  })
}

export async function fetchExpired(): Promise<CustomerCourse[]> {
  const all = await fetchCustomerCourses()
  const today = new Date().toISOString().slice(0, 10)
  return all.filter(c => c.expiryDate < today && c.remainingSessions > 0)
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
