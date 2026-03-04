const STORAGE_KEY = 'sola_subscription_plans'
const CUSTOMER_SUBS_KEY = 'sola_customer_subscriptions'

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  sessionsPerMonth: number
  menuName: string
  billingDay: number
}

export interface CustomerSubscription {
  id: string
  customerName: string
  menuName: string
  planName: string
  planId: string
  status: 'active' | 'cancelled'
  sessionsUsed: number
  periodStart: string
  periodEnd: string
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setSubscriptionPlans(plans: SubscriptionPlan[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
}

export function getCustomerSubscriptions(): CustomerSubscription[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOMER_SUBS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setCustomerSubscriptions(subs: CustomerSubscription[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CUSTOMER_SUBS_KEY, JSON.stringify(subs))
}

export function ensureBillingPeriodCurrent(s: CustomerSubscription): CustomerSubscription {
  const now = new Date()
  const periodEnd = new Date(s.periodEnd)
  if (periodEnd >= now) return s
  const nextStart = new Date(periodEnd)
  nextStart.setDate(nextStart.getDate() + 1)
  const nextEnd = new Date(nextStart)
  nextEnd.setMonth(nextEnd.getMonth() + 1)
  nextEnd.setDate(nextEnd.getDate() - 1)
  const updated = {
    ...s,
    periodStart: nextStart.toISOString().slice(0, 10),
    periodEnd: nextEnd.toISOString().slice(0, 10),
    sessionsUsed: 0,
  }
  const all = getCustomerSubscriptions()
  const next = all.map(x => (x.id === s.id ? updated : x))
  setCustomerSubscriptions(next)
  return updated
}

export function getRemainingSessions(s: CustomerSubscription): number {
  const plans = getSubscriptionPlans()
  const plan = plans.find(p => p.id === s.planId)
  const max = plan?.sessionsPerMonth ?? 4
  return Math.max(0, max - s.sessionsUsed)
}

export function useSubscriptionSession(id: string) {
  const all = getCustomerSubscriptions()
  const next = all.map(s =>
    s.id === id ? { ...s, sessionsUsed: s.sessionsUsed + 1 } : s
  )
  setCustomerSubscriptions(next)
}
