import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SOLA_SYSTEM = `あなたはSOLA（ソラ）、エステサロンのAIビューティーカウンセラーです。
お客様のお肌の悩みを丁寧に聞き、適切なアドバイスやメニュー提案をします。
親しみやすく、専門的でありながら分かりやすい言葉で話してください。`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, messages, concerns, skin_type, visit_purpose, summary } = body

    if (mode === 'chat') {
      if (!messages?.length) {
        return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
      }
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SOLA_SYSTEM,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      })
      const text = response.content[0]
      const message = text.type === 'text' ? text.text : 'ありがとうございます。'
      return NextResponse.json({ message })
    }

    if (mode === 'menu') {
      const prompt = `お客様の悩み: ${concerns || '特になし'}
肌タイプ: ${skin_type || '不明'}
来店目的: ${visit_purpose || '不明'}

上記を踏まえ、おすすめの施術メニューを3つ提案してください。
JSON形式で返してください。形式:
{"menus":[{"name":"メニュー名","reason":"おすすめ理由","duration":"所要時間"}]}`
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0]
      const raw = text.type === 'text' ? text.text : '[]'
      const match = raw.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : { menus: [] }
      return NextResponse.json({ menus: parsed.menus || [] })
    }

    if (mode === 'comment') {
      const prompt = `以下のカウンセリング結果を踏まえ、スタッフ向けの簡潔なコメント（2〜3文）を生成してください。\n\n${summary || ''}`
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0]
      const comment = text.type === 'text' ? text.text : ''
      return NextResponse.json({ comment })
    }

    return NextResponse.json({ error: '無効なモードです' }, { status: 400 })
  } catch (error) {
    console.error('Counseling API Error:', error)
    return NextResponse.json(
      { error: '接続に問題が発生しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
