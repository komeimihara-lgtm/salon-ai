import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (files.length === 0) return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })

    const imageContents = await Promise.all(
      files.slice(0, 10).map(async (file) => {
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
        return {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: base64 }
        }
      })
    )

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `この画像は商品の納品書または在庫リストです。
商品情報を読み取り、以下のJSON形式のみで返してください。
マークダウンや説明文は不要です。JSONのみ返してください。

{
  "products": [
    {
      "name": "商品名",
      "price": 販売価格(数値・不明なら0),
      "cost": 仕入れ価格(数値・不明なら0),
      "stock": 数量(数値・不明なら0),
      "memo": "備考(任意)"
    }
  ]
}`
          }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '読み取りに失敗しました' }, { status: 500 })
  }
}
