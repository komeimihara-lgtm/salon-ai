const STORAGE_KEY = 'sola_menus'

export interface MenuItem {
  id: string
  name: string
  duration: number
  price: number
}

const DEFAULT_MENUS: MenuItem[] = [
  { id: '1', name: 'フェイシャル', duration: 60, price: 8000 },
  { id: '2', name: 'ボディケア', duration: 90, price: 12000 },
  { id: '3', name: 'フルコース', duration: 120, price: 20000 },
]

export function getMenus(): MenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_MENUS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MENUS
    }
  } catch (_) {}
  return DEFAULT_MENUS
}
