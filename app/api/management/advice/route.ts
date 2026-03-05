import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, data } = body as { type: 'monthly' | 'yearly'; data: Record<string, unknown> }

    if (!type || !data) {
      return NextResponse.json({ error: 'type と data が必要です' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
    }

    const systemPrompt = type === 'monthly'
      ? `あなたはサロン経営の専門コンサルタントです。月間の経営データを分析し、経営会議で使える具体的なアドバイスを提供してください。
データには目標値（targets）・実績（totals/rows）・達成率が含まれています。
出力は以下の4セクションに分けて、箇条書きで簡潔に記載してください：
1. 今月の経営状況サマリー（目標対比・達成率を必ず含める）
2. 売上トレンドの分析
3. 改善すべき指標とアクション提案（目標未達の項目には具体的な改善策を必ず出力する）
4. 来月の目標設定アドバイス`
      : `あなたはサロン経営の専門コンサルタントです。年間の経営データを分析し、戦略的なアドバイスを提供してください。
データには目標値（targets）・実績（totals）・達成率が含まれています。
出力は以下の4セクションに分けて、箇条書きで簡潔に記載してください：
1. 年間の経営トレンド（目標対比・達成率を必ず含める）
2. 好調月・不調月の要因分析
3. 来年の戦略アドバイス（目標未達項目への具体的改善策を必ず出力する）
4. 目標設定の提案`

    const userContent = `以下の${type === 'monthly' ? '月間' : '年間'}経営データを分析し、アドバイスを生成してください。目標値・実績・達成率・ギャップを踏まえ、目標未達項目には具体的な改善策を必ず含めてください。\n\n${JSON.stringify(data, null, 2)}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式')
    }

    return NextResponse.json({ advice: content.text })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
