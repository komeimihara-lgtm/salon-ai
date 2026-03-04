const STORAGE_KEY = 'sola_salon_settings'

export interface SalonSettings {
  salonName: string
  address: string
  phone: string
  businessHours: string
  beds: string[]
  staff: { name: string; color: string }[]
  targets: { sales: number; visits: number; avgPrice: number }
}

const DEFAULT: SalonSettings = {
  salonName: '',
  address: '',
  phone: '',
  businessHours: '10:00〜20:00',
  beds: [],
  staff: [],
  targets: { sales: 600000, visits: 60, avgPrice: 10000 },
}

export function getSalonSettings(): SalonSettings {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch (_) {}
  return DEFAULT
}

export function setSalonSettings(settings: SalonSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
