/**
 * サブスク管理
 * - プラン定義（subscription_plans）→ Supabase API
 * - 顧客の加入・利用回数・更新日 → Supabase API
 */

/** サブスクプラン定義 */
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  sessionsPerMonth: number
  menuName: string
  billingDay: number
}

function mapRowToPlan(r: Record<string, unknown>): SubscriptionPlan {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    price: Number(r.price ?? 0),
    sessionsPerMonth: Number(r.sessionsPerMonth ?? r.sessions_per_month ?? 0),
    menuName: String(r.menuName ?? r.menu_name ?? ''),
    billingDay: Number(r.billingDay ?? r.billing_day ?? 1),
  }
}

/** APIからサブスクプランを取得 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const res = await fetch('/api/subscription-plans')
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.plans || []
  return rows.map((r: Record<string, unknown>) => mapRowToPlan(r))
}

export async function createSubscriptionPlan(plan: {
  name: string
  menuName: string
  price: number
  sessionsPerMonth: number
  billingDay?: number
}): Promise<SubscriptionPlan> {
  const res = await fetch('/api/subscription-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: plan.name,
      menu_name: plan.menuName,
      price: plan.price,
      sessions_per_month: plan.sessionsPerMonth,
      billing_day: plan.billingDay ?? 1,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  return mapRowToPlan(json.plan as Record<string, unknown>)
}

export async function deleteSubscriptionPlan(id: string): Promise<void> {
  const res = await fetch(`/api/subscription-plans/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '削除に失敗しました')
}

/** 顧客のサブスク加入 */
export interface CustomerSubscription {
  id: string
  customerId: string
  customerName: string
  planId: string
  planName: string
  menuName: string
  price: number
  sessionsPerMonth: number
  startedAt: string
  nextBillingDate: string
  sessionsUsedInPeriod: number
  status: 'active' | 'paused' | 'cancelled'
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
  { id: '1', name: '月額プレミアム', price: 8000, sessionsPerMonth: 2, menuName: 'フェイシャル', billingDay: 1 },
  { id: '2', name: '月額ベーシック', price: 5000, sessionsPerMonth: 1, menuName: 'フェイシャル', billingDay: 1 },
]

// ========== プラン定義（Supabase API・後方互換のためgetSubscriptionPlansは非推奨） ==========
/** @deprecated fetchSubscriptionPlans を使用してください */
export function getSubscriptionPlans(): SubscriptionPlan[] {
  return DEFAULT_PLANS
}

// ========== 顧客サブスク（Supabase API） ==========
function mapRowToSub(r: Record<string, unknown>): CustomerSubscription {
  return {
    id: String(r.id),
    customerId: String(r.customerId ?? r.customer_id),
    customerName: String(r.customerName ?? r.customer_name ?? ''),
    planId: String(r.planId ?? r.plan_id ?? ''),
    planName: String(r.planName ?? r.plan_name ?? ''),
    menuName: String(r.menuName ?? r.menu_name ?? ''),
    price: Number(r.price ?? 0),
    sessionsPerMonth: Number(r.sessionsPerMonth ?? r.sessions_per_month ?? 0),
    startedAt: String(r.startedAt ?? r.started_at ?? ''),
    nextBillingDate: String(r.nextBillingDate ?? r.next_billing_date ?? ''),
    sessionsUsedInPeriod: Number(r.sessionsUsedInPeriod ?? r.sessions_used_in_period ?? 0),
    status: (r.status as CustomerSubscription['status']) || 'active',
  }
}

export async function fetchCustomerSubscriptions(customerId?: string): Promise<CustomerSubscription[]> {
  const url = customerId
    ? `/api/customer-subscriptions?customer_id=${encodeURIComponent(customerId)}`
    : '/api/customer-subscriptions'
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '取得に失敗しました')
  const rows = json.subscriptions || []
  return rows.map((r: Record<string, unknown>) => mapRowToSub(r))
}

/** @deprecated 非同期版 fetchCustomerSubscriptions を使用 */
export function getCustomerSubscriptions(): CustomerSubscription[] {
  return []
}

export function getSubscriptionsByCustomer(customerId: string): CustomerSubscription[] {
  return []
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export async function addCustomerSubscription(
  customerId: string,
  customerName: string,
  plan: SubscriptionPlan
): Promise<CustomerSubscription> {
  const startedAt = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setDate(plan.billingDay)
  if (d < new Date()) d.setMonth(d.getMonth() + 1)
  const nextBillingDate = d.toISOString().slice(0, 10)

  const res = await fetch('/api/customer-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      customer_name: customerName,
      plan_id: plan.id,
      plan_name: plan.name,
      menu_name: plan.menuName,
      price: plan.price,
      sessions_per_month: plan.sessionsPerMonth,
      started_at: startedAt,
      next_billing_date: nextBillingDate,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '登録に失敗しました')
  window.dispatchEvent(new Event('customer-subscriptions-updated'))
  return mapRowToSub(json.subscription)
}

export async function useSubscriptionSession(subId: string): Promise<boolean> {
  const all = await fetchCustomerSubscriptions()
  const sub = all.find(s => s.id === subId)
  if (!sub) return false

  let nextBilling = sub.nextBillingDate
  let used = sub.sessionsUsedInPeriod
  const today = new Date().toISOString().slice(0, 10)

  if (nextBilling <= today) {
    nextBilling = addMonths(nextBilling, 1)
    used = 0
  }
  if (used >= sub.sessionsPerMonth) return false

  used += 1

  const res = await fetch(`/api/customer-subscriptions/${subId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions_used_in_period: used, next_billing_date: nextBilling }),
  })
  if (!res.ok) return false
  window.dispatchEvent(new Event('customer-subscriptions-updated'))
  return true
}

export async function cancelSubscription(subId: string): Promise<void> {
  const res = await fetch(`/api/customer-subscriptions/${subId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
  if (res.ok) window.dispatchEvent(new Event('customer-subscriptions-updated'))
}

export async function pauseSubscription(subId: string): Promise<void> {
  const res = await fetch(`/api/customer-subscriptions/${subId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paused' }),
  })
  if (res.ok) window.dispatchEvent(new Event('customer-subscriptions-updated'))
}

export async function resumeSubscription(subId: string): Promise<void> {
  const res = await fetch(`/api/customer-subscriptions/${subId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  })
  if (res.ok) window.dispatchEvent(new Event('customer-subscriptions-updated'))
}

function maybeAdvanceBillingPeriod(sub: CustomerSubscription): CustomerSubscription {
  const today = new Date().toISOString().slice(0, 10)
  if (sub.nextBillingDate <= today) {
    return {
      ...sub,
      nextBillingDate: addMonths(sub.nextBillingDate, 1),
      sessionsUsedInPeriod: 0,
    }
  }
  return sub
}

export function getSubscriptionWithCurrentPeriod(sub: CustomerSubscription): CustomerSubscription {
  return maybeAdvanceBillingPeriod(sub)
}

export function ensureBillingPeriodCurrent(sub: CustomerSubscription): CustomerSubscription {
  return maybeAdvanceBillingPeriod(sub)
}

export function getRemainingSessions(sub: CustomerSubscription): number {
  const updated = maybeAdvanceBillingPeriod(sub)
  return Math.max(0, updated.sessionsPerMonth - updated.sessionsUsedInPeriod)
}

export function daysUntilNextBilling(sub: CustomerSubscription): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(sub.nextBillingDate)
  next.setHours(0, 0, 0, 0)
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
