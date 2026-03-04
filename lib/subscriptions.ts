const STORAGE_KEY = 'sola_subscription_plans'

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  sessionsPerMonth: number
  menuName: string
  billingDay: number
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
