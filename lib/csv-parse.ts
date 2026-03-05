/**
 * CSVパース・カラムマッピング
 * UTF-8 / Shift-JIS 対応
 */

// カラム名のマッピング（複数の表記を統一）
const COLUMN_ALIASES: Record<string, string> = {
  name: 'name',
  '名前': 'name',
  '氏名': 'name',
  '顧客名': 'name',
  name_kana: 'name_kana',
  '名前カナ': 'name_kana',
  'フリガナ': 'name_kana',
  'ふりがな': 'name_kana',
  phone: 'phone',
  '電話番号': 'phone',
  'TEL': 'phone',
  tel: 'phone',
  email: 'email',
  'メールアドレス': 'email',
  'メール': 'email',
  address: 'address',
  '住所': 'address',
  birthday: 'birthday',
  '生年月日': 'birthday',
  '誕生日': 'birthday',
  gender: 'gender',
  '性別': 'gender',
  first_visit_date: 'first_visit_date',
  '初回来店日': 'first_visit_date',
  '入会日': 'first_visit_date',
  '初回来店': 'first_visit_date',
  memo: 'memo',
  'メモ': 'memo',
  '備考': 'memo',
  purchase_history: 'purchase_history',
  '購入履歴': 'purchase_history',
  ticket_plan_name: 'ticket_plan_name',
  '回数券名': 'ticket_plan_name',
  '回数券': 'ticket_plan_name',
  remaining_sessions: 'remaining_sessions',
  '回数券残回数': 'remaining_sessions',
  '残回数': 'remaining_sessions',
  expiry_date: 'expiry_date',
  '回数券有効期限': 'expiry_date',
  '有効期限': 'expiry_date',
  unearned_revenue: 'unearned_revenue',
  '役務残金額': 'unearned_revenue',
  '役務残': 'unearned_revenue',
}

function normalizeHeader(h: string): string {
  const trimmed = h.trim().replace(/^"|"$/g, '')
  return COLUMN_ALIASES[trimmed] ?? COLUMN_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

function parseDate(s: string | undefined): string | null {
  if (!s || !s.trim()) return null
  const cleaned = s.trim().replace(/\//g, '-').replace(/年|月|日/g, '-')
  const m = cleaned.match(/(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})?/)
  if (m) {
    const y = m[1]
    const mon = m[2].padStart(2, '0')
    const d = (m[3] || '01').padStart(2, '0')
    return `${y}-${mon}-${d}`
  }
  return null
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0
  return parseInt(String(s).replace(/[¥,，\s]/g, '')) || 0
}

function parseGender(s: string | undefined): string {
  if (!s) return 'unknown'
  const v = s.toLowerCase()
  if (v.includes('女') || v === 'female') return 'female'
  if (v.includes('男') || v === 'male') return 'male'
  if (v.includes('他') || v === 'other') return 'other'
  return 'unknown'
}

function parsePurchaseHistory(val: string | undefined): { date: string; menu: string; amount: number }[] {
  if (!val || !val.trim()) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) {
      return parsed.map((p: { date?: string; menu?: string; amount?: number }) => ({
        date: p.date || '',
        menu: p.menu || '',
        amount: Number(p.amount) || 0,
      }))
    }
  } catch {
    // テキスト形式: "2024-01-15 フェイシャル 8000" など
    const lines = val.split(/[\n;]/).filter(Boolean)
    return lines.map(line => {
      const parts = line.trim().split(/\s+/)
      const date = parts[0]?.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/)?.[0] || ''
      const amount = parseAmount(parts[parts.length - 1])
      const menu = parts.slice(1, -1).join(' ') || ''
      return { date, menu, amount }
    }).filter(p => p.date || p.menu || p.amount)
  }
  return []
}

/** CSV文字列をパースして顧客オブジェクトの配列を返す */
export function parseCSVToCustomers(csvText: string): ImportCustomerRow[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headerLine = lines[0]
  const headers = headerLine.split(',').map(h => normalizeHeader(h.trim().replace(/^"|"$/g, '')))

  const rows: ImportCustomerRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    const name = row.name || row['氏名'] || row['顧客名'] || ''
    if (!name.trim()) continue

    const purchaseHistory = parsePurchaseHistory(row.purchase_history || row['購入履歴'])
    const firstVisit = parseDate(row.first_visit_date || row['初回来店日'] || row['入会日'])
    const lastVisit = purchaseHistory.length > 0
      ? purchaseHistory.reduce((latest, p) => (p.date > latest ? p.date : latest), '')
      : null

    const totalSpent = purchaseHistory.reduce((s, p) => s + p.amount, 0)
    const visitCount = purchaseHistory.length || 0

    rows.push({
      name: name.trim(),
      name_kana: (row.name_kana || row['フリガナ'] || '').trim() || undefined,
      phone: (row.phone || row['電話番号'] || '').trim() || undefined,
      email: (row.email || row['メールアドレス'] || '').trim() || undefined,
      address: (row.address || row['住所'] || '').trim() || undefined,
      birthday: parseDate(row.birthday || row['生年月日']) || undefined,
      gender: parseGender(row.gender || row['性別']),
      first_visit_date: firstVisit || undefined,
      memo: (row.memo || row['メモ'] || '').trim() || undefined,
      purchase_history: purchaseHistory.length > 0 ? purchaseHistory : undefined,
      ticket_plan_name: (row.ticket_plan_name || row['回数券名'] || '').trim() || undefined,
      remaining_sessions: parseInt(row.remaining_sessions || row['回数券残回数'] || '0') || undefined,
      expiry_date: parseDate(row.expiry_date || row['回数券有効期限'] || '') || undefined,
      unearned_revenue: parseAmount(row.unearned_revenue || row['役務残金額'] || '') || undefined,
      visit_count: visitCount,
      total_spent: totalSpent,
      avg_unit_price: visitCount > 0 ? Math.round(totalSpent / visitCount) : 0,
    })
  }
  return rows
}

/** CSV行をパース（ダブルクォート内のカンマを考慮） */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

export type ImportCustomerRow = {
  name: string
  name_kana?: string
  phone?: string
  email?: string
  address?: string
  birthday?: string
  gender?: string
  first_visit_date?: string
  memo?: string
  purchase_history?: { date: string; menu: string; amount: number }[]
  ticket_plan_name?: string
  remaining_sessions?: number
  expiry_date?: string
  unearned_revenue?: number
  visit_count?: number
  total_spent?: number
  avg_unit_price?: number
}
