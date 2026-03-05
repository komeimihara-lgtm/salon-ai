/**
 * 画像AI読み取りAPI
 * Claude APIで画像から顧客情報を抽出
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-20250514'

const PROMPT = `この画像から顧客情報を読み取り、以下のJSON形式で返してください：
{
  "customers": [{
    "name": "氏名（必須）",
    "name_kana": "フリガナ",
    "phone": "電話番号",
    "email": "メールアドレス",
    "address": "住所",
    "birthday": "YYYY-MM-DD形式",
    "gender": "female|male|other|unknown",
    "first_visit_date": "YYYY-MM-DD形式",
    "memo": "メモ",
    "purchase_history": [{"date": "YYYY-MM-DD", "menu": "メニュー名", "amount": 金額}],
    "ticket_plan_name": "回数券名",
    "remaining_sessions": 残回数,
    "expiry_date": "YYYY-MM-DD形式"
  }]
}

ホットペッパービューティーの管理画面の場合、顧客一覧や予約履歴から情報を抽出してください。
読み取れない項目は省略してください。JSONのみを返し、説明文は含めないでください。`

type ExtractedCustomer = {
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
}

function parseJsonFromResponse(text: string): { customers: ExtractedCustomer[] } {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('JSONが見つかりません')
  const parsed = JSON.parse(jsonMatch[0]) as { customers?: ExtractedCustomer[] }
  const customers = Array.isArray(parsed.customers) ? parsed.customers : []
  return { customers }
}

function toImportRow(c: ExtractedCustomer): ImportCustomerRow {
  const ph = c.purchase_history ?? []
  const lastVisit = ph.length > 0 ? ph.reduce((a, p) => (p.date > a ? p.date : a), '') : null
  const totalSpent = ph.reduce((s, p) => s + (p.amount || 0), 0)
  return {
    name: c.name?.trim() || '不明',
    name_kana: c.name_kana?.trim(),
    phone: c.phone?.trim(),
    email: c.email?.trim(),
    address: c.address?.trim(),
    birthday: c.birthday || undefined,
    gender: c.gender || 'unknown',
    first_visit_date: c.first_visit_date,
    memo: c.memo?.trim(),
    purchase_history: ph.length > 0 ? ph : undefined,
    ticket_plan_name: c.ticket_plan_name?.trim(),
    remaining_sessions: c.remaining_sessions,
    expiry_date: c.expiry_date,
    visit_count: ph.length,
    total_spent: totalSpent,
    avg_unit_price: ph.length > 0 ? Math.round(totalSpent / ph.length) : 0,
  }
}

type ImportCustomerRow = {
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
  visit_count?: number
  total_spent?: number
  avg_unit_price?: number
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEYが設定されていません' }, { status: 500 })
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files?.length) {
      return NextResponse.json({ error: '画像ファイルが必要です' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey })
    const allCustomers: ImportCustomerRow[] = []

    for (const file of files) {
      const type = file.type
      if (!type.startsWith('image/') && type !== 'application/pdf') {
        continue // スキップ
      }

      const buf = Buffer.from(await file.arrayBuffer())
      const base64 = buf.toString('base64')
      const mediaType = type === 'application/pdf' ? 'application/pdf' : type

      const mediaTypeCast = mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'
      const imageBlock = {
        type: (mediaType === 'application/pdf' ? 'document' : 'image') as 'image' | 'document',
        source: { type: 'base64' as const, media_type: mediaTypeCast, data: base64 },
      }
      const promptBlock = { type: 'text' as const, text: PROMPT }
      const content = [imageBlock, promptBlock] as Anthropic.MessageParam['content']

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      })

      const textPart = response.content.find(b => b.type === 'text')
      const text = textPart && 'text' in textPart ? textPart.text : ''
      const { customers } = parseJsonFromResponse(text)
      allCustomers.push(...customers.map(toImportRow))
    }

    return NextResponse.json({ customers: allCustomers })
  } catch (error) {
    console.error('画像読み取りエラー:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '画像の読み取りに失敗しました' },
      { status: 500 }
    )
  }
}
