import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { DEMO_SALON, buildLeoSystemPrompt } from '@/lib/leo'
import { LeoMessage } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: LeoMessage[] } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
    }

    // サロンデータ取得（デモ）
    // 本番ではSupabaseからサロンIDで取得
    const salon = DEMO_SALON
    const systemPrompt = buildLeoSystemPrompt(salon)

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式')
    }

    return NextResponse.json({ message: content.text })
  } catch (error) {
    console.error('LEO GRANT API Error:', error)
    return NextResponse.json(
      { error: 'LEOとの接続に問題が発生しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
