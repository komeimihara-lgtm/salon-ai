import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const url = formData.get('url') as string

    const prompt = `
エステサロンの情報を全て抽出し、以下のルールで正確に分類してください。

分類ルール：
- 「クーポン」「割引券」「○○限定クーポン」→ coupons
- 「○回コース」「○回券」「回数券」→ courses
- 「月額」「サブスク」「定額」→ subscriptions
- 「初回限定」「期間限定」「○○OFF」「キャンペーン」→ campaigns
- それ以外の通常施術メニュー → menus

以下のJSON形式のみで返してください。他のテキストは一切含めないでください：
{
  "menus": [
    {
      "name": "メニュー名",
      "duration": 60,
      "price": 8000,
      "category": "フェイシャル"
    }
  ],
  "courses": [
    {
      "name": "フェイシャル5回券",
      "menuName": "フェイシャル60分",
      "totalSessions": 5,
      "price": 35000,
      "expiryMonths": 6
    }
  ],
  "campaigns": [
    {
      "name": "初回限定20%OFF",
      "discountType": "percent",
      "discountValue": 20,
      "startDate": "",
      "endDate": ""
    }
  ],
  "coupons": [
    {
      "name": "新規限定フェイシャル20%OFF",
      "targetMenu": "フェイシャル60分",
      "discountType": "percent",
      "discountValue": 20,
      "conditions": "新規限定",
      "expiryDate": ""
    }
  ],
  "subscriptions": [
    {
      "name": "月額プレミアムプラン",
      "menuName": "フェイシャル60分",
      "price": 8000,
      "sessionsPerMonth": 2,
      "billingDay": 1
    }
  ],
  "categories": ["フェイシャル", "ボディ", "脱毛", "オプション", "物販", "キャンペーン", "クーポン"]
}

注意：
- durationが不明な場合は60を設定
- expiryMonthsが不明な場合は6を設定
- categoryはフェイシャル・ボディ・脱毛・オプション・物販・キャンペーン・クーポンから選択
- discountTypeはpercent（%OFF）またはamount（円引き）
- 空の配列でも必ずキーを含めること
`

    let content: Anthropic.MessageParam['content'] = []

    if (type === 'url') {
      content = [{ type: 'text', text: `URL: ${url}\n\n${prompt}` }]
    } else {
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
      content = [
        {
          type: mediaType === 'application/pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        } as Anthropic.MessageParam['content'][0],
        { type: 'text', text: prompt }
      ]
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
