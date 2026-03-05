const STORAGE_KEY = 'sola_menus'
const STORAGE_TAX = 'sola_tax_settings'
const STORAGE_CAMPAIGNS = 'sola_campaigns'

export interface MenuItem {
  id: string
  name: string
  duration: number
  price: number
  category: string
}

export interface TaxSettings {
  taxType: 'included' | 'excluded'
  taxRate: number
}

export interface Campaign {
  id: string
  name: string
  discountType: 'percent' | 'amount'
  discountValue: number
  targetCategory?: string
  startDate?: string
  endDate?: string
}

export const DEFAULT_CATEGORIES = [
  'フェイシャル',
  'ボディ',
  '脱毛',
  'オプション',
  '物販',
  'キャンペーン',
]

const DEFAULT_MENUS: MenuItem[] = [
  { id: '1', name: 'フェイシャル60分', duration: 60, price: 8000, category: 'フェイシャル' },
  { id: '2', name: 'フェイシャル90分', duration: 90, price: 12000, category: 'フェイシャル' },
  { id: '3', name: 'ボディ60分', duration: 60, price: 10000, category: 'ボディ' },
  { id: '4', name: 'ボディ90分', duration: 90, price: 15000, category: 'ボディ' },
  { id: '5', name: '美白コース', duration: 90, price: 18000, category: '脱毛' },
  { id: '6', name: 'エイジングケア', duration: 60, price: 12000, category: 'オプション' },
]

const DEFAULT_TAX: TaxSettings = {
  taxType: 'included',
  taxRate: 10,
}

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

export function setMenus(menus: MenuItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menus))
}

export function getCategories(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES
  try {
    const raw = localStorage.getItem('sola_categories')
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES
    }
  } catch (_) {}
  return DEFAULT_CATEGORIES
}

export function setCategories(categories: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem('sola_categories', JSON.stringify(categories))
}

export function getTaxSettings(): TaxSettings {
  if (typeof window === 'undefined') return DEFAULT_TAX
  try {
    const raw = localStorage.getItem(STORAGE_TAX)
    if (raw) return { ...DEFAULT_TAX, ...JSON.parse(raw) }
  } catch (_) {}
  return DEFAULT_TAX
}

export function setTaxSettings(tax: TaxSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_TAX, JSON.stringify(tax))
}

export function getCampaigns(): Campaign[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_CAMPAIGNS)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

export function setCampaigns(campaigns: Campaign[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_CAMPAIGNS, JSON.stringify(campaigns))
}

export function calcTaxAmount(price: number, tax: TaxSettings): number {
  if (tax.taxType === 'included') return Math.round(price * tax.taxRate / (100 + tax.taxRate))
  return Math.round(price * tax.taxRate / 100)
}

export function calcTotalWithTax(price: number, tax: TaxSettings): number {
  if (tax.taxType === 'included') return price
  return price + calcTaxAmount(price, tax)
}
