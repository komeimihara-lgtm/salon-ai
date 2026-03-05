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
    sales: number           // 月間売上目標（monthlyRevenue）
    visits: number         // 来店人数目標（visitCount）
    avgPrice: number       // 平均客単価目標（avgUnitPrice）
    productSales: number   // 物販売上目標
    newCustomers: number   // 新規客数目標
    newReservations: number // 新規予約数目標
  }
  externalUrls: {
    hotpepper?: string
    salonHp?: string
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
    productSales: 50000,
    newCustomers: 10,
    newReservations: 15,
  },
  externalUrls: {
    hotpepper: '',
    salonHp: '',
  },
}

export function getSalonSettings(): SalonSettings {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT,
        ...parsed,
        targets: { ...DEFAULT.targets, ...(parsed.targets || {}) },
      }
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
