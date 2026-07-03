/**
 * CSVパース・カラムマッピング
 * UTF-8 / Shift-JIS 対応
 *
 * 設計方針:
 *  - 業界で使われる可能性のあるヘッダー表記を極力全部受け入れる（サイレント失敗撲滅）
 *  - ヘッダー正規化を段階的に試行（前後空白/全角/大文字小文字/括弧付き）
 *  - どうしても認識できなかった列は unmappedHeaders として返し、UIで警告表示
 */

// カラム名のマッピング（複数の表記を統一）
const COLUMN_ALIASES: Record<string, string> = {
  // ── 氏名 ───────────────────────────────────
  name: 'name',
  '名前': 'name',
  '氏名': 'name',
  '顧客名': 'name',
  'お名前': 'name',
  '会員名': 'name',
  '客名': 'name',
  'お客様名': 'name',
  '氏名（漢字）': 'name',
  '顧客氏名': 'name',
  '御芳名': 'name',
  'customer': 'name',
  'customer_name': 'name',
  'customername': 'name',

  // ── フリガナ ───────────────────────────────
  name_kana: 'name_kana',
  '名前カナ': 'name_kana',
  '氏名カナ': 'name_kana',
  '氏名（カナ）': 'name_kana',
  'フリガナ': 'name_kana',
  'ふりがな': 'name_kana',
  'カナ': 'name_kana',
  'かな': 'name_kana',
  'ヨミガナ': 'name_kana',
  'よみがな': 'name_kana',
  'ヨミ': 'name_kana',
  'よみ': 'name_kana',
  '読み仮名': 'name_kana',
  '読み': 'name_kana',
  'セイメイカナ': 'name_kana',
  'ローマ字': 'name_kana',
  'kana': 'name_kana',
  'furigana': 'name_kana',

  // ── 電話番号 ───────────────────────────────
  phone: 'phone',
  '電話番号': 'phone',
  '電話': 'phone',
  '携帯': 'phone',
  '携帯番号': 'phone',
  '携帯電話': 'phone',
  '携帯電話番号': 'phone',
  '連絡先': 'phone',
  '連絡先電話': 'phone',
  '自宅電話': 'phone',
  'tel': 'phone',
  'phone_number': 'phone',
  'mobile': 'phone',

  // ── メール ────────────────────────────────
  email: 'email',
  'メールアドレス': 'email',
  'メール': 'email',
  'メアド': 'email',
  'Ｅメール': 'email',
  'eメール': 'email',
  'e-mail': 'email',
  'mail': 'email',
  'mailaddress': 'email',
  'mail_address': 'email',
  'email_address': 'email',

  // ── 住所 ──────────────────────────────────
  address: 'address',
  '住所': 'address',
  '現住所': 'address',
  '所在地': 'address',
  '住所1': 'address',
  '自宅住所': 'address',

  // ── 郵便番号（住所の前置き用）→ memo に集約 ──
  '郵便番号': 'postal_code',
  '〒': 'postal_code',
  'postal_code': 'postal_code',
  'zip': 'postal_code',

  // ── 生年月日 ──────────────────────────────
  birthday: 'birthday',
  '生年月日': 'birthday',
  '誕生日': 'birthday',
  'バースデー': 'birthday',
  'birth_date': 'birthday',
  'birthdate': 'birthday',
  'dob': 'birthday',

  // ── 性別 ──────────────────────────────────
  gender: 'gender',
  '性別': 'gender',
  'sex': 'gender',

  // ── 初回来店日 / 登録日 ────────────────────
  first_visit_date: 'first_visit_date',
  '初回来店日': 'first_visit_date',
  '初回来店': 'first_visit_date',
  '初来店': 'first_visit_date',
  '初来店日': 'first_visit_date',
  '来店開始日': 'first_visit_date',
  '入会日': 'first_visit_date',
  '登録日': 'first_visit_date',
  '顧客登録日': 'first_visit_date',
  'first_visit': 'first_visit_date',
  'registration_date': 'first_visit_date',
  'joined': 'first_visit_date',

  // ── 最終来店日 ────────────────────────────
  last_visit_date: 'last_visit_date',
  '最終来店日': 'last_visit_date',
  '最終来店': 'last_visit_date',
  '前回来店日': 'last_visit_date',
  '前回来店': 'last_visit_date',
  'last_visit': 'last_visit_date',

  // ── メモ / 備考 ───────────────────────────
  memo: 'memo',
  'メモ': 'memo',
  '備考': 'memo',
  'コメント': 'memo',
  '特記事項': 'memo',
  '注意事項': 'memo',
  'ノート': 'memo',
  '申し送り': 'memo',
  'note': 'memo',
  'notes': 'memo',
  'comment': 'memo',
  'remarks': 'memo',

  // ── 悩み / 施術目的 ───────────────────────
  concerns: 'concerns',
  '悩み': 'concerns',
  'お悩み': 'concerns',
  'ご相談': 'concerns',
  '施術悩み': 'concerns',
  '施術の悩み': 'concerns',
  '気になる箇所': 'concerns',
  '気になるところ': 'concerns',
  'カウンセリング内容': 'concerns',
  '主訴': 'concerns',

  // ── アレルギー / 禁忌 ─────────────────────
  allergies: 'allergies',
  'アレルギー': 'allergies',
  'アレルギー情報': 'allergies',
  '禁忌': 'allergies',
  '既往歴': 'allergies',
  '持病': 'allergies',

  // ── LINE ID / SNS ─────────────────────────
  line_user_id: 'line_user_id',
  'LINE ID': 'line_user_id',
  'lineid': 'line_user_id',
  'line': 'line_user_id',
  'LINEユーザーID': 'line_user_id',

  // ── 職業 / 紹介元 / 会員番号 → memo に集約 ─
  occupation: 'occupation',
  '職業': 'occupation',
  'お仕事': 'occupation',
  '職種': 'occupation',

  referral: 'referral',
  '紹介元': 'referral',
  '紹介者': 'referral',
  'ご紹介': 'referral',

  member_number: 'member_number',
  '会員番号': 'member_number',
  '顧客ID': 'member_number',
  '顧客番号': 'member_number',
  'customer_id': 'member_number',

  blood_type: 'blood_type',
  '血液型': 'blood_type',

  // ── 購入履歴・回数券系 ────────────────────
  purchase_history: 'purchase_history',
  '購入履歴': 'purchase_history',

  ticket_plan_name: 'ticket_plan_name',
  '回数券名': 'ticket_plan_name',
  '回数券': 'ticket_plan_name',
  '回数券種類': 'ticket_plan_name',
  'コース名': 'ticket_plan_name',

  remaining_sessions: 'remaining_sessions',
  '回数券残回数': 'remaining_sessions',
  '残回数': 'remaining_sessions',
  '残り回数': 'remaining_sessions',
  '残数': 'remaining_sessions',

  expiry_date: 'expiry_date',
  '回数券有効期限': 'expiry_date',
  '有効期限': 'expiry_date',
  '期限': 'expiry_date',

  unearned_revenue: 'unearned_revenue',
  '役務残金額': 'unearned_revenue',
  '役務残': 'unearned_revenue',
  '前受金': 'unearned_revenue',

  visit_count: 'visit_count',
  '来店回数': 'visit_count',
  '累計来店回数': 'visit_count',
  '利用回数': 'visit_count',

  total_spent: 'total_spent',
  '累計金額': 'total_spent',
  '累計売上': 'total_spent',
  '合計金額': 'total_spent',
  '売上合計': 'total_spent',
}

