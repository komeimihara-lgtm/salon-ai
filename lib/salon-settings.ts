const STORAGE_KEY = 'sola_salon_settings'

export interface SalonStaff {
  name: string
  color: string
}

export interface BusinessHours {
  openTime: string
  closeTime: string
}

export interface SalonSettings {
  salonName: string
  address: string
  phone: string
  businessHours: BusinessHours
  beds: string[]
  staff?: SalonStaff[]
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
  businessHours: { openTime: '10:00', closeTime: '21:00' },
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

function normalizeBusinessHours(v: unknown): BusinessHours {
  if (v && typeof v === 'object' && 'openTime' in v && 'closeTime' in v) {
    return { openTime: String((v as BusinessHours).openTime || '10:00'), closeTime: String((v as BusinessHours).closeTime || '21:00') }
  }
  if (typeof v === 'string' && v.includes('〜')) {
    const [open, close] = v.split('〜').map(s => s.trim().slice(0, 5))
    return { openTime: open || '10:00', closeTime: close || '21:00' }
  }
  return DEFAULT.businessHours
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
        businessHours: normalizeBusinessHours(parsed.businessHours),
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

export async function getBeds(): Promise<string[]> {
  const res = await fetch('/api/settings/salon')
  const json = await res.json()
  return json.beds || ['A', 'B']
}
