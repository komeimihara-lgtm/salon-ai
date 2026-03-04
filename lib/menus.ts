const STORAGE_KEY = 'sola_menus'

export interface MenuItem {
  id: string
  name: string
  duration: number
  price: number
}

const DEFAULT_MENUS: MenuItem[] = [
  { id: '1', name: 'フェイシャル60分', duration: 60, price: 8000 },
  { id: '2', name: 'フェイシャル90分', duration: 90, price: 12000 },
  { id: '3', name: 'ボディ60分', duration: 60, price: 10000 },
  { id: '4', name: 'ボディ90分', duration: 90, price: 15000 },
  { id: '5', name: '美白コース', duration: 90, price: 18000 },
  { id: '6', name: 'エイジングケア', duration: 60, price: 12000 },
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
