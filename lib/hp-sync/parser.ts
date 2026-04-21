/**
 * Email-to-reservation parser using Claude.
 *
 * Accepts the raw body of a HotPepper reservation confirmation email
 * (Japanese text) and returns a structured reservation payload.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface ParsedReservation {
  customerName: string | null
  customerNameKana: string | null
  phone: string | null
  reservationDate: string | null // YYYY-MM-DD
  startTime: string | null // HH:mm
  endTime: string | null // HH:mm
  menu: string | null
  staffName: string | null
  price: number | null
  externalId: string | null
  eventType: 'new' | 'change' | 'cancel' | 'unknown'
  confidence: number // 0-1
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

const SYSTEM_PROMPT = `あなたはホットペッパービューティーから届く予約通知メールを解析するパーサーです。
与えられたメール本文から、以下のJSON形式で予約情報を抽出してください。

スキーマ:
{
  "customerName": "顧客氏名（姓名スペース区切り、なければ null）",
  "customerNameKana": "フリガナ（なければ null）",
  "phone": "電話番号（ハイフンなし、なければ null）",
  "reservationDate": "予約日 YYYY-MM-DD（なければ null）",
  "startTime": "開始時刻 HH:mm 24時間表記（なければ null）",
  "endTime": "終了時刻 HH:mm（なければ null）",
  "menu": "メニュー名（複数あれば '、' で連結）",
  "staffName": "担当スタッフ名（なければ null）",
  "price": "金額（整数・円、なければ null）",
  "externalId": "HPの予約番号・受付番号（なければ null）",
  "eventType": "'new'（新規予約）/'change'（変更）/'cancel'（キャンセル）/'unknown'",
  "confidence": "0〜1の信頼度"
}

注意:
- 必ず純粋なJSONのみを出力。説明文やコードフェンス不要。
- 不明な項目は null（confidence は必ず数値）。
- 日付は今年を基準。和暦があれば西暦に変換。
- キャンセルメールなら eventType: 'cancel'。`

export async function parseReservationEmail(body: string): Promise<ParsedReservation> {
  const fallback: ParsedReservation = {
    customerName: null,
    customerNameKana: null,
    phone: null,
    reservationDate: null,
    startTime: null,
    endTime: null,
    menu: null,
    staffName: null,
    price: null,
    externalId: null,
    eventType: 'unknown',
    confidence: 0,
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[hp-sync/parser] ANTHROPIC_API_KEY not set')
    return fallback
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `以下のメール本文を解析してください:\n\n${body.slice(0, 8000)}`,
        },
      ],
    })

    const first = response.content[0]
    const text = first && first.type === 'text' ? first.text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback

    const parsed = JSON.parse(match[0]) as Partial<ParsedReservation>
    return {
      customerName: parsed.customerName ?? null,
      customerNameKana: parsed.customerNameKana ?? null,
      phone: parsed.phone?.replace(/[^\d]/g, '') || null,
      reservationDate: parsed.reservationDate ?? null,
      startTime: parsed.startTime ?? null,
      endTime: parsed.endTime ?? null,
      menu: parsed.menu ?? null,
      staffName: parsed.staffName ?? null,
      price: typeof parsed.price === 'number' ? parsed.price : null,
      externalId: parsed.externalId ?? null,
      eventType: (parsed.eventType as ParsedReservation['eventType']) ?? 'unknown',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    }
  } catch (e) {
    console.error('[hp-sync/parser] parse failed', e)
    return fallback
  }
}
