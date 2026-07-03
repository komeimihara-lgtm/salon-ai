import { CLAUDE_MODELS } from '@/lib/ai-models'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { DEMO_SALON, buildLeoSystemPrompt } from '@/lib/leo'
import { LeoMessage } from '@/types'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSalonIdFromApiRequest } from '@/lib/get-salon-id'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, context }: { messages: LeoMessage[]; context?: { targets?: Record<string, number>; kpi?: Record<string, number> } } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })
    }

    // 実際のサロンデータを Supabase から取得（owner_name 等）
    const salonId = getSalonIdFromApiRequest(req)
    let salon = DEMO_SALON
    if (salonId) {
      try {
        const supabase = getSupabaseAdmin()
        const { data } = await supabase
          .from('salons')
          .select('id, name, owner_name, plan')
          .eq('id', salonId)
          .maybeSingle()
        if (data) {
          salon = {
            ...DEMO_SALON,
            id: data.id,
            name: data.name || '',
            owner_name: data.owner_name || 'オーナー',
            plan: data.plan || 'pro',
          }
        }
      } catch {
        // フォールバックで DEMO_SALON を使用
      }
    }

    const systemPrompt = buildLeoSystemPrompt(salon, context)

    const response = await anthropic.messages.create({
      model: CLAUDE_MODELS.sonnet,
      max_tokens: 2048,
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
    console.error('SOLA chat API Error:', error)
    return NextResponse.json(
      { error: 'SOLAとの接続に問題が発生しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
