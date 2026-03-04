import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, DEMO_SALON_ID } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 9999
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntilBirthday(birthday: string | null): number | null {
  if (!birthday) return null
  const [y, m, d] = birthday.split('-').map(Number)
  const today = new Date()
  const thisYear = new Date(today.getFullYear(), m - 1, d)
  if (thisYear < today) {
    thisYear.setFullYear(today.getFullYear() + 1)
  }
  return Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, visit_count, last_visit_date, status, birthday, memo')
      .eq('salon_id', DEMO_SALON_ID)
      .in('status', ['active', 'vip'])
      .order('last_visit_date', { ascending: false })
      .limit(50)

    const summary = (customers || []).map((c) => {
      const daysSinceVisit = daysSince(c.last_visit_date)
      const daysToBirthday = daysUntilBirthday(c.birthday)
      return {
        name: c.name,
        visit_count: c.visit_count || 0,
        days_since_visit: daysSinceVisit,
        status: c.status,
        birthday_soon: daysToBirthday !== null && daysToBirthday >= 0 && daysToBirthday <= 30,
        days_to_birthday: daysToBirthday,
        memo: (c.memo || '').slice(0, 100),
      }
    })

    const systemPrompt = `あなたはエステサロンの「感動体験」を設計するプロのコンサルタントです。
顧客データを分析し、「普通のサービスを超えた感動」を生む取り組みを提案してください。

提案の考え方：
- 誕生日・来店記念日など「特別な日」を逃さない
- 長期間未来店・失客寸前の顧客への心のこもったアプローチ
- VIP・リピーターへの特別感のあるサプライズ
- 一人ひとりの状況に寄り添ったパーソナルな提案
- 施術以外の「気づかい」で差別化

出力は必ず以下のJSON形式のみ。説明文は含めない。
{"proposals":[{"customer_name":"顧客名","reason":"提案理由（短く）","initiative":"具体的な取り組み内容","action_type":"message|task|offer|surprise","message_template":"実行用のメッセージ文（LINE等で送る場合）","priority":1}]}

priorityは1-5（1が最優先）。最大5件まで。`

    const userPrompt = `【顧客データ】
${JSON.stringify(summary, null, 2)}

上記の顧客データを分析し、感動レベルの顧客満足UPの取り組みを提案してください。`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式')
    }

    let parsed: {
      proposals?: {
        customer_name: string
        reason: string
        initiative: string
        action_type: string
        message_template?: string
        priority: number
      }[]
    }
    try {
      const text = content.text.replace(/```json\n?|\n?```/g, '').trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      parsed = { proposals: [] }
    }

    const proposals = (parsed.proposals || []).slice(0, 5)
    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('customer-delight API Error:', error)
    return NextResponse.json(
      { error: '提案の生成に失敗しました。再度お試しください。' },
      { status: 500 }
    )
  }
}
