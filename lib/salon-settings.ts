const STORAGE_KEY = 'sola_salon_settings'

export interface SalonStaff {
  name: string
  color: string
}

export interface SalonSettings {
  salonName: string
  address: string
  phone: string
  businessHours: string
  beds: string[]
  staff: SalonStaff[]
  targets: {
    sales: number
    visits: number
    avgPrice: number
  }
}

const DEFAULT: SalonSettings = {
  salonName: 'エステサロン ルミエール',
  address: '',
  phone: '',
  businessHours: '10:00〜20:00',
  beds: ['A', 'B'],
  staff: [
    { name: '田中', color: '#C4728A' },
    { name: '鈴木', color: '#9B8EC4' },
  ],
  targets: {
    sales: 600000,
    visits: 60,
    avgPrice: 10000,
  },
}

export function getSalonSettings(): SalonSettings {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT, ...parsed }
    }
  } catch (_) {}
  return DEFAULT
}

export function setSalonSettings(settings: SalonSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    window.dispatchEvent(new Event('salon-settings-updated'))
  } catch (_) {}
}
