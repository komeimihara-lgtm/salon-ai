import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'image' | 'pdf' | 'url'
    const url = formData.get('url') as string

    let content: Anthropic.MessageParam['content'] = []

    if (type === 'url') {
      content = [
        {
          type: 'text',
          text: `以下のURLのページからエステサロンのメニュー情報を抽出してください。
URL: ${url}

以下のJSON形式で返してください。JSONのみ返し、他のテキストは一切含めないでください：
{
  "menus": [
    {
      "name": "メニュー名",
      "duration": 60,
      "price": 8000,
      "category": "フェイシャル"
    }
  ],
  "categories": ["フェイシャル", "ボディ", "脱毛", "オプション", "物販", "キャンペーン"]
}

categoryは以下から最も近いものを選んでください：フェイシャル、ボディ、脱毛、オプション、物販、キャンペーン`
        }
      ]
    } else {
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

      content = [
        {
          type: mediaType === 'application/pdf' ? 'document' : 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64,
          },
        } as Anthropic.MessageParam['content'][0],
        {
          type: 'text',
          text: `この${type === 'pdf' ? 'PDFドキュメント' : '画像'}からエステサロンのメニュー情報を全て抽出してください。

以下のJSON形式で返してください。JSONのみ返し、他のテキストは一切含めないでください：
{
  "menus": [
    {
      "name": "メニュー名",
      "duration": 60,
      "price": 8000,
      "category": "フェイシャル"
    }
  ],
  "categories": ["フェイシャル", "ボディ", "脱毛", "オプション", "物販", "キャンペーン"]
}

durationが不明な場合は60を設定してください。
categoryは以下から最も近いものを選んでください：フェイシャル、ボディ、脱毛、オプション、物販、キャンペーン`
        }
      ]
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
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
