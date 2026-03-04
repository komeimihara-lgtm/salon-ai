const STORAGE_KEY = 'sola_dashboard_reservations'

export interface DashboardReservation {
  id: string
  time: string // "10:00"
  bed: string
  name: string
  menu: string
  staff: string
}

const DEFAULT: DashboardReservation[] = [
  { id: '1', time: '10:00', bed: 'A', name: '山田 花子', menu: 'フェイシャル', staff: '田中' },
  { id: '2', time: '11:30', bed: 'B', name: '佐藤 美咲', menu: 'ボディケア', staff: '鈴木' },
  { id: '3', time: '14:00', bed: 'A', name: '高橋 恵', menu: 'フェイシャル', staff: '田中' },
  { id: '4', time: '15:30', bed: 'B', name: '伊藤 さくら', menu: 'フルコース', staff: '鈴木' },
]

export function getDashboardReservations(): DashboardReservation[] {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT
    }
  } catch (_) {}
  return DEFAULT
}

export function setDashboardReservations(reservations: DashboardReservation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations))
}
