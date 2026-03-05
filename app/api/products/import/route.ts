import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const PRODUCT_EXTRACT_PROMPT = `
以下の画像は商品の納品書またはメニュー表です。
商品名・単価・数量を読み取りJSONで返してください。

形式（JSONのみ、他のテキストは含めない）:
{
  "products": [
    { "name": "商品名", "price": 単価（数値）, "quantity": 数量（数値）, "memo": "備考（任意）" }
  ]
}

注意:
- price, quantity は数値で返す
- 読み取れない場合は空配列でも可
`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const file = formData.get('file') as File | null
    const fileList = files.length > 0 ? files : (file ? [file] : [])

    if (fileList.length === 0) {
      return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
    }
    if (fileList.length > 10) {
      return NextResponse.json({ error: '画像は最大10枚までアップロードできます' }, { status: 400 })
    }

    const blocks: Array<{ type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } } | { type: 'text'; text: string }> = []
    for (const f of fileList) {
      const bytes = await f.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const rawType = f.type || 'image/png'
      const mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(rawType) ? rawType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' : 'image/png'
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    }
    blocks.push({ type: 'text', text: PRODUCT_EXTRACT_PROMPT })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: blocks }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error('商品インポートエラー:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
