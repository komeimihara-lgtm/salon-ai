export type CustomerStatus = 'vip' | 'active' | 'at_risk' | 'dormant' | 'lost' | 'temporary'

export function calcCustomerStatus(
  totalVisits: number,
  lastVisitDate: string | null,
  createdAt: string
): CustomerStatus {
  if (!lastVisitDate) return 'temporary'
  const daysSinceLastVisit = Math.floor(
    (Date.now() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (totalVisits >= 10 && daysSinceLastVisit <= 60) return 'vip'
  if (daysSinceLastVisit <= 60) return 'active'
  if (daysSinceLastVisit <= 90) return 'at_risk'
  if (daysSinceLastVisit <= 180) return 'dormant'
  return 'lost'
}