/** JelliFi 側で意味を持つ内部キー一覧（未マッピング判定用） */
const KNOWN_FIELD_KEYS = new Set<string>(Object.values(COLUMN_ALIASES))

/**
 * ヘッダー正規化：多段階のマッチ。
 * 1) そのまま
 * 2) 前後空白（全角含む）・引用符・BOM除去
 * 3) 括弧内除去 例：「電話番号（自宅）」→「電話番号」／「生年月日 [YYYY/MM/DD]」→「生年月日」
 * 4) 記号除去 例：「E-mail」→「email」
 * 5) 小文字化
 */
function normalizeHeader(raw: string): { key: string; original: string } {
  const original = raw
  const stripped = raw
    .replace(/^﻿/, '')
    .replace(/^["'`]|["'`]$/g, '')
    // 全角空白 → 半角空白 → trim
    .replace(/　/g, ' ')
    .trim()
  const candidates: string[] = []
  candidates.push(stripped)
  candidates.push(stripped.toLowerCase())
  // 括弧内を除去（半角/全角）
  const noParen = stripped
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
  if (noParen && noParen !== stripped) {
    candidates.push(noParen)
    candidates.push(noParen.toLowerCase())
  }
  // 記号除去（- _ . ・ など）
  const noSymbol = stripped.replace(/[-_.\s・：:\/]/g, '')
  if (noSymbol && noSymbol !== stripped) {
    candidates.push(noSymbol)
    candidates.push(noSymbol.toLowerCase())
  }
  for (const c of candidates) {
    if (COLUMN_ALIASES[c]) return { key: COLUMN_ALIASES[c], original }
  }
  // どれもヒットしなければ、そのまま（unmapped扱い）
  return { key: stripped, original }
}

function parseDate(s: string | undefined | null): string | null {
  if (!s || !String(s).trim()) return null
  const cleaned = String(s).trim().replace(/[／]/g, '/').replace(/\//g, '-').replace(/年|月|日/g, '-')
  const m = cleaned.match(/(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})?/)
  if (m) {
    const y = m[1]
    const mon = m[2].padStart(2, '0')
    const d = (m[3] || '01').padStart(2, '0')
    return `${y}-${mon}-${d}`
  }
  return null
}

function parseAmount(s: string | undefined | null): number {
  if (!s) return 0
  return parseInt(String(s).replace(/[¥,，\s円]/g, '')) || 0
}

function parseGender(s: string | undefined | null): string {
  if (!s) return 'unknown'
  const v = String(s).toLowerCase()
  if (v.includes('女') || v === 'female' || v === 'f' || v === 'ｆ') return 'female'
  if (v.includes('男') || v === 'male' || v === 'm' || v === 'ｍ') return 'male'
  if (v.includes('他') || v === 'other') return 'other'
  return 'unknown'
}

/** 電話番号：Excel等で先頭0が落ちた10桁の携帯番号を復元 */
function normalizePhone(s: string | undefined | null): string | undefined {
  if (!s) return undefined
  let v = String(s).trim().replace(/[\s]/g, '')
  if (!v) return undefined
  // 数字とハイフンのみ残す
  const onlyDigits = v.replace(/[^\d]/g, '')
  // 先頭0が落ちた 10桁の携帯（7/8/9で始まる）→ 0を補完
  if (onlyDigits.length === 10 && /^[789]/.test(onlyDigits)) v = '0' + onlyDigits
  else if (onlyDigits.length === 11 && /^0[789]/.test(onlyDigits)) v = onlyDigits
  else v = onlyDigits || v
  return v
}

function parsePurchaseHistory(val: string | undefined | null): { date: string; menu: string; amount: number }[] {
  if (!val || !String(val).trim()) return []
  try {
    const parsed = JSON.parse(String(val))
    if (Array.isArray(parsed)) {
      return parsed.map((p: { date?: string; menu?: string; amount?: number }) => ({
        date: p.date || '',
        menu: p.menu || '',
        amount: Number(p.amount) || 0,
      }))
    }
  } catch {
    const lines = String(val).split(/[\n;]/).filter(Boolean)
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

export type ParseResult = {
  customers: ImportCustomerRow[]
  /** 認識できなかったヘッダー名（ユーザーに警告表示するため） */
  unmappedHeaders: string[]
  /** 認識できたヘッダー名（ユーザーに確認表示するため） */
  mappedHeaders: { original: string; mapped: string }[]
}

/**
 * CSV文字列をパースして顧客オブジェクトの配列＋メタデータを返す。
 * 既存の parseCSVToCustomers() は customers のみ返す互換関数として維持。
 */
export function parseCSV(csvText: string): ParseResult {
  const cleaned = csvText.replace(/^﻿/, '')
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { customers: [], unmappedHeaders: [], mappedHeaders: [] }

  const headerLine = lines[0]
  const delimiter = headerLine.includes('\t') ? '\t' : ','
  const rawHeaders = delimiter === '\t'
    ? headerLine.split('\t').map(h => h.trim().replace(/^"|"$/g, ''))
    : parseCSVLine(headerLine)

  const headerInfo = rawHeaders.map(h => normalizeHeader(h))
  const headers = headerInfo.map(x => x.key)

  const mappedHeaders: { original: string; mapped: string }[] = []
  const unmappedHeaders: string[] = []
  for (const h of headerInfo) {
    if (KNOWN_FIELD_KEYS.has(h.key)) {
      mappedHeaders.push({ original: h.original, mapped: h.key })
    } else {
      unmappedHeaders.push(h.original)
    }
  }

  const rows: ImportCustomerRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = delimiter === '\t'
      ? line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''))
      : parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })

    const name = row.name || ''
    if (!name.trim()) continue

    const purchaseHistory = parsePurchaseHistory(row.purchase_history)
    const firstVisit = parseDate(row.first_visit_date)
    const lastVisit = parseDate(row.last_visit_date)

    const totalSpentFromHistory = purchaseHistory.reduce((s, p) => s + p.amount, 0)
    const totalSpent = parseAmount(row.total_spent) || totalSpentFromHistory
    const visitCount = parseInt(row.visit_count || '0') || purchaseHistory.length || 0

    // カルテ用の補助情報を memo に集約（既存 memo を汚さず末尾追加）
    const memoParts: string[] = []
    if (row.memo?.trim()) memoParts.push(row.memo.trim())
    if (row.member_number?.trim()) memoParts.push(`会員番号: ${row.member_number.trim()}`)
    if (row.occupation?.trim()) memoParts.push(`職業: ${row.occupation.trim()}`)
    if (row.referral?.trim()) memoParts.push(`紹介元: ${row.referral.trim()}`)
    if (row.blood_type?.trim()) memoParts.push(`血液型: ${row.blood_type.trim()}`)
    if (row.postal_code?.trim()) memoParts.push(`〒${row.postal_code.trim()}`)
    const memo = memoParts.length > 0 ? memoParts.join(' / ') : undefined

    rows.push({
      name: name.trim(),
      name_kana: row.name_kana?.trim() || undefined,
      phone: normalizePhone(row.phone),
      email: row.email?.trim() || undefined,
      address: row.address?.trim() || undefined,
      birthday: parseDate(row.birthday) || undefined,
      gender: parseGender(row.gender),
      first_visit_date: firstVisit || undefined,
      last_visit_date: lastVisit || undefined,
      memo,
      concerns: row.concerns?.trim() || undefined,
      allergies: row.allergies?.trim() || undefined,
      line_user_id: row.line_user_id?.trim() || undefined,
      purchase_history: purchaseHistory.length > 0 ? purchaseHistory : undefined,
      ticket_plan_name: row.ticket_plan_name?.trim() || undefined,
      remaining_sessions: parseInt(row.remaining_sessions || '0') || undefined,
      expiry_date: parseDate(row.expiry_date) || undefined,
      unearned_revenue: parseAmount(row.unearned_revenue) || undefined,
      visit_count: visitCount,
      total_spent: totalSpent,
      avg_unit_price: visitCount > 0 ? Math.round(totalSpent / visitCount) : 0,
    })
  }

  return { customers: rows, unmappedHeaders, mappedHeaders }
}

/** 後方互換：既存呼び出し側が想定する signature を維持 */
export function parseCSVToCustomers(csvText: string): ImportCustomerRow[] {
  return parseCSV(csvText).customers
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
  last_visit_date?: string
  memo?: string
  concerns?: string
  allergies?: string
  line_user_id?: string
  purchase_history?: { date: string; menu: string; amount: number }[]
  ticket_plan_name?: string
  remaining_sessions?: number
  expiry_date?: string
  unearned_revenue?: number
  visit_count?: number
  total_spent?: number
  avg_unit_price?: number
}
