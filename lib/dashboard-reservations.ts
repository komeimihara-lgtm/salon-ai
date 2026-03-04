const STORAGE_KEY = 'sola_dashboard_reservations'

export interface DashboardReservation {
  id: string
  time: string
  bed: string
  name: string
  menu: string
  staff: string
}

export function getDashboardReservations(): DashboardReservation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {}
  return []
}

export function setDashboardReservations(reservations: DashboardReservation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations))
}
