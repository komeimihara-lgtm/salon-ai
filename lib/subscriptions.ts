/**
 * サブスク管理
 * - プラン定義（月額・含まれる施術回数など）
 * - 顧客の加入・利用回数・更新日
 */

const SUBSCRIPTION_PLANS_KEY = 'sola_subscription_plans'
const CUSTOMER_SUBSCRIPTIONS_KEY = 'sola_customer_subscriptions'

/** サブスクプラン定義 */
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  sessionsPerMonth: number
  menuName: string
  billingDay: number // 1-28 課金日
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

export function getSubscriptionPlans(): SubscriptionPlan[] {
  if (typeof window === 'undefined') return DEFAULT_PLANS
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_PLANS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PLANS
    }
  } catch (_) {}
  return DEFAULT_PLANS
}

export function setSubscriptionPlans(plans: SubscriptionPlan[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SUBSCRIPTION_PLANS_KEY, JSON.stringify(plans))
  window.dispatchEvent(new Event('subscription-plans-updated'))
}

export function getCustomerSubscriptions(): CustomerSubscription[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOMER_SUBSCRIPTIONS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (_) {}
  return []
}

export function setCustomerSubscriptions(subs: CustomerSubscription[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOMER_SUBSCRIPTIONS_KEY, JSON.stringify(subs))
  window.dispatchEvent(new Event('customer-subscriptions-updated'))
}

export function getSubscriptionsByCustomer(customerId: string): CustomerSubscription[] {
  return getCustomerSubscriptions().filter(s => s.customerId === customerId && s.status === 'active')
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
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

export function addCustomerSubscription(
  customerId: string,
  customerName: string,
  plan: SubscriptionPlan
): CustomerSubscription {
  const startedAt = new Date().toISOString().slice(0, 10)
  const d = new Date()
  d.setDate(plan.billingDay)
  if (d < new Date()) d.setMonth(d.getMonth() + 1)
  const nextBillingDate = d.toISOString().slice(0, 10)

  const sub: CustomerSubscription = {
    id: Date.now().toString(),
    customerId,
    customerName,
    planId: plan.id,
    planName: plan.name,
    menuName: plan.menuName,
    price: plan.price,
    sessionsPerMonth: plan.sessionsPerMonth,
    startedAt,
    nextBillingDate,
    sessionsUsedInPeriod: 0,
    status: 'active',
  }
  const all = getCustomerSubscriptions()
  setCustomerSubscriptions([...all, sub])
  return sub
}

export function useSubscriptionSession(subId: string): boolean {
  const all = getCustomerSubscriptions()
  const idx = all.findIndex(s => s.id === subId)
  if (idx < 0) return false
  let sub = maybeAdvanceBillingPeriod(all[idx])
  if (sub.sessionsUsedInPeriod >= sub.sessionsPerMonth) return false
  sub = { ...sub, sessionsUsedInPeriod: sub.sessionsUsedInPeriod + 1 }
  all[idx] = sub
  setCustomerSubscriptions(all)
  return true
}

export function cancelSubscription(subId: string) {
  const all = getCustomerSubscriptions()
  const idx = all.findIndex(s => s.id === subId)
  if (idx < 0) return
  all[idx] = { ...all[idx], status: 'cancelled' as const }
  setCustomerSubscriptions(all)
}

export function pauseSubscription(subId: string) {
  const all = getCustomerSubscriptions()
  const idx = all.findIndex(s => s.id === subId)
  if (idx < 0) return
  all[idx] = { ...all[idx], status: 'paused' as const }
  setCustomerSubscriptions(all)
}

export function resumeSubscription(subId: string) {
  const all = getCustomerSubscriptions()
  const idx = all.findIndex(s => s.id === subId)
  if (idx < 0) return
  all[idx] = { ...all[idx], status: 'active' as const }
  setCustomerSubscriptions(all)
}

export function getSubscriptionWithCurrentPeriod(sub: CustomerSubscription): CustomerSubscription {
  return maybeAdvanceBillingPeriod(sub)
}

/** 課金期間を進めて必要なら保存 */
export function ensureBillingPeriodCurrent(sub: CustomerSubscription): CustomerSubscription {
  const updated = maybeAdvanceBillingPeriod(sub)
  if (updated.nextBillingDate !== sub.nextBillingDate || updated.sessionsUsedInPeriod !== sub.sessionsUsedInPeriod) {
    const all = getCustomerSubscriptions()
    const idx = all.findIndex(s => s.id === sub.id)
    if (idx >= 0) {
      all[idx] = updated
      setCustomerSubscriptions(all)
    }
  }
  return updated
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
