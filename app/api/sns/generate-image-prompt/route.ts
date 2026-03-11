import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { post_content, platform, style } = await req.json()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `あなたはサロン向けSNS画像のディレクターです。
投稿内容に合った画像生成AIプロンプトを作成してください。
必ず以下のJSON形式のみで返してください：
{
  "image_prompt": "画像生成AI用の詳細プロンプト（英語）",
  "composition": "構図の説明（日本語）",
  "color_scheme": "推奨カラースキーム（日本語）",
  "text_overlay": "画像に載せるテキスト案（日本語）"
}`,
      messages: [{
        role: 'user',
        content: `投稿内容: ${post_content}
プラットフォーム: ${platform}
スタイル: ${style || 'photo'}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('パース失敗')
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '画像プロンプト生成に失敗しました' }, { status: 500 })
  }
}
